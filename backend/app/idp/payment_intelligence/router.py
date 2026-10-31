"""FastAPI Router for IDP Multi-Mode Payment Intelligence & Intelligent Reconciliation.

Endpoints:
- POST /api/idp/payments/extract-and-match: Extracts & matches any of the 8 payment modes.
- GET  /api/idp/payments/dashboard: Incoming payment stats, mode filters, pending approvals.
- GET  /api/idp/payments/{payment_id}: Specific payment details, evidence, & ERP status.
- POST /api/idp/payments/{payment_id}/action: Executes 1 of the 7 Human-in-the-Loop actions.
- GET  /api/idp/payments/debtors: Lists debtors and open invoices for manual correction.
- GET  /api/idp/payments/federated/status: Federated learning status & differential privacy budget.
- POST /api/idp/payments/federated/train-round: Executes a 3-company federated learning round.
- POST /api/idp/payments/demo/seed: Seeds deterministic fictional demonstration scenarios.
"""

from __future__ import annotations
import logging
import hashlib
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from .models import (
    IDPCompany,
    IDPDebtorLedger,
    IDPInvoice,
    IDPPayment,
    IDPReconciliationRecommendation,
    IDPApprovalDecision,
    IDPERPPostingVoucher,
    IDPMemoryFeedback,
    IDPFederatedModel,
)
from .schemas import (
    UnifiedPaymentExtract,
    ReconciliationRecommendationResponse,
    HumanApprovalRequest,
    HumanApprovalResponse,
    FederatedModelStatus,
    FederatedTrainRoundRequest,
)
from .extractors import extract_unified_payment
from .engine import IntelligentReconciliationEngine
from .erp_adapter import IDPERPAdapter
from .memory_bridge import IDPCafieMemoryBridge
from .federated import FederatedPaymentService

logger = logging.getLogger("finvora.idp.router")

router = APIRouter(prefix="/api/idp/payments", tags=["IDP Payment Intelligence"])


def get_default_company(db: Session) -> IDPCompany:
    """Ensures a default enterprise company exists for single-tenant / demo workspace."""
    comp = db.query(IDPCompany).filter(IDPCompany.company_code == "FINVORA-ENT-001").first()
    if not comp:
        comp = IDPCompany(
            company_code="FINVORA-ENT-001",
            name="FINVORA Enterprise Systems India Pvt Ltd",
            federated_opt_in=True,
        )
        db.add(comp)
        db.commit()
        db.refresh(comp)
    return comp


@router.post("/extract-and-match", response_model=ReconciliationRecommendationResponse)
def extract_and_match_payment(
    payload: Dict[str, Any] = Body(..., example={
        "payment_mode": "UPI",
        "payload": {
            "upi_transaction_id": "UPI-2026-998811",
            "utr_rrn": "412356789012",
            "payer_vpa": "apex.cloud@okhdfcbank",
            "narration": "Settlement for INV-2026-APX-801",
            "amount": 250000.0,
            "transaction_date": "2026-04-15"
        }
    }),
    db: Session = Depends(get_db),
):
    """
    Ingests an incoming payment across any of the 8 payment modes, extracts structured
    attributes, and evaluates it through the Intelligent Matching Engine.
    """
    mode = str(payload.get("payment_mode") or "BANK_TRANSFER").upper()
    inner_payload = payload.get("payload") or payload

    # 1. Extract structured fields without fabricating
    extract = extract_unified_payment(mode, inner_payload)
    comp = get_default_company(db)

    # 2. Generate idempotency key for payment ingestion
    ref_part = extract.reference_id or f"rnd-{datetime.utcnow().timestamp()}"
    idempotency_key = hashlib.sha256(f"{comp.id}-{mode}-{extract.amount}-{ref_part}".encode()).hexdigest()[:32]

    # Check if this exact payment has already been ingested
    payment = db.query(IDPPayment).filter(IDPPayment.idempotency_key == idempotency_key).first()
    if not payment:
        payment = IDPPayment(
            company_id=comp.id,
            payment_mode=extract.payment_mode,
            raw_payload=inner_payload,
            extracted_fields=extract.dict(),
            amount=extract.amount,
            payment_date=datetime.utcnow(),
            reference_id=extract.reference_id,
            payer_name=extract.payer_name,
            payer_vpa=extract.payer_vpa,
            payer_account=extract.payer_account,
            payer_bank=extract.payer_bank,
            narration=extract.narration,
            status="PENDING_APPROVAL",
            idempotency_key=idempotency_key,
        )
        db.add(payment)
        db.commit()
        db.refresh(payment)

    # 3. Evaluate through Reconciliation Engine
    engine = IntelligentReconciliationEngine(db)
    rec = payment.recommendation
    if not rec:
        rec = engine.evaluate_payment(payment, extract)

    # Format response
    debtor = rec.debtor
    suggested_invs = []
    if rec.suggested_invoice_ids:
        inv_objs = db.query(IDPInvoice).filter(IDPInvoice.id.in_(rec.suggested_invoice_ids)).all()
        suggested_invs = [
            {
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "total_amount": inv.total_amount,
                "paid_amount": inv.paid_amount,
                "balance_amount": inv.balance_amount,
                "status": inv.status,
            }
            for inv in inv_objs
        ]

    return ReconciliationRecommendationResponse(
        payment_id=payment.id,
        payment_mode=payment.payment_mode,
        amount=payment.amount,
        reference_id=payment.reference_id,
        payment_date=str(payment.payment_date),
        payer_name=payment.payer_name,
        payer_vpa=payment.payer_vpa,
        narration=payment.narration,
        match_tier=rec.match_tier,
        confidence_score=rec.confidence_score,
        suggested_debtor_id=debtor.id if debtor else None,
        suggested_debtor_name=debtor.name if debtor else None,
        suggested_debtor_code=debtor.debtor_code if debtor else None,
        suggested_ledger=rec.suggested_ledger,
        suggested_invoices=suggested_invs,
        explanation=rec.explanation,
        evidence_breakdown=rec.evidence_breakdown or [],
        alternative_matches=rec.alternative_matches or [],
        status=payment.status,
        is_duplicate_suspect=rec.match_tier == "DUPLICATE_SUSPECT",
    )


@router.get("/dashboard")
def get_payment_dashboard(
    mode_filter: Optional[str] = Query(None, description="Filter by payment mode"),
    db: Session = Depends(get_db),
):
    """Returns incoming payment statistics, mode breakdowns, and recent reconciliation cards."""
    comp = get_default_company(db)
    query = db.query(IDPPayment).filter(IDPPayment.company_id == comp.id)

    if mode_filter and mode_filter.upper() != "ALL":
        query = query.filter(IDPPayment.payment_mode == mode_filter.upper())

    payments = query.order_by(desc(IDPPayment.created_at)).limit(50).all()

    # Aggregate stats
    all_payments = db.query(IDPPayment).filter(IDPPayment.company_id == comp.id).all()
    total_count = len(all_payments)
    pending_count = sum(1 for p in all_payments if p.status == "PENDING_APPROVAL")
    posted_count = sum(1 for p in all_payments if p.status == "POSTED")
    duplicate_count = sum(1 for p in all_payments if p.status == "DUPLICATE_SUSPECT")
    unidentified_count = sum(1 for p in all_payments if p.status == "UNIDENTIFIED")

    mode_counts = {}
    for p in all_payments:
        mode_counts[p.payment_mode] = mode_counts.get(p.payment_mode, 0) + 1

    recon_rate = round((posted_count / total_count * 100), 1) if total_count > 0 else 0.0

    cards = []
    for p in payments:
        rec = p.recommendation
        debtor_name = rec.debtor.name if (rec and rec.debtor) else (p.payer_name or "Unassigned")
        debtor_code = rec.debtor.debtor_code if (rec and rec.debtor) else None

        cards.append({
            "payment_id": p.id,
            "payment_mode": p.payment_mode,
            "amount": p.amount,
            "reference_id": p.reference_id,
            "payment_date": p.payment_date.strftime("%Y-%m-%d") if p.payment_date else None,
            "payer_name": p.payer_name,
            "payer_vpa": p.payer_vpa,
            "narration": p.narration,
            "status": p.status,
            "match_tier": rec.match_tier if rec else "PENDING",
            "confidence_score": rec.confidence_score if rec else 0.0,
            "suggested_debtor": debtor_name,
            "suggested_debtor_code": debtor_code,
            "suggested_ledger": rec.suggested_ledger if rec else "Sundry Debtors",
            "explanation": rec.explanation if rec else "Pending evaluation",
            "evidence_count": len(rec.evidence_breakdown or []) if rec else 0,
            "has_erp_voucher": bool(p.erp_voucher and p.erp_voucher.status == "POSTED_CONFIRMED"),
            "erp_voucher_number": p.erp_voucher.voucher_number if p.erp_voucher else None,
        })

    return {
        "status": "success",
        "company": {"name": comp.name, "code": comp.company_code},
        "stats": {
            "total_incoming": total_count,
            "pending_approval": pending_count,
            "posted_reconciled": posted_count,
            "duplicate_alerts": duplicate_count,
            "unidentified": unidentified_count,
            "reconciliation_rate": recon_rate,
            "mode_distribution": mode_counts,
        },
        "payments": cards,
    }


@router.get("/debtors")
def list_debtors_and_invoices(db: Session = Depends(get_db)):
    """Lists debtors and open invoices for manual HITL correction modal."""
    comp = get_default_company(db)
    debtors = db.query(IDPDebtorLedger).filter(IDPDebtorLedger.company_id == comp.id).all()

    result = []
    for d in debtors:
        open_invs = [inv for inv in d.invoices if inv.balance_amount > 0]
        result.append({
            "id": d.id,
            "code": d.debtor_code,
            "name": d.name,
            "aliases": d.aliases or [],
            "current_balance": d.current_balance,
            "default_ledger": d.default_ledger,
            "bank_account": d.bank_account,
            "vpa": d.vpa,
            "open_invoices": [
                {
                    "id": inv.id,
                    "invoice_number": inv.invoice_number,
                    "balance_amount": inv.balance_amount,
                    "total_amount": inv.total_amount,
                    "status": inv.status,
                }
                for inv in open_invs
            ],
        })

    return {"status": "success", "debtors": result}


@router.post("/{payment_id}/action", response_model=HumanApprovalResponse)
def execute_human_approval_action(
    payment_id: int,
    request: HumanApprovalRequest,
    db: Session = Depends(get_db),
):
    """
    Executes one of the 7 Human-in-the-Loop Actions:
    1. APPROVE_AND_POST: Posts receipt entry to ERP after accountant approval.
    2. CORRECT_DEBTOR: Updates debtor, stores feedback pattern in CAFIE memory, and posts.
    3. CORRECT_INVOICE: Updates target invoice allocation and posts.
    4. SPLIT_PAYMENT: Allocates payment across multiple custom invoices.
    5. REJECT: Rejects recommendation; payment marked REJECTED without posting.
    6. MARK_UNIDENTIFIED: Marks as UNIDENTIFIED; parks in suspense clearing.
    7. SEND_FOR_VERIFICATION: Escrow/hold status pending manual bank confirmation.
    """
    payment = db.query(IDPPayment).filter(IDPPayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail=f"Payment #{payment_id} not found.")

    rec = payment.recommendation
    erp_adapter = IDPERPAdapter(db)
    memory_bridge = IDPCafieMemoryBridge(db)
    action = request.action.upper().strip()

    # ─────────────────────────────────────────────────────────────────────────
    # Action 1: APPROVE_AND_POST
    # ─────────────────────────────────────────────────────────────────────────
    if action == "APPROVE_AND_POST":
        if not rec or not rec.debtor:
            raise HTTPException(
                status_code=400,
                detail="Cannot approve payment without a recommended debtor. Use CORRECT_DEBTOR instead.",
            )

        debtor = rec.debtor
        invoices = (
            db.query(IDPInvoice).filter(IDPInvoice.id.in_(rec.suggested_invoice_ids)).all()
            if rec.suggested_invoice_ids
            else []
        )

        res = erp_adapter.post_approved_receipt(
            payment=payment,
            debtor=debtor,
            approved_invoices=invoices,
            split_allocations=None,
            ledger_name=rec.suggested_ledger or debtor.default_ledger,
            approved_by=request.approved_by,
            simulate_failure=request.simulate_erp_failure or False,
        )

        # Record Decision
        decision = IDPApprovalDecision(
            payment_id=payment.id,
            recommendation_id=rec.id,
            action_taken="APPROVE_AND_POST",
            approved_by=request.approved_by,
            approved_debtor_id=debtor.id,
            approved_invoice_ids=rec.suggested_invoice_ids or [],
            approved_ledger=rec.suggested_ledger,
            remarks=request.remarks or "Accountant authorized automatic match recommendation.",
        )
        db.add(decision)
        db.commit()

        return HumanApprovalResponse(
            success=res["success"],
            payment_id=payment.id,
            action_taken=action,
            message=res["message"],
            erp_voucher_number=res.get("voucher_number"),
            erp_status=res.get("status"),
            tally_xml_snippet=res.get("tally_xml"),
            memory_feedback_stored=False,
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Action 2: CORRECT_DEBTOR (Human correction + CAFIE memory learning loop)
    # ─────────────────────────────────────────────────────────────────────────
    elif action == "CORRECT_DEBTOR":
        if not request.corrected_debtor_id:
            raise HTTPException(status_code=400, detail="corrected_debtor_id is required for CORRECT_DEBTOR.")

        new_debtor = db.query(IDPDebtorLedger).filter(IDPDebtorLedger.id == request.corrected_debtor_id).first()
        if not new_debtor:
            raise HTTPException(status_code=404, detail="Selected debtor not found.")

        # Determine target invoices for new debtor
        target_invoices = [inv for inv in new_debtor.invoices if inv.balance_amount > 0]
        chosen_ledger = request.corrected_ledger or new_debtor.default_ledger

        # 1. Store feedback into CAFIE memory loop so the system learns this pattern!
        pattern_key = payment.payer_name or payment.narration or payment.payer_vpa or str(payment.reference_id)
        memory_bridge.record_accountant_feedback(
            company_id=payment.company_id,
            payment_id=payment.id,
            pattern_type="DEBTOR_ALIAS_CORRECTION",
            pattern_key=pattern_key,
            debtor_id=new_debtor.id,
            ledger_name=chosen_ledger,
            accountant_name=request.approved_by,
            remarks=request.remarks or "Debtor corrected manually by accountant.",
        )

        # 2. Post receipt entry in ERP
        res = erp_adapter.post_approved_receipt(
            payment=payment,
            debtor=new_debtor,
            approved_invoices=target_invoices,
            split_allocations=None,
            ledger_name=chosen_ledger,
            approved_by=request.approved_by,
            simulate_failure=request.simulate_erp_failure or False,
        )

        decision = IDPApprovalDecision(
            payment_id=payment.id,
            recommendation_id=rec.id if rec else None,
            action_taken="CORRECT_DEBTOR",
            approved_by=request.approved_by,
            approved_debtor_id=new_debtor.id,
            approved_invoice_ids=[inv.id for inv in target_invoices],
            approved_ledger=chosen_ledger,
            remarks=request.remarks or f"Reassigned from original recommendation to {new_debtor.name}.",
        )
        db.add(decision)
        db.commit()

        return HumanApprovalResponse(
            success=res["success"],
            payment_id=payment.id,
            action_taken=action,
            message=(
                f"Successfully corrected debtor to {new_debtor.name}. Pattern '{pattern_key}' "
                f"stored in CAFIE memory. {res['message']}"
            ),
            erp_voucher_number=res.get("voucher_number"),
            erp_status=res.get("status"),
            tally_xml_snippet=res.get("tally_xml"),
            memory_feedback_stored=True,
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Action 3: CORRECT_INVOICE
    # ─────────────────────────────────────────────────────────────────────────
    elif action == "CORRECT_INVOICE":
        if not request.corrected_invoice_ids:
            raise HTTPException(status_code=400, detail="corrected_invoice_ids required.")

        invoices = db.query(IDPInvoice).filter(IDPInvoice.id.in_(request.corrected_invoice_ids)).all()
        if not invoices:
            raise HTTPException(status_code=404, detail="Selected invoices not found.")

        debtor = invoices[0].debtor
        res = erp_adapter.post_approved_receipt(
            payment=payment,
            debtor=debtor,
            approved_invoices=invoices,
            split_allocations=None,
            ledger_name=request.corrected_ledger or debtor.default_ledger,
            approved_by=request.approved_by,
            simulate_failure=request.simulate_erp_failure or False,
        )

        decision = IDPApprovalDecision(
            payment_id=payment.id,
            recommendation_id=rec.id if rec else None,
            action_taken="CORRECT_INVOICE",
            approved_by=request.approved_by,
            approved_debtor_id=debtor.id,
            approved_invoice_ids=request.corrected_invoice_ids,
            approved_ledger=request.corrected_ledger or debtor.default_ledger,
            remarks=request.remarks or "Accountant reallocated payment to selected invoice(s).",
        )
        db.add(decision)
        db.commit()

        return HumanApprovalResponse(
            success=res["success"],
            payment_id=payment.id,
            action_taken=action,
            message=f"Reallocated to invoices: {', '.join(inv.invoice_number for inv in invoices)}. {res['message']}",
            erp_voucher_number=res.get("voucher_number"),
            erp_status=res.get("status"),
            tally_xml_snippet=res.get("tally_xml"),
            memory_feedback_stored=False,
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Action 4: SPLIT_PAYMENT
    # ─────────────────────────────────────────────────────────────────────────
    elif action == "SPLIT_PAYMENT":
        if not request.split_allocations or len(request.split_allocations) == 0:
            raise HTTPException(status_code=400, detail="split_allocations list is required.")

        inv_ids = [s.invoice_id for s in request.split_allocations]
        invoices = db.query(IDPInvoice).filter(IDPInvoice.id.in_(inv_ids)).all()
        debtor = invoices[0].debtor if invoices else (rec.debtor if rec else None)

        if not debtor:
            raise HTTPException(status_code=400, detail="Could not determine debtor for split payment.")

        split_dicts = [{"invoice_id": s.invoice_id, "amount": s.amount} for s in request.split_allocations]
        res = erp_adapter.post_approved_receipt(
            payment=payment,
            debtor=debtor,
            approved_invoices=invoices,
            split_allocations=split_dicts,
            ledger_name=request.corrected_ledger or debtor.default_ledger,
            approved_by=request.approved_by,
            simulate_failure=request.simulate_erp_failure or False,
        )

        decision = IDPApprovalDecision(
            payment_id=payment.id,
            recommendation_id=rec.id if rec else None,
            action_taken="SPLIT_PAYMENT",
            approved_by=request.approved_by,
            approved_debtor_id=debtor.id,
            approved_invoice_ids=inv_ids,
            approved_ledger=request.corrected_ledger or debtor.default_ledger,
            split_allocations=split_dicts,
            remarks=request.remarks or f"Split payment across {len(split_dicts)} invoices.",
        )
        db.add(decision)
        db.commit()

        return HumanApprovalResponse(
            success=res["success"],
            payment_id=payment.id,
            action_taken=action,
            message=f"Split across {len(split_dicts)} invoices confirmed and posted. {res['message']}",
            erp_voucher_number=res.get("voucher_number"),
            erp_status=res.get("status"),
            tally_xml_snippet=res.get("tally_xml"),
            memory_feedback_stored=False,
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Action 5: REJECT
    # ─────────────────────────────────────────────────────────────────────────
    elif action == "REJECT":
        payment.status = "REJECTED"
        decision = IDPApprovalDecision(
            payment_id=payment.id,
            recommendation_id=rec.id if rec else None,
            action_taken="REJECT",
            approved_by=request.approved_by,
            remarks=request.remarks or "Rejected recommendation. No ERP voucher posted.",
        )
        db.add(decision)
        db.commit()

        return HumanApprovalResponse(
            success=True,
            payment_id=payment.id,
            action_taken="REJECT",
            message="Recommendation rejected. No ledger or voucher entries were created in ERP.",
            erp_voucher_number=None,
            erp_status="NOT_POSTED",
            tally_xml_snippet=None,
            memory_feedback_stored=False,
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Action 6: MARK_UNIDENTIFIED
    # ─────────────────────────────────────────────────────────────────────────
    elif action == "MARK_UNIDENTIFIED":
        payment.status = "UNIDENTIFIED"
        decision = IDPApprovalDecision(
            payment_id=payment.id,
            recommendation_id=rec.id if rec else None,
            action_taken="MARK_UNIDENTIFIED",
            approved_by=request.approved_by,
            approved_ledger="Bank Suspense & Clearing Account",
            remarks=request.remarks or "Payment marked as unidentified pending bank clarification.",
        )
        db.add(decision)
        db.commit()

        return HumanApprovalResponse(
            success=True,
            payment_id=payment.id,
            action_taken="MARK_UNIDENTIFIED",
            message="Payment marked as Unidentified and moved to Suspense/Clearing ledger.",
            erp_voucher_number=None,
            erp_status="NOT_POSTED",
            tally_xml_snippet=None,
            memory_feedback_stored=False,
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Action 7: SEND_FOR_VERIFICATION
    # ─────────────────────────────────────────────────────────────────────────
    elif action == "SEND_FOR_VERIFICATION":
        payment.status = "MANUAL_VERIFICATION"
        decision = IDPApprovalDecision(
            payment_id=payment.id,
            recommendation_id=rec.id if rec else None,
            action_taken="SEND_FOR_VERIFICATION",
            approved_by=request.approved_by,
            remarks=request.remarks or "Escalated for bank statement & remitter KYC verification.",
        )
        db.add(decision)
        db.commit()

        return HumanApprovalResponse(
            success=True,
            payment_id=payment.id,
            action_taken="SEND_FOR_VERIFICATION",
            message="Payment routed for manual bank inquiry. Voucher posting held until KYC confirmation.",
            erp_voucher_number=None,
            erp_status="ON_HOLD",
            tally_xml_snippet=None,
            memory_feedback_stored=False,
        )

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported action '{action}'.")


# ─────────────────────────────────────────────────────────────────────────────
# Federated Learning Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/federated/status", response_model=FederatedModelStatus)
def get_federated_status(db: Session = Depends(get_db)):
    """Returns status of global federated payment model, differential privacy budget, and participants."""
    fed_service = FederatedPaymentService(db)
    model = fed_service.get_latest_model()
    comp = get_default_company(db)

    return FederatedModelStatus(
        version=model.version_tag,
        round_number=model.round_number,
        participants_count=model.participants_count,
        clipping_norm=model.clipping_norm,
        epsilon=model.epsilon,
        delta=model.delta,
        model_weights=model.weights_blob,
        opt_in_status=comp.federated_opt_in,
        is_simulated=True,
        last_aggregated=model.created_at.strftime("%Y-%m-%d %H:%M:%S UTC"),
        participants_summary=[
            {"code": "COMP-101", "name": "Apex Retail Systems", "samples": 142, "status": "ACTIVE"},
            {"code": "COMP-102", "name": "Nova Logistics Ltd", "samples": 98, "status": "ACTIVE"},
            {"code": "COMP-103", "name": "Zenith Health Care", "samples": 125, "status": "ACTIVE"},
        ],
    )


@router.post("/federated/train-round")
def run_federated_training_round(
    request: FederatedTrainRoundRequest = Body(default_factory=FederatedTrainRoundRequest),
    db: Session = Depends(get_db),
):
    """Triggers an isolated multi-company federated learning simulation round."""
    fed_service = FederatedPaymentService(db)
    result = fed_service.execute_federated_round(
        target_round=request.round_number,
        apply_differential_privacy=request.differential_privacy_noise,
    )
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Deterministic Seeding Endpoint
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/demo/seed")
def seed_demo_scenarios(db: Session = Depends(get_db)):
    """Seeds deterministic fictional company, debtor, and invoice records for testing."""
    from .seed_data import seed_payment_intelligence_demo
    result = seed_payment_intelligence_demo(db)
    return result

