"""Double-Entry Accounting and Ledger Transaction Service.

Strict Compliance:
- Total Debit == Total Credit check before posting.
- Atomic SQLAlchemy transaction handling.
- Safe Decimal monetary calculations.
- Idempotency & duplicate posting prevention (cannot post twice).
- Separate approval_status (SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, CHANGES_REQUESTED)
  and posting_status (UNPOSTED, POSTED).
- Sequential running balance maintenance.
- Immutable audit and approval history.
"""

from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from .models import (
    LedgerCompany,
    LedgerAccount,
    LedgerTransaction,
    LedgerEntryLine,
    LedgerTransactionApproval,
    LedgerAuditLog,
    LedgerTransactionComment,
)
from .intelligence_engine import FinvoraLedgerIntelligence


class CompanyLedgerService:
    """Enterprise double-entry ledger posting and manager governance service."""

    @classmethod
    def recompute_running_balances(cls, db: Session, company_id: int) -> None:
        """
        Recalculates accurate sequential running balances for all posted transactions.
        Running Balance = Opening Balance + Sum(Credits) - Sum(Debits) for liability accounts,
        or Opening Balance + Sum(Debits) - Sum(Credits) for asset/cash ledger.
        For general company ledger:
        Opening Balance + Net Outflows/Inflows.
        """
        company = db.query(LedgerCompany).filter(LedgerCompany.id == company_id).first()
        if not company:
            return

        txns = (
            db.query(LedgerTransaction)
            .filter(LedgerTransaction.company_id == company_id)
            .order_by(LedgerTransaction.transaction_date.asc(), LedgerTransaction.id.asc())
            .all()
        )

        running = Decimal(str(company.opening_balance))
        total_debit = Decimal("0.00")
        total_credit = Decimal("0.00")

        for t in txns:
            d_amt = Decimal(str(t.debit_amount or 0))
            c_amt = Decimal(str(t.credit_amount or 0))

            if t.posting_status == "POSTED":
                total_debit += d_amt
                total_credit += c_amt
                # Net impact on company ledger cash / asset perspective:
                # If transaction is an outflow payment: cash decreases
                # If transaction is a purchase: liability increases or inventory increases
                if t.voucher_type in ("PAYMENT_VOUCHER", "EXPENSE_VOUCHER"):
                    running -= d_amt
                elif t.voucher_type in ("RECEIPT_VOUCHER", "INCOME_VOUCHER"):
                    running += c_amt
                else:
                    # Purchase voucher / General journal: running reflects total accumulated trade balance
                    running = running - d_amt + c_amt

            t.running_balance = running

        company.current_balance = running
        db.commit()

    @classmethod
    def validate_double_entry_lines(cls, transaction: LedgerTransaction) -> Tuple[bool, str]:
        """Validates that sum(Debits) == sum(Credits) for double-entry integrity."""
        if not transaction.lines or len(transaction.lines) == 0:
            return False, "Transaction has no double-entry journal lines."

        total_debits = sum(Decimal(str(line.amount)) for line in transaction.lines if line.entry_type == "DEBIT")
        total_credits = sum(Decimal(str(line.amount)) for line in transaction.lines if line.entry_type == "CREDIT")

        if total_debits <= Decimal("0.00") or total_credits <= Decimal("0.00"):
            return False, f"Double-entry violation: Journal lines must have positive non-zero entries. Found Debits: {total_debits}, Credits: {total_credits}."

        if total_debits != total_credits:
            return False, f"Double-entry violation: Total debits (INR {total_debits:,.2f}) != Total credits (INR {total_credits:,.2f}). Imbalance: INR {abs(total_debits - total_credits):,.2f}."

        return True, "Double-entry equation holds (Debits == Credits)."

    @classmethod
    def approve_and_post_transaction(
        cls,
        db: Session,
        transaction_id: int,
        manager_id: str,
        manager_name: str,
        remarks: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Manager Approve Action:
        1. Validates transaction is not already posted (idempotency).
        2. Validates double-entry debit-credit consistency.
        3. Updates approval_status='APPROVED', posting_status='POSTED'.
        4. Records manager ID, timestamp, and audit log.
        5. Updates company balance and running balances atomically.
        """
        transaction = db.query(LedgerTransaction).filter(LedgerTransaction.id == transaction_id).first()
        if not transaction:
            raise ValueError(f"Transaction ID {transaction_id} not found.")

        if transaction.posting_status == "POSTED":
            raise ValueError(f"Transaction {transaction.transaction_number} has already been posted to the ledger (Idempotency Lock).")

        # Accounting double entry validation
        valid, msg = cls.validate_double_entry_lines(transaction)
        if not valid:
            raise ValueError(f"Accounting Validation Failed: {msg}")

        prev_status = transaction.approval_status
        now = datetime.utcnow()

        # Update transaction
        transaction.approval_status = "APPROVED"
        transaction.posting_status = "POSTED"
        transaction.manager_remarks = remarks
        transaction.approved_by = f"{manager_name} ({manager_id})"
        transaction.approved_at = now
        transaction.posted_by = f"{manager_name} ({manager_id})"
        transaction.posted_at = now

        # Update Chart of Accounts balances
        for line in transaction.lines:
            if line.account_id:
                acct = db.query(LedgerAccount).filter(LedgerAccount.id == line.account_id).first()
                if acct:
                    line_amt = Decimal(str(line.amount))
                    if acct.normal_balance == line.entry_type:
                        acct.balance = Decimal(str(acct.balance)) + line_amt
                    else:
                        acct.balance = Decimal(str(acct.balance)) - line_amt

        # Add Immutable Approval Record
        approval_rec = LedgerTransactionApproval(
            transaction_id=transaction.id,
            manager_id=manager_id,
            manager_name=manager_name,
            decision="APPROVE",
            remarks=remarks or "Approved for ledger posting.",
            previous_status=prev_status,
            new_status="APPROVED",
            created_at=now,
        )
        db.add(approval_rec)

        # Add Audit Log Entry
        audit_entry = LedgerAuditLog(
            company_id=transaction.company_id,
            transaction_id=transaction.id,
            action="MANAGER_APPROVED_AND_POSTED",
            actor=f"{manager_name} ({manager_id})",
            actor_role="FINANCE_MANAGER",
            details={
                "transaction_number": transaction.transaction_number,
                "voucher_type": transaction.voucher_type,
                "amount": float(transaction.total_amount),
                "remarks": remarks,
                "previous_status": prev_status,
                "new_status": "APPROVED",
                "posting_status": "POSTED",
            },
            created_at=now,
        )
        db.add(audit_entry)

        db.commit()

        # Recalculate running balances sequentially
        cls.recompute_running_balances(db, transaction.company_id)

        # Refresh
        db.refresh(transaction)
        company = db.query(LedgerCompany).filter(LedgerCompany.id == transaction.company_id).first()

        return {
            "success": True,
            "message": f"Transaction '{transaction.transaction_number}' successfully approved by manager and posted to company ledger.",
            "transaction_id": transaction.id,
            "approval_status": transaction.approval_status,
            "posting_status": transaction.posting_status,
            "updated_balance": float(company.current_balance) if company else None,
            "audit_event_id": audit_entry.id,
        }

    @classmethod
    def reject_transaction(
        cls,
        db: Session,
        transaction_id: int,
        manager_id: str,
        manager_name: str,
        rejection_reason: str,
    ) -> Dict[str, Any]:
        """
        Manager Reject Action:
        1. Requires mandatory rejection reason.
        2. Sets approval_status='REJECTED', posting_status='UNPOSTED'.
        3. Records manager ID, timestamp, and immutable audit logs.
        4. Keeps transaction and history fully visible (never silently deleted).
        """
        transaction = db.query(LedgerTransaction).filter(LedgerTransaction.id == transaction_id).first()
        if not transaction:
            raise ValueError(f"Transaction ID {transaction_id} not found.")

        if transaction.posting_status == "POSTED":
            raise ValueError("Cannot reject an already posted transaction. An authorized reversal adjustment entry is required.")

        if not rejection_reason or len(rejection_reason.strip()) < 5:
            raise ValueError("Rejection requires an explicit justification explanation (minimum 5 characters).")

        prev_status = transaction.approval_status
        now = datetime.utcnow()

        transaction.approval_status = "REJECTED"
        transaction.rejection_reason = rejection_reason.strip()
        transaction.rejected_by = f"{manager_name} ({manager_id})"
        transaction.rejected_at = now
        transaction.manager_remarks = f"REJECTED: {rejection_reason.strip()}"

        # Immutable Approval Record
        approval_rec = LedgerTransactionApproval(
            transaction_id=transaction.id,
            manager_id=manager_id,
            manager_name=manager_name,
            decision="REJECT",
            remarks=rejection_reason.strip(),
            previous_status=prev_status,
            new_status="REJECTED",
            created_at=now,
        )
        db.add(approval_rec)

        # Audit Log
        audit_entry = LedgerAuditLog(
            company_id=transaction.company_id,
            transaction_id=transaction.id,
            action="MANAGER_REJECTED",
            actor=f"{manager_name} ({manager_id})",
            actor_role="FINANCE_MANAGER",
            details={
                "transaction_number": transaction.transaction_number,
                "amount": float(transaction.total_amount),
                "rejection_reason": rejection_reason.strip(),
                "previous_status": prev_status,
                "new_status": "REJECTED",
            },
            created_at=now,
        )
        db.add(audit_entry)

        db.commit()
        db.refresh(transaction)

        return {
            "success": True,
            "message": f"Transaction '{transaction.transaction_number}' rejected. Status updated to REJECTED and preserved in audit trail.",
            "transaction_id": transaction.id,
            "approval_status": transaction.approval_status,
            "posting_status": transaction.posting_status,
            "audit_event_id": audit_entry.id,
        }

    @classmethod
    def request_changes_transaction(
        cls,
        db: Session,
        transaction_id: int,
        manager_id: str,
        manager_name: str,
        remarks: str,
    ) -> Dict[str, Any]:
        """
        Manager Request Changes Action:
        1. Requires explanation of what needs correction.
        2. Sets approval_status='CHANGES_REQUESTED'.
        3. Preserves all history and allows accountant resubmission.
        """
        transaction = db.query(LedgerTransaction).filter(LedgerTransaction.id == transaction_id).first()
        if not transaction:
            raise ValueError(f"Transaction ID {transaction_id} not found.")

        if transaction.posting_status == "POSTED":
            raise ValueError("Cannot request changes on an already posted transaction.")

        if not remarks or len(remarks.strip()) < 5:
            raise ValueError("Requesting changes requires an explicit explanation of required corrections (minimum 5 characters).")

        prev_status = transaction.approval_status
        now = datetime.utcnow()

        transaction.approval_status = "CHANGES_REQUESTED"
        transaction.changes_requested_remarks = remarks.strip()
        transaction.changes_requested_by = f"{manager_name} ({manager_id})"
        transaction.changes_requested_at = now
        transaction.manager_remarks = f"CHANGES REQUESTED: {remarks.strip()}"

        # Immutable Approval Record
        approval_rec = LedgerTransactionApproval(
            transaction_id=transaction.id,
            manager_id=manager_id,
            manager_name=manager_name,
            decision="REQUEST_CHANGES",
            remarks=remarks.strip(),
            previous_status=prev_status,
            new_status="CHANGES_REQUESTED",
            created_at=now,
        )
        db.add(approval_rec)

        # Audit Log
        audit_entry = LedgerAuditLog(
            company_id=transaction.company_id,
            transaction_id=transaction.id,
            action="MANAGER_REQUESTED_CHANGES",
            actor=f"{manager_name} ({manager_id})",
            actor_role="FINANCE_MANAGER",
            details={
                "transaction_number": transaction.transaction_number,
                "amount": float(transaction.total_amount),
                "remarks": remarks.strip(),
                "previous_status": prev_status,
                "new_status": "CHANGES_REQUESTED",
            },
            created_at=now,
        )
        db.add(audit_entry)

        db.commit()
        db.refresh(transaction)

        return {
            "success": True,
            "message": f"Changes requested on transaction '{transaction.transaction_number}'. Sent back to accounting queue for correction.",
            "transaction_id": transaction.id,
            "approval_status": transaction.approval_status,
            "posting_status": transaction.posting_status,
            "audit_event_id": audit_entry.id,
        }

    @classmethod
    def resubmit_transaction(
        cls,
        db: Session,
        transaction_id: int,
        accountant_id: str,
        accountant_name: str,
        resubmission_notes: str,
        invoice_amount: Optional[float] = None,
        po_amount: Optional[float] = None,
        grn_amount: Optional[float] = None,
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Accountant Resubmit Action:
        1. Updates corrected values.
        2. Sets approval_status='UNDER_REVIEW'.
        3. Increments resubmission_count.
        4. Re-runs FINVORA intelligence analysis.
        5. Logs audit trail.
        """
        transaction = db.query(LedgerTransaction).filter(LedgerTransaction.id == transaction_id).first()
        if not transaction:
            raise ValueError(f"Transaction ID {transaction_id} not found.")

        if transaction.posting_status == "POSTED":
            raise ValueError("Cannot resubmit an already posted transaction.")

        prev_status = transaction.approval_status
        now = datetime.utcnow()

        if invoice_amount is not None:
            new_amt = Decimal(str(invoice_amount))
            transaction.invoice_amount = new_amt
            transaction.total_amount = new_amt
            if transaction.voucher_type == "PURCHASE_VOUCHER":
                transaction.credit_amount = new_amt
                transaction.debit_amount = new_amt
                # Also balance lines if 2 exist
                if transaction.lines and len(transaction.lines) == 2:
                    transaction.lines[0].amount = new_amt
                    transaction.lines[1].amount = new_amt

        if po_amount is not None:
            transaction.po_amount = Decimal(str(po_amount))
        if grn_amount is not None:
            transaction.grn_amount = Decimal(str(grn_amount))
        if description is not None:
            transaction.description = description

        transaction.approval_status = "UNDER_REVIEW"
        transaction.resubmission_count = (transaction.resubmission_count or 0) + 1

        # Re-run FINVORA Intelligence Analysis on corrected data
        tier, score, reasons, rec = FinvoraLedgerIntelligence.analyze_transaction(
            db=db,
            company_id=transaction.company_id,
            transaction=transaction,
        )
        transaction.finvora_risk_tier = tier
        transaction.finvora_risk_score = score
        transaction.finvora_risk_reasons = reasons
        transaction.finvora_recommendation = rec

        # Add comment / approval log
        approval_rec = LedgerTransactionApproval(
            transaction_id=transaction.id,
            manager_id=accountant_id,
            manager_name=accountant_name,
            decision="RESUBMIT",
            remarks=resubmission_notes.strip(),
            previous_status=prev_status,
            new_status="UNDER_REVIEW",
            created_at=now,
        )
        db.add(approval_rec)

        # Audit Log
        audit_entry = LedgerAuditLog(
            company_id=transaction.company_id,
            transaction_id=transaction.id,
            action="ACCOUNTANT_RESUBMITTED",
            actor=f"{accountant_name} ({accountant_id})",
            actor_role="SENIOR_ACCOUNTANT",
            details={
                "resubmission_notes": resubmission_notes.strip(),
                "resubmission_count": transaction.resubmission_count,
                "reanalyzed_risk_tier": tier,
                "reanalyzed_risk_score": float(score),
            },
            created_at=now,
        )
        db.add(audit_entry)

        db.commit()
        db.refresh(transaction)

        return {
            "success": True,
            "message": f"Transaction '{transaction.transaction_number}' corrected and resubmitted for manager review.",
            "transaction_id": transaction.id,
            "approval_status": transaction.approval_status,
            "posting_status": transaction.posting_status,
            "audit_event_id": audit_entry.id,
        }
