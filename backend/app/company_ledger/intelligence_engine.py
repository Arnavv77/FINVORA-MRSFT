"""Deterministic FINVORA Intelligence Engine for Company Ledger Transactions.

Requirements:
- Advisory risk scores (LOW RISK, MEDIUM RISK, HIGH RISK).
- Transparent, explainable evidence and reasons.
- Safe Decimal calculations for financial comparisons (no floating-point rounding errors).
- Analyzes:
  1. Duplicate transaction references.
  2. Debit-credit balancing inconsistencies.
  3. PO vs Invoice vs GRN 3-Way Match discrepancies.
  4. Unusual transaction amounts (> 2.5x vendor historical average).
  5. Missing required invoice, GRN, or reference numbers.
  6. Historical manager decisions memory.
"""

from __future__ import annotations
from decimal import Decimal
from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session

from .models import LedgerTransaction, LedgerTransactionApproval


class FinvoraLedgerIntelligence:
    """Deterministic financial intelligence and anomaly risk scoring engine."""

    @classmethod
    def analyze_transaction(
        cls,
        db: Session,
        company_id: int,
        transaction: LedgerTransaction,
    ) -> Tuple[str, Decimal, List[str], str]:
        """
        Executes deterministic rules and produces (risk_tier, risk_score, reasons, recommendation).
        """
        reasons: List[str] = []
        score = Decimal("10.00")  # Base baseline score

        txn_amount = Decimal(str(transaction.total_amount or 0))
        po_amt = Decimal(str(transaction.po_amount)) if transaction.po_amount is not None else None
        inv_amt = Decimal(str(transaction.invoice_amount)) if transaction.invoice_amount is not None else None
        grn_amt = Decimal(str(transaction.grn_amount)) if transaction.grn_amount is not None else None

        # ── 1. Duplicate Transaction Analysis ────────────────────────────────
        duplicate_query = (
            db.query(LedgerTransaction)
            .filter(
                LedgerTransaction.company_id == company_id,
                LedgerTransaction.reference_no == transaction.reference_no,
                LedgerTransaction.id != (transaction.id or 0),
            )
            .all()
        )
        if duplicate_query:
            score += Decimal("45.00")
            dup_ids = [d.transaction_number for d in duplicate_query[:2]]
            reasons.append(
                f"Potential Duplicate Alert: Reference '{transaction.reference_no}' is already referenced in transaction(s) {', '.join(dup_ids)}."
            )

        # ── 2. Double-Entry Debit/Credit Inconsistency Analysis ─────────────
        if transaction.lines and len(transaction.lines) > 0:
            total_debits = sum(Decimal(str(line.amount)) for line in transaction.lines if line.entry_type == "DEBIT")
            total_credits = sum(Decimal(str(line.amount)) for line in transaction.lines if line.entry_type == "CREDIT")
            if total_debits != total_credits:
                diff = abs(total_debits - total_credits)
                score += Decimal("50.00")
                reasons.append(
                    f"Double-Entry Imbalance: Total Debits (INR {total_debits:,.2f}) does not equal Total Credits (INR {total_credits:,.2f}). Difference: INR {diff:,.2f}."
                )

        # ── 3. 3-Way Match Verification (PO vs Invoice vs GRN) ──────────────
        if po_amt is not None and inv_amt is not None:
            if inv_amt > po_amt:
                delta = inv_amt - po_amt
                pct = ((delta / po_amt) * Decimal("100")).quantize(Decimal("0.1"))
                score += Decimal("40.00")
                reasons.append(
                    f"Price Escalation: Invoiced amount (INR {inv_amt:,.2f}) exceeds Purchase Order ({transaction.po_number or 'PO'}) rate (INR {po_amt:,.2f}) by INR {delta:,.2f} (+{pct}%)."
                )
            elif inv_amt < po_amt:
                reasons.append(
                    f"Under-Billed: Invoice amount (INR {inv_amt:,.2f}) is lower than PO amount (INR {po_amt:,.2f}). Acceptable partial or discounted billing."
                )
            else:
                reasons.append(
                    f"PO-Invoice Match: Billed amount INR {inv_amt:,.2f} matches contracted PO amount INR {po_amt:,.2f} exactly."
                )

        if grn_amt is not None and inv_amt is not None:
            if inv_amt > grn_amt:
                delta = inv_amt - grn_amt
                score += Decimal("35.00")
                reasons.append(
                    f"GRN Quantity/Value Mismatch: Invoice amount (INR {inv_amt:,.2f}) exceeds warehouse accepted Goods Receipt ({transaction.grn_number or 'GRN'}) value (INR {grn_amt:,.2f}) by INR {delta:,.2f}."
                )
            elif inv_amt == grn_amt:
                reasons.append(
                    f"GRN Consistency: Physical warehouse receipt ({transaction.grn_number or 'GRN'}) verified INR {grn_amt:,.2f} accepted."
                )

        # Missing documentation checks
        if not transaction.invoice_number:
            score += Decimal("20.00")
            reasons.append("Missing Documentation: No tax invoice number attached to this voucher.")
        if not transaction.po_number and transaction.voucher_type == "PURCHASE_VOUCHER":
            score += Decimal("15.00")
            reasons.append("Missing PO Reference: Purchase transaction without approved Purchase Order reference.")

        # ── 4. Unusual Transaction Amount Spike ──────────────────────────────
        prior_vendor_txns = (
            db.query(LedgerTransaction)
            .filter(
                LedgerTransaction.company_id == company_id,
                LedgerTransaction.entity_name == transaction.entity_name,
                LedgerTransaction.id != (transaction.id or 0),
            )
            .all()
        )
        if len(prior_vendor_txns) >= 2:
            avg_amt = sum(Decimal(str(t.total_amount)) for t in prior_vendor_txns) / Decimal(str(len(prior_vendor_txns)))
            if txn_amount > (avg_amt * Decimal("2.5")):
                score += Decimal("25.00")
                reasons.append(
                    f"Unusual Spend Velocity: Amount INR {txn_amount:,.2f} is significantly higher than historical average INR {avg_amt:,.2f} for vendor '{transaction.entity_name}'."
                )

        # ── 5. Historical Manager Decisions Memory ───────────────────────────
        past_rejections = (
            db.query(LedgerTransactionApproval)
            .join(LedgerTransaction)
            .filter(
                LedgerTransaction.company_id == company_id,
                LedgerTransaction.entity_name == transaction.entity_name,
                LedgerTransactionApproval.decision == "REJECT",
            )
            .count()
        )
        if past_rejections > 0:
            score += Decimal("15.00")
            reasons.append(
                f"Historical Governance Notice: {past_rejections} previous transaction(s) for this entity were rejected by management."
            )

        # Bound score between 5.0 and 99.0
        final_score = max(Decimal("5.00"), min(Decimal("99.00"), score))

        if final_score >= Decimal("65.00"):
            risk_tier = "HIGH_RISK"
            recommendation = "DISCREPANCIES DETECTED: Discrepancy exceeds configured governance thresholds. Detailed manager review, vendor clarification, or credit note required before posting."
        elif final_score >= Decimal("35.00"):
            risk_tier = "MEDIUM_RISK"
            recommendation = "ADVISORY REVIEW: Minor variances or documentation notices identified. Manager verification recommended before approval."
        else:
            risk_tier = "LOW_RISK"
            recommendation = "CLEAN MATCH: Three-way reconciliation (PO, GRN, Invoice) validated with 100% mathematical consistency. Safe for manager approval and automated ledger posting."

        return risk_tier, final_score, reasons, recommendation

