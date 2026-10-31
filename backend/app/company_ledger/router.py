"""FastAPI Router for FINVORA Company Ledger & Manager Approval Workflow.

API Endpoints:
- GET  /api/company-ledger/companies
- GET  /api/company-ledger/companies/{company_id}/summary
- GET  /api/company-ledger/companies/{company_id}/ledger
- GET  /api/company-ledger/transactions/{transaction_id}
- POST /api/company-ledger/transactions/{transaction_id}/approve
- POST /api/company-ledger/transactions/{transaction_id}/reject
- POST /api/company-ledger/transactions/{transaction_id}/request-changes
- POST /api/company-ledger/transactions/{transaction_id}/resubmit
- GET  /api/company-ledger/transactions/{transaction_id}/audit-history
- POST /api/company-ledger/seed-demo
"""

from __future__ import annotations
from datetime import date
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, and_

from app.database import get_db
from .models import (
    LedgerCompany,
    LedgerAccount,
    LedgerTransaction,
    LedgerEntryLine,
    LedgerTransactionApproval,
    LedgerAuditLog,
)
from .schemas import (
    LedgerCompanyOut,
    CompanyLedgerSummary,
    LedgerTransactionItem,
    LedgerTransactionDetail,
    ManagerApproveRequest,
    ManagerRejectRequest,
    ManagerRequestChangesRequest,
    AccountantResubmitRequest,
    ActionResponse,
    LedgerEntryLineSchema,
)
from .ledger_service import CompanyLedgerService
from .seed_data import seed_company_ledger_demo

router = APIRouter(prefix="/api/company-ledger", tags=["FINVORA Company Ledger & Approvals"])


def verify_manager_role(x_user_role: Optional[str] = Header(None)) -> str:
    """
    Role-based access control verifying manager authorization.
    In demo / development mode, default to authorized 'manager' unless forbidden.
    """
    role = (x_user_role or "manager").lower()
    if role not in ("manager", "cfo", "admin", "finance_manager"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Only users with the Finance Manager role can approve, reject, or request changes on company transactions.",
        )
    return role


# ── 1. Fetch Companies ───────────────────────────────────────────────────────

@router.get("/companies", response_model=List[LedgerCompanyOut])
def get_companies(db: Session = Depends(get_db)):
    """Fetches all registered companies with their financial year and balances."""
    companies = db.query(LedgerCompany).order_by(LedgerCompany.id.asc()).all()
    if not companies:
        # Auto seed initial demo company if none exist
        seed_company_ledger_demo(db)
        companies = db.query(LedgerCompany).order_by(LedgerCompany.id.asc()).all()
    return companies


# ── 2. Company Ledger Summary ────────────────────────────────────────────────

@router.get("/companies/{company_id}/summary", response_model=CompanyLedgerSummary)
def get_company_summary(company_id: int, db: Session = Depends(get_db)):
    """Computes opening balance, total debits, total credits, closing balance, and status breakdown."""
    company = db.query(LedgerCompany).filter(LedgerCompany.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Fetch all transactions for this company
    txns = db.query(LedgerTransaction).filter(LedgerTransaction.company_id == company_id).all()

    total_debit = Decimal("0.00")
    total_credit = Decimal("0.00")
    pending_count = 0
    approved_count = 0
    rejected_count = 0
    changes_count = 0
    posted_count = 0

    for t in txns:
        if t.posting_status == "POSTED":
            total_debit += Decimal(str(t.debit_amount or 0))
            total_credit += Decimal(str(t.credit_amount or 0))
            posted_count += 1

        if t.approval_status in ("SUBMITTED", "UNDER_REVIEW"):
            pending_count += 1
        elif t.approval_status == "APPROVED":
            approved_count += 1
        elif t.approval_status == "REJECTED":
            rejected_count += 1
        elif t.approval_status == "CHANGES_REQUESTED":
            changes_count += 1

    return CompanyLedgerSummary(
        company_id=company.id,
        company_code=company.company_code,
        company_name=company.name,
        financial_year=company.financial_year,
        currency=company.currency or "INR",
        opening_balance=float(company.opening_balance),
        total_debit=float(total_debit),
        total_credit=float(total_credit),
        closing_balance=float(company.current_balance),
        total_transactions=len(txns),
        pending_approvals=pending_count,
        approved_transactions=approved_count,
        rejected_transactions=rejected_count,
        changes_requested_transactions=changes_count,
        posted_transactions=posted_count,
    )


# ── 3. Fetch Company Ledger Transactions ─────────────────────────────────────

@router.get("/companies/{company_id}/ledger", response_model=List[LedgerTransactionItem])
def get_company_ledger(
    company_id: int,
    search: Optional[str] = Query(None, description="Search by transaction number, reference, vendor, or account"),
    voucher_type: Optional[str] = Query(None, description="Filter by voucher type"),
    status: Optional[str] = Query(None, description="Filter by approval status"),
    start_date: Optional[date] = Query(None, description="Filter start date"),
    end_date: Optional[date] = Query(None, description="Filter end date"),
    db: Session = Depends(get_db),
):
    """Fetches filtered ledger transactions with running balance and manager remarks."""
    query = db.query(LedgerTransaction).filter(LedgerTransaction.company_id == company_id)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                LedgerTransaction.transaction_number.ilike(s),
                LedgerTransaction.reference_no.ilike(s),
                LedgerTransaction.entity_name.ilike(s),
                LedgerTransaction.ledger_account_name.ilike(s),
                LedgerTransaction.description.ilike(s),
            )
        )

    if voucher_type and voucher_type != "ALL":
        query = query.filter(LedgerTransaction.voucher_type == voucher_type)

    if status and status != "ALL":
        query = query.filter(LedgerTransaction.approval_status == status)

    if start_date:
        query = query.filter(LedgerTransaction.transaction_date >= start_date)

    if end_date:
        query = query.filter(LedgerTransaction.transaction_date <= end_date)

    txns = query.order_by(desc(LedgerTransaction.transaction_date), desc(LedgerTransaction.id)).all()

    return [
        LedgerTransactionItem(
            id=t.id,
            transaction_number=t.transaction_number,
            transaction_date=t.transaction_date,
            voucher_type=t.voucher_type,
            reference_no=t.reference_no,
            entity_name=t.entity_name,
            entity_code=t.entity_code,
            ledger_account_name=t.ledger_account_name,
            description=t.description,
            total_amount=float(t.total_amount),
            debit_amount=float(t.debit_amount),
            credit_amount=float(t.credit_amount),
            running_balance=float(t.running_balance),
            approval_status=t.approval_status,
            posting_status=t.posting_status,
            manager_remarks=t.manager_remarks,
            finvora_risk_tier=t.finvora_risk_tier,
            finvora_risk_score=float(t.finvora_risk_score),
            is_demo=t.is_demo,
        )
        for t in txns
    ]


# ── 4. Fetch Transaction Details (Complete 360-degree Journey) ───────────────

@router.get("/transactions/{transaction_id}", response_model=LedgerTransactionDetail)
def get_transaction_details(transaction_id: int, db: Session = Depends(get_db)):
    """Fetches full transaction journey including PO, Invoice, GRN, lines, FINVORA analysis, and audit trail."""
    t = db.query(LedgerTransaction).filter(LedgerTransaction.id == transaction_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found")

    company = db.query(LedgerCompany).filter(LedgerCompany.id == t.company_id).first()

    lines_data = [
        LedgerEntryLineSchema(
            id=line.id,
            account_id=line.account_id,
            account_name=line.account_name,
            entry_type=line.entry_type,
            amount=float(line.amount),
            narration=line.narration,
        )
        for line in t.lines
    ]

    approvals_data = [
        {
            "id": a.id,
            "manager_id": a.manager_id,
            "manager_name": a.manager_name,
            "decision": a.decision,
            "remarks": a.remarks,
            "previous_status": a.previous_status,
            "new_status": a.new_status,
            "created_at": a.created_at.isoformat(),
        }
        for a in t.approvals
    ]

    audit_data = [
        {
            "id": l.id,
            "action": l.action,
            "actor": l.actor,
            "actor_role": l.actor_role,
            "details": l.details,
            "created_at": l.created_at.isoformat(),
        }
        for l in t.audit_logs
    ]

    comments_data = [
        {
            "id": c.id,
            "author": c.author,
            "role": c.role,
            "comment": c.comment,
            "created_at": c.created_at.isoformat(),
        }
        for c in t.comments
    ]

    return LedgerTransactionDetail(
        id=t.id,
        company_id=t.company_id,
        company_code=company.company_code if company else "N/A",
        company_name=company.name if company else "N/A",
        transaction_number=t.transaction_number,
        voucher_type=t.voucher_type,
        transaction_date=t.transaction_date,
        reference_no=t.reference_no,
        entity_type=t.entity_type,
        entity_name=t.entity_name,
        entity_code=t.entity_code,
        ledger_account_name=t.ledger_account_name,
        description=t.description,
        total_amount=float(t.total_amount),
        debit_amount=float(t.debit_amount),
        credit_amount=float(t.credit_amount),
        running_balance=float(t.running_balance),
        approval_status=t.approval_status,
        posting_status=t.posting_status,
        manager_remarks=t.manager_remarks,
        approved_by=t.approved_by,
        approved_at=t.approved_at,
        rejected_by=t.rejected_by,
        rejected_at=t.rejected_at,
        rejection_reason=t.rejection_reason,
        changes_requested_by=t.changes_requested_by,
        changes_requested_at=t.changes_requested_at,
        changes_requested_remarks=t.changes_requested_remarks,
        posted_by=t.posted_by,
        posted_at=t.posted_at,
        resubmission_count=t.resubmission_count or 0,
        po_number=t.po_number,
        po_amount=float(t.po_amount) if t.po_amount is not None else None,
        invoice_number=t.invoice_number,
        invoice_amount=float(t.invoice_amount) if t.invoice_amount is not None else None,
        grn_number=t.grn_number,
        grn_amount=float(t.grn_amount) if t.grn_amount is not None else None,
        payment_terms=t.payment_terms,
        supporting_documents=t.supporting_documents or [],
        finvora_risk_tier=t.finvora_risk_tier,
        finvora_risk_score=float(t.finvora_risk_score),
        finvora_risk_reasons=t.finvora_risk_reasons or [],
        finvora_recommendation=t.finvora_recommendation,
        lines=lines_data,
        approvals=approvals_data,
        audit_logs=audit_data,
        comments=comments_data,
        is_demo=t.is_demo,
        created_at=t.created_at,
    )


# ── 5. Manager Approve & Post ────────────────────────────────────────────────

@router.post("/transactions/{transaction_id}/approve", response_model=ActionResponse)
def approve_transaction(
    transaction_id: int,
    req: ManagerApproveRequest,
    _role: str = Depends(verify_manager_role),
    db: Session = Depends(get_db),
):
    """
    Manager Action: Approve & Post Transaction to Ledger.
    Validates double-entry accounting lines and posts idempotently.
    """
    try:
        res = CompanyLedgerService.approve_and_post_transaction(
            db=db,
            transaction_id=transaction_id,
            manager_id=req.manager_id,
            manager_name=req.manager_name,
            remarks=req.remarks,
        )
        return ActionResponse(**res)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to approve transaction: {str(e)}")


# ── 6. Manager Reject ────────────────────────────────────────────────────────

@router.post("/transactions/{transaction_id}/reject", response_model=ActionResponse)
def reject_transaction(
    transaction_id: int,
    req: ManagerRejectRequest,
    _role: str = Depends(verify_manager_role),
    db: Session = Depends(get_db),
):
    """
    Manager Action: Reject Transaction.
    Requires mandatory rejection reason; keeps record visible in audit history.
    """
    try:
        res = CompanyLedgerService.reject_transaction(
            db=db,
            transaction_id=transaction_id,
            manager_id=req.manager_id,
            manager_name=req.manager_name,
            rejection_reason=req.rejection_reason,
        )
        return ActionResponse(**res)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reject transaction: {str(e)}")


# ── 7. Manager Request Changes ───────────────────────────────────────────────

@router.post("/transactions/{transaction_id}/request-changes", response_model=ActionResponse)
def request_changes(
    transaction_id: int,
    req: ManagerRequestChangesRequest,
    _role: str = Depends(verify_manager_role),
    db: Session = Depends(get_db),
):
    """
    Manager Action: Request Changes.
    Explains corrections needed and routes back to accountant queue.
    """
    try:
        res = CompanyLedgerService.request_changes_transaction(
            db=db,
            transaction_id=transaction_id,
            manager_id=req.manager_id,
            manager_name=req.manager_name,
            remarks=req.remarks,
        )
        return ActionResponse(**res)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to request changes: {str(e)}")


# ── 8. Accountant Resubmit Corrected Transaction ─────────────────────────────

@router.post("/transactions/{transaction_id}/resubmit", response_model=ActionResponse)
def resubmit_transaction(
    transaction_id: int,
    req: AccountantResubmitRequest,
    db: Session = Depends(get_db),
):
    """
    Accountant Action: Resubmit corrected transaction.
    Re-runs FINVORA intelligence analysis and changes status to UNDER_REVIEW.
    """
    try:
        res = CompanyLedgerService.resubmit_transaction(
            db=db,
            transaction_id=transaction_id,
            accountant_id=req.accountant_id,
            accountant_name=req.accountant_name,
            resubmission_notes=req.resubmission_notes,
            invoice_amount=req.invoice_amount,
            po_amount=req.po_amount,
            grn_amount=req.grn_amount,
            description=req.description,
        )
        return ActionResponse(**res)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resubmit transaction: {str(e)}")


# ── 9. Fetch Audit History ───────────────────────────────────────────────────

@router.get("/transactions/{transaction_id}/audit-history")
def get_audit_history(transaction_id: int, db: Session = Depends(get_db)):
    """Fetches immutable chronological audit logs and decisions for a transaction."""
    logs = (
        db.query(LedgerAuditLog)
        .filter(LedgerAuditLog.transaction_id == transaction_id)
        .order_by(desc(LedgerAuditLog.created_at))
        .all()
    )
    approvals = (
        db.query(LedgerTransactionApproval)
        .filter(LedgerTransactionApproval.transaction_id == transaction_id)
        .order_by(desc(LedgerTransactionApproval.created_at))
        .all()
    )
    return {
        "transaction_id": transaction_id,
        "audit_logs": [
            {
                "id": l.id,
                "action": l.action,
                "actor": l.actor,
                "actor_role": l.actor_role,
                "details": l.details,
                "created_at": l.created_at.isoformat(),
            }
            for l in logs
        ],
        "decisions": [
            {
                "id": a.id,
                "manager_name": a.manager_name,
                "decision": a.decision,
                "remarks": a.remarks,
                "previous_status": a.previous_status,
                "new_status": a.new_status,
                "created_at": a.created_at.isoformat(),
            }
            for a in approvals
        ],
    }


# ── 10. Seed Demo Data Endpoint ──────────────────────────────────────────────

@router.post("/seed-demo")
@router.post("/demo/seed")
def seed_demo(db: Session = Depends(get_db)):
    """Resets and seeds clean deterministic demo company & test scenarios."""
    company = seed_company_ledger_demo(db)
    return {
        "success": True,
        "message": f"Successfully seeded demo company '{company.name}' ({company.company_code}) with 5 test transactions.",
        "company_id": company.id,
        "company_code": company.company_code,
    }
