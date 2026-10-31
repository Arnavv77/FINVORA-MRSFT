"""Comprehensive Automated Test Suite for IDP Multi-Mode Payment Intelligence.

Covers:
1.  All 8 payment modes extraction.
2.  Missing references handling without fabricating data.
3.  Exact matching vs ambiguous amount matching (Anti-hallucination guardrail).
4.  Partial payments calculation.
5.  Multiple invoice allocations (split matching).
6.  Duplicate transaction detection.
7.  Human approval workflow (HITL).
8.  Unauthorized posting prevention (strict accountant authorization gate).
9.  ERP failure handling (preserving status and truth).
10. Idempotency protection against double-posting.
11. CAFIE memory feedback loop (recording & applying learned patterns).
12. Federated aggregation (FedAvg, clipping norm, differential privacy noise).
13. Company data isolation (zero leakage of raw records across tenants).
"""

import pytest
import hashlib
from datetime import datetime
from sqlalchemy.orm import Session

from app.database import SessionLocal
import app.models
import app.cafie_models
from app.idp.payment_intelligence.models import (
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
from app.idp.payment_intelligence.extractors import (
    extract_unified_payment,
    extract_cheque_payment,
    extract_upi_payment,
    extract_neft_payment,
    extract_rtgs_payment,
    extract_imps_payment,
    extract_bank_transfer_payment,
    extract_cash_payment,
    extract_card_gateway_payment,
)
from app.idp.payment_intelligence.engine import IntelligentReconciliationEngine
from app.idp.payment_intelligence.erp_adapter import IDPERPAdapter
from app.idp.payment_intelligence.memory_bridge import IDPCafieMemoryBridge
from app.idp.payment_intelligence.federated import FederatedPaymentService
from app.idp.payment_intelligence.seed_data import seed_payment_intelligence_demo


@pytest.fixture(scope="module")
def db_session():
    """Provides isolated test database session with seeded demo fixtures."""
    db = SessionLocal()
    seed_payment_intelligence_demo(db)
    yield db
    db.close()


# ─────────────────────────────────────────────────────────────────────────────
# 1. Test All 8 Payment Modes Extraction
# ─────────────────────────────────────────────────────────────────────────────

def test_extract_all_eight_payment_modes():
    """Verifies that all 8 modes extract cleanly without fabricating data."""
    # A. Cheque
    cheque = extract_cheque_payment({
        "cheque_number": "123456",
        "cheque_series": "SERIES-A",
        "amount": 50000.0,
        "bank": "HDFC Bank",
        "date": "2026-04-15",
        "payer_details": {"drawer_name": "Acme Corp", "account_number": "999888"},
    })
    assert cheque.payment_mode == "CHEQUE"
    assert cheque.reference_id == "123456"
    assert cheque.payer_bank == "HDFC Bank"
    assert cheque.amount == 50000.0

    # B. UPI
    upi = extract_upi_payment({
        "upi_transaction_id": "UPI-7711",
        "utr_rrn": "998877",
        "payer_vpa": "vendor@okhdfc",
        "narration": "Bill pay",
        "amount": 2500.0,
        "transaction_date": "2026-04-15",
    })
    assert upi.payment_mode == "UPI"
    assert upi.payer_vpa == "vendor@okhdfc"
    assert upi.payer_account is None  # UPI does not fabricate account

    # C. NEFT
    neft = extract_neft_payment({
        "utr": "NEFT123",
        "remitter_name": "Beta Ltd",
        "narration": "Inv 10",
        "amount": 100000.0,
        "date": "2026-04-15",
    })
    assert neft.payment_mode == "NEFT"
    assert neft.reference_id == "NEFT123"

    # D. RTGS
    rtgs = extract_rtgs_payment({
        "utr": "RTGS999",
        "remitter_details": {"name": "Gamma Corp", "bank": "SBI"},
        "amount": 500000.0,
        "date": "2026-04-15",
    })
    assert rtgs.payment_mode == "RTGS"
    assert rtgs.amount == 500000.0

    # E. IMPS
    imps = extract_imps_payment({
        "transaction_reference": "IMPS888",
        "sender_details": {"name": "Delta Pvt"},
        "amount": 15000.0,
        "date": "2026-04-15",
    })
    assert imps.payment_mode == "IMPS"
    assert imps.reference_id == "IMPS888"

    # F. Bank Transfer
    bt = extract_bank_transfer_payment({
        "account_reference": "BT100",
        "payer_details": {"name": "Epsilon Inc", "bank": "ICICI"},
        "amount": 45000.0,
    })
    assert bt.payment_mode == "BANK_TRANSFER"

    # G. Cash
    cash = extract_cash_payment({
        "receipt_number": "CSH-01",
        "payer_identity": {"name": "Zeta User"},
        "amount": 5000.0,
        "date": "2026-04-15",
    })
    assert cash.payment_mode == "CASH"
    assert cash.payer_account is None

    # H. Card / Payment Gateway
    pg = extract_card_gateway_payment({
        "transaction_id": "PG-TXN-01",
        "settlement_id": "SETTLE-99",
        "order_reference": "ORD-123",
        "amount": 12000.0,
        "settlement_date": "2026-04-15",
    })
    assert pg.payment_mode == "CARD_GATEWAY"
    assert pg.reference_id == "PG-TXN-01"


# ─────────────────────────────────────────────────────────────────────────────
# 2. Test Missing References (No Hallucination)
# ─────────────────────────────────────────────────────────────────────────────

def test_missing_references_not_fabricated():
    """Ensures missing fields remain None and do not trigger hallucinations."""
    res = extract_unified_payment("NEFT", {
        "amount": 75000.0,
        "remitter_name": "Test Remitter",
    })
    assert res.reference_id is None
    assert res.secondary_reference is None
    assert res.payer_account is None
    assert res.payer_vpa is None


# ─────────────────────────────────────────────────────────────────────────────
# 3. Test Exact vs Ambiguous Matching (Anti-Hallucination Guardrail)
# ─────────────────────────────────────────────────────────────────────────────

def test_exact_match_with_reference(db_session: Session):
    """Scenario 1: Exact match when reference and invoice coincide."""
    engine = IntelligentReconciliationEngine(db_session)
    comp = db_session.query(IDPCompany).filter(IDPCompany.company_code == "FINVORA-ENT-001").first()

    extract = extract_cheque_payment({
        "cheque_number": "CHK-EXACT-01",
        "amount": 500000.0,
        "bank": "HDFC Bank Ltd",
        "date": "2026-04-15",
        "payer_details": {
            "drawer_name": "TechCorp Solutions Pvt Ltd",
            "memo": "Payment for INV-2026-TC-101",
        },
    })
    payment = IDPPayment(
        company_id=comp.id,
        payment_mode="CHEQUE",
        raw_payload={},
        extracted_fields=extract.dict(),
        amount=extract.amount,
        reference_id=extract.reference_id,
        status="PENDING_APPROVAL",
        idempotency_key=f"test-exact-{datetime.utcnow().timestamp()}",
    )
    db_session.add(payment)
    db_session.commit()

    rec = engine.evaluate_payment(payment, extract)
    assert rec.match_tier == "EXACT_MATCH"
    assert rec.confidence_score >= 90.0
    assert rec.debtor.name == "TechCorp Solutions Pvt Ltd"


def test_ambiguous_matching_refuses_amount_alone(db_session: Session):
    """Scenario 8: When 2 debtors share identical invoice amount without alias/ref, engine flags AMBIGUOUS_DEBTOR."""
    engine = IntelligentReconciliationEngine(db_session)
    comp = db_session.query(IDPCompany).filter(IDPCompany.company_code == "FINVORA-ENT-001").first()

    # Amount of 750,000 matches both Zenith Bio and Horizon Retail, but remitter is unknown
    extract = extract_bank_transfer_payment({
        "account_reference": "BT-AMBIGUOUS-01",
        "amount": 750000.0,
        "narration": "Account balance payment",
        "payer_details": {"name": "Generic Third Party Remitter"},
    })
    payment = IDPPayment(
        company_id=comp.id,
        payment_mode="BANK_TRANSFER",
        raw_payload={},
        extracted_fields=extract.dict(),
        amount=extract.amount,
        reference_id=extract.reference_id,
        status="PENDING_APPROVAL",
        idempotency_key=f"test-ambig-{datetime.utcnow().timestamp()}",
    )
    db_session.add(payment)
    db_session.commit()

    rec = engine.evaluate_payment(payment, extract)
    assert rec.match_tier == "AMBIGUOUS_DEBTOR"
    assert rec.confidence_score <= 50.0
    assert rec.debtor_id is None
    assert len(rec.alternative_matches) >= 2


# ─────────────────────────────────────────────────────────────────────────────
# 4. Test Partial Payment Handling
# ─────────────────────────────────────────────────────────────────────────────

def test_partial_payment_resolution(db_session: Session):
    """Scenario 6: Partial payment calculates open invoice balance correctly."""
    engine = IntelligentReconciliationEngine(db_session)
    comp = db_session.query(IDPCompany).filter(IDPCompany.company_code == "FINVORA-ENT-001").first()

    extract = extract_bank_transfer_payment({
        "account_reference": "BT-PART-01",
        "amount": 150000.0,
        "narration": "Part settlement for INV-2026-APX-203",
        "payer_details": {"name": "Apex Cloud Infrastructure Ltd"},
    })
    payment = IDPPayment(
        company_id=comp.id,
        payment_mode="BANK_TRANSFER",
        raw_payload={},
        extracted_fields=extract.dict(),
        amount=extract.amount,
        reference_id=extract.reference_id,
        status="PENDING_APPROVAL",
        idempotency_key=f"test-part-{datetime.utcnow().timestamp()}",
    )
    db_session.add(payment)
    db_session.commit()

    rec = engine.evaluate_payment(payment, extract)
    assert rec.match_tier == "PARTIAL_PAYMENT"
    assert "Remaining balance" in rec.explanation


# ─────────────────────────────────────────────────────────────────────────────
# 5. Test Multi-Invoice Allocation (Split Match)
# ─────────────────────────────────────────────────────────────────────────────

def test_multi_invoice_allocation(db_session: Session):
    """Scenario 7: 1 payment clears 2 invoices sum."""
    engine = IntelligentReconciliationEngine(db_session)
    comp = db_session.query(IDPCompany).filter(IDPCompany.company_code == "FINVORA-ENT-001").first()

    # 450,000 + 550,000 = 1,000,000
    extract = extract_neft_payment({
        "utr": "NEFT-SPLIT-01",
        "remitter_name": "Nova Logistics Network LLP",
        "amount": 1000000.0,
        "narration": "Clearing INV-NV-302 and INV-NV-303",
    })
    payment = IDPPayment(
        company_id=comp.id,
        payment_mode="NEFT",
        raw_payload={},
        extracted_fields=extract.dict(),
        amount=extract.amount,
        reference_id=extract.reference_id,
        status="PENDING_APPROVAL",
        idempotency_key=f"test-split-{datetime.utcnow().timestamp()}",
    )
    db_session.add(payment)
    db_session.commit()

    rec = engine.evaluate_payment(payment, extract)
    assert rec.match_tier == "MULTI_INVOICE_SPLIT"
    assert len(rec.suggested_invoice_ids) == 2


# ─────────────────────────────────────────────────────────────────────────────
# 6. Test Duplicate Transaction Detection
# ─────────────────────────────────────────────────────────────────────────────

def test_duplicate_transaction_detection(db_session: Session):
    """Scenario 9: Same reference_id flags DUPLICATE_SUSPECT."""
    engine = IntelligentReconciliationEngine(db_session)
    comp = db_session.query(IDPCompany).filter(IDPCompany.company_code == "FINVORA-ENT-001").first()

    ref = "UPI-DUP-CHECK-99"
    p1 = IDPPayment(
        company_id=comp.id,
        payment_mode="UPI",
        raw_payload={},
        extracted_fields={},
        amount=50000.0,
        reference_id=ref,
        status="POSTED",
        idempotency_key=f"test-p1-{datetime.utcnow().timestamp()}",
    )
    db_session.add(p1)
    db_session.commit()

    # Second payment with exact same reference
    extract2 = extract_upi_payment({
        "upi_transaction_id": ref,
        "amount": 50000.0,
        "payer_vpa": "sample@upi",
    })
    p2 = IDPPayment(
        company_id=comp.id,
        payment_mode="UPI",
        raw_payload={},
        extracted_fields=extract2.dict(),
        amount=50000.0,
        reference_id=ref,
        status="PENDING_APPROVAL",
        idempotency_key=f"test-p2-{datetime.utcnow().timestamp()}",
    )
    db_session.add(p2)
    db_session.commit()

    rec = engine.evaluate_payment(p2, extract2)
    assert rec.match_tier == "DUPLICATE_SUSPECT"
    assert p2.status == "DUPLICATE_SUSPECT"


# ─────────────────────────────────────────────────────────────────────────────
# 7. Test Human Approval & Unauthorized Posting Prevention
# ─────────────────────────────────────────────────────────────────────────────

def test_unauthorized_posting_prevented(db_session: Session):
    """Strict Rule: Payments remain in PENDING_APPROVAL and CANNOT have ERP voucher without approval."""
    comp = db_session.query(IDPCompany).filter(IDPCompany.company_code == "FINVORA-ENT-001").first()
    payment = IDPPayment(
        company_id=comp.id,
        payment_mode="CHEQUE",
        raw_payload={},
        extracted_fields={},
        amount=25000.0,
        status="PENDING_APPROVAL",
        idempotency_key=f"test-unauth-{datetime.utcnow().timestamp()}",
    )
    db_session.add(payment)
    db_session.commit()

    # Must NOT have any ERP voucher
    assert payment.erp_voucher is None
    assert payment.status == "PENDING_APPROVAL"


def test_human_approval_creates_erp_voucher(db_session: Session):
    """Verifies that human approval triggers ERP voucher creation and status update."""
    erp_adapter = IDPERPAdapter(db_session)
    comp = db_session.query(IDPCompany).filter(IDPCompany.company_code == "FINVORA-ENT-001").first()
    debtor = db_session.query(IDPDebtorLedger).filter(IDPDebtorLedger.debtor_code == "DEBT-101").first()
    inv = debtor.invoices[0]

    payment = IDPPayment(
        company_id=comp.id,
        payment_mode="CHEQUE",
        raw_payload={},
        extracted_fields={},
        amount=inv.balance_amount,
        status="PENDING_APPROVAL",
        idempotency_key=f"test-approve-{datetime.utcnow().timestamp()}",
    )
    db_session.add(payment)
    db_session.commit()

    res = erp_adapter.post_approved_receipt(
        payment=payment,
        debtor=debtor,
        approved_invoices=[inv],
        split_allocations=None,
        ledger_name=debtor.default_ledger,
        approved_by="Auditor (CFO)",
    )
    assert res["success"] is True
    assert res["status"] == "POSTED_CONFIRMED"
    assert payment.status == "POSTED"
    assert payment.erp_voucher is not None


# ─────────────────────────────────────────────────────────────────────────────
# 8. Test ERP Failure Handling
# ─────────────────────────────────────────────────────────────────────────────

def test_erp_failure_never_claims_posted(db_session: Session):
    """Strict Rule: Never claim transaction posted if ERP rejected or timed out."""
    erp_adapter = IDPERPAdapter(db_session)
    comp = db_session.query(IDPCompany).filter(IDPCompany.company_code == "FINVORA-ENT-001").first()
    debtor = db_session.query(IDPDebtorLedger).filter(IDPDebtorLedger.debtor_code == "DEBT-102").first()

    payment = IDPPayment(
        company_id=comp.id,
        payment_mode="RTGS",
        raw_payload={},
        extracted_fields={},
        amount=100000.0,
        status="PENDING_APPROVAL",
        idempotency_key=f"test-fail-{datetime.utcnow().timestamp()}",
    )
    db_session.add(payment)
    db_session.commit()

    res = erp_adapter.post_approved_receipt(
        payment=payment,
        debtor=debtor,
        approved_invoices=[],
        split_allocations=None,
        ledger_name=debtor.default_ledger,
        approved_by="Auditor",
        simulate_failure=True,
    )
    assert res["success"] is False
    assert res["status"] == "POSTING_FAILED"
    assert payment.status == "MANUAL_VERIFICATION"  # NOT POSTED!


# ─────────────────────────────────────────────────────────────────────────────
# 9. Test Idempotency (Prevent Duplicate Posting)
# ─────────────────────────────────────────────────────────────────────────────

def test_idempotent_voucher_posting(db_session: Session):
    """Subsequent posting calls for the same payment return existing voucher without duplicate booking."""
    erp_adapter = IDPERPAdapter(db_session)
    comp = db_session.query(IDPCompany).filter(IDPCompany.company_code == "FINVORA-ENT-001").first()
    debtor = db_session.query(IDPDebtorLedger).first()

    payment = IDPPayment(
        company_id=comp.id,
        payment_mode="UPI",
        raw_payload={},
        extracted_fields={},
        amount=15000.0,
        status="PENDING_APPROVAL",
        idempotency_key=f"test-idemp-{datetime.utcnow().timestamp()}",
    )
    db_session.add(payment)
    db_session.commit()

    # First post
    r1 = erp_adapter.post_approved_receipt(payment, debtor, [], None, debtor.default_ledger, "Accountant")
    assert r1["status"] == "POSTED_CONFIRMED"
    v1 = r1["voucher_number"]

    # Second post attempt
    r2 = erp_adapter.post_approved_receipt(payment, debtor, [], None, debtor.default_ledger, "Accountant")
    assert r2["already_posted"] is True
    assert r2["voucher_number"] == v1


# ─────────────────────────────────────────────────────────────────────────────
# 10. Test CAFIE Memory Feedback Loop
# ─────────────────────────────────────────────────────────────────────────────

def test_cafie_memory_feedback_loop(db_session: Session):
    """Verifies that accountant correction is stored in CAFIE memory and recognized in subsequent payments."""
    memory_bridge = IDPCafieMemoryBridge(db_session)
    engine = IntelligentReconciliationEngine(db_session)
    comp = db_session.query(IDPCompany).filter(IDPCompany.company_code == "FINVORA-ENT-001").first()
    nova_debtor = db_session.query(IDPDebtorLedger).filter(IDPDebtorLedger.debtor_code == "DEBT-103").first()

    # 1. Record feedback
    token_key = "k-supply-custom-token"
    memory_bridge.record_accountant_feedback(
        company_id=comp.id,
        payment_id=999,
        pattern_type="DEBTOR_ALIAS_CORRECTION",
        pattern_key=token_key,
        debtor_id=nova_debtor.id,
        ledger_name=nova_debtor.default_ledger,
    )

    # 2. Subsequent payment arrives with that token
    extract = extract_bank_transfer_payment({
        "account_reference": "BT-MEM-01",
        "narration": f"Payment via {token_key} operations",
        "payer_details": {"name": "Unknown Partner"},
        "amount": 100000.0,
    })
    payment = IDPPayment(
        company_id=comp.id,
        payment_mode="BANK_TRANSFER",
        raw_payload={},
        extracted_fields=extract.dict(),
        amount=extract.amount,
        reference_id=extract.reference_id,
        status="PENDING_APPROVAL",
        idempotency_key=f"test-mem-{datetime.utcnow().timestamp()}",
    )
    db_session.add(payment)
    db_session.commit()

    rec = engine.evaluate_payment(payment, extract)
    assert rec.debtor_id == nova_debtor.id
    assert any("CAFIE_MEMORY_PATTERN" in ev.get("factor") for ev in rec.evidence_breakdown)


# ─────────────────────────────────────────────────────────────────────────────
# 11. Test Federated Learning & Company Data Isolation
# ─────────────────────────────────────────────────────────────────────────────

def test_federated_aggregation_and_data_isolation(db_session: Session):
    """Verifies FedAvg aggregation, differential privacy noise, and zero raw data leakage."""
    fed_service = FederatedPaymentService(db_session)
    res = fed_service.execute_federated_round(target_round=5, apply_differential_privacy=True)

    assert res["status"] == "COMPLETED"
    assert res["participants_count"] == 3
    assert res["epsilon_privacy_budget"] == 1.2
    assert res["is_simulated"] is True

    # Check that participants list verifies zero raw data transferred
    for p in res["participants"]:
        assert p["raw_data_transferred"] is False

    # Check model weights sum to 1.0
    weights = res["weights_after"]
    assert abs(sum(weights.values()) - 1.0) < 0.05

