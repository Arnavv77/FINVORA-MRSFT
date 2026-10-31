"""Intelligent Reconciliation Engine for FINVORA IDP.

Unified matching engine analyzing:
- Amount
- Transaction references (UTR, Cheque No, RRN, Order Ref)
- Cheque numbers and series
- Payer identity, VPAs, and bank accounts
- Customer aliases & token matching
- Transaction narrations
- Outstanding invoice balances
- Historical CAFIE memory relationships

STRICT GOVERNANCE RULES:
- Never identify debtors from amount alone.
- Handle exact, partial, 1-to-many, many-to-1, advance, overpayment, duplicate, ambiguous, and unidentified.
- Generate explainable confidence scores and itemized evidence for every recommendation.
"""

from __future__ import annotations
import re
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import desc

from .models import (
    IDPPayment,
    IDPDebtorLedger,
    IDPInvoice,
    IDPReconciliationRecommendation,
)
from .schemas import UnifiedPaymentExtract, EvidenceItem, AlternativeMatch
from .memory_bridge import IDPCafieMemoryBridge
from .federated import FederatedPaymentService

logger = logging.getLogger("finvora.idp.engine")


class IntelligentReconciliationEngine:
    """Core reconciliation engine matching payments across all 8 payment modes."""

    def __init__(self, db: Session):
        self.db = db
        self.memory_bridge = IDPCafieMemoryBridge(db)
        self.federated_service = FederatedPaymentService(db)

    def evaluate_payment(
        self,
        payment: IDPPayment,
        extract: UnifiedPaymentExtract,
    ) -> IDPReconciliationRecommendation:
        """Evaluates extracted payment against debtor ledgers and invoices to generate a recommendation."""
        company_id = payment.company_id
        amount = extract.amount

        # ─────────────────────────────────────────────────────────────────────
        # RULE 1: Duplicate Detection
        # ─────────────────────────────────────────────────────────────────────
        if extract.reference_id and len(extract.reference_id) >= 4:
            duplicate_existing = (
                self.db.query(IDPPayment)
                .filter(
                    IDPPayment.company_id == company_id,
                    IDPPayment.reference_id == extract.reference_id,
                    IDPPayment.id != payment.id,
                )
                .first()
            )
            if duplicate_existing:
                evidence = [
                    EvidenceItem(
                        factor="DUPLICATE_REFERENCE_DETECTED",
                        description=f"Reference '{extract.reference_id}' was already recorded in Payment #{duplicate_existing.id}.",
                        weight=50.0,
                        verified=True,
                    ),
                    EvidenceItem(
                        factor="AMOUNT_MATCH",
                        description=f"Duplicate amount ₹{amount:,.2f} matches previous entry ₹{duplicate_existing.amount:,.2f}.",
                        weight=30.0,
                        verified=True,
                    ),
                    EvidenceItem(
                        factor="RISK_FLAG",
                        description="Potential double-posting hazard. Verification required before ERP booking.",
                        weight=20.0,
                        verified=True,
                    ),
                ]
                rec = IDPReconciliationRecommendation(
                    payment_id=payment.id,
                    debtor_id=None,
                    suggested_invoice_ids=[],
                    suggested_ledger="Duplicate Suspense Ledger",
                    confidence_score=96.0,
                    match_tier="DUPLICATE_SUSPECT",
                    explanation=(
                        f"DUPLICATE TRANSACTION SUSPECT: Instrument / UTR reference '{extract.reference_id}' "
                        f"was previously recorded in Payment #{duplicate_existing.id} for ₹{duplicate_existing.amount:,.2f} "
                        f"on {duplicate_existing.payment_date.strftime('%Y-%m-%d') if hasattr(duplicate_existing.payment_date, 'strftime') else duplicate_existing.payment_date}. "
                        "Do not approve without verifying bank statement."
                    ),
                    evidence_breakdown=[e.dict() for e in evidence],
                    alternative_matches=[],
                )
                payment.status = "DUPLICATE_SUSPECT"
                self.db.add(rec)
                self.db.commit()
                self.db.refresh(rec)
                return rec

        # ─────────────────────────────────────────────────────────────────────
        # RULE 2: CAFIE Memory Pattern Lookup
        # ─────────────────────────────────────────────────────────────────────
        search_keys = [
            extract.narration,
            extract.payer_vpa,
            extract.payer_name,
            extract.payer_account,
        ]
        memory_match = self.memory_bridge.lookup_memory_pattern(company_id, [k for k in search_keys if k])

        # ─────────────────────────────────────────────────────────────────────
        # RULE 3: Debtor Resolution & Scoring
        # ─────────────────────────────────────────────────────────────────────
        debtors = self.db.query(IDPDebtorLedger).filter(IDPDebtorLedger.company_id == company_id).all()
        candidate_scores: List[Tuple[IDPDebtorLedger, float, List[EvidenceItem], List[int]]] = []

        # Get latest federated weights
        model = self.federated_service.get_latest_model()
        weights = model.weights_blob

        narration_clean = (extract.narration or "").lower()
        payer_name_clean = (extract.payer_name or "").lower()

        for debtor in debtors:
            debtor_score = 0.0
            evidence_items: List[EvidenceItem] = []
            matched_inv_ids: List[int] = []

            # A. Explicit Reference Match (Invoice number in narration / reference)
            debtor_invoices = self.db.query(IDPInvoice).filter(IDPInvoice.debtor_id == debtor.id).all()
            inv_ref_found = False
            for inv in debtor_invoices:
                inv_no_clean = inv.invoice_number.lower()
                if (
                    inv_no_clean in narration_clean
                    or (extract.reference_id and inv_no_clean in extract.reference_id.lower())
                    or (extract.secondary_reference and inv_no_clean in extract.secondary_reference.lower())
                ):
                    inv_ref_found = True
                    matched_inv_ids.append(inv.id)
                    score_pts = 40.0 * (weights.get("ref_exact_match_weight", 0.38) / 0.38)
                    debtor_score += score_pts
                    evidence_items.append(
                        EvidenceItem(
                            factor="INVOICE_REFERENCE_MATCH",
                            description=f"Payment reference/narration explicitly cites Invoice '{inv.invoice_number}'.",
                            weight=round(score_pts, 1),
                            verified=True,
                        )
                    )
                    break

            # B. Customer Alias & Name Matching
            alias_matched = False
            debtor_name_lower = debtor.name.lower()
            aliases_list = [a.lower() for a in (debtor.aliases or [])]

            # Direct name overlap or alias overlap
            for alias in [debtor_name_lower] + aliases_list:
                if not alias:
                    continue
                if (
                    (payer_name_clean and alias in payer_name_clean)
                    or (payer_name_clean and payer_name_clean in alias)
                    or alias in narration_clean
                ):
                    alias_matched = True
                    score_pts = 30.0 * (weights.get("payer_alias_similarity_weight", 0.24) / 0.24)
                    debtor_score += score_pts
                    evidence_items.append(
                        EvidenceItem(
                            factor="DEBTOR_ALIAS_MATCH",
                            description=f"Payer identity '{extract.payer_name or narration_clean}' matches debtor alias '{alias.title()}'.",
                            weight=round(score_pts, 1),
                            verified=True,
                        )
                    )
                    break

            # C. Bank Account & VPA Fingerprint Matching
            if extract.payer_vpa and debtor.vpa and extract.payer_vpa.lower() == debtor.vpa.lower():
                score_pts = 25.0 * (weights.get("vpa_account_fingerprint_weight", 0.18) / 0.18)
                debtor_score += score_pts
                evidence_items.append(
                    EvidenceItem(
                        factor="VPA_FINGERPRINT_MATCH",
                        description=f"Payer UPI VPA '{extract.payer_vpa}' matches debtor registered UPI handle.",
                        weight=round(score_pts, 1),
                        verified=True,
                    )
                )
            elif extract.payer_account and debtor.bank_account and extract.payer_account == debtor.bank_account:
                score_pts = 25.0 * (weights.get("vpa_account_fingerprint_weight", 0.18) / 0.18)
                debtor_score += score_pts
                evidence_items.append(
                    EvidenceItem(
                        factor="BANK_ACCOUNT_MATCH",
                        description=f"Remitter bank account matches debtor verified account.",
                        weight=round(score_pts, 1),
                        verified=True,
                    )
                )

            # D. CAFIE Memory Pattern
            if memory_match and memory_match.get("debtor_id") == debtor.id:
                boost = max(35.0, float(memory_match.get("confidence_boost", 35.0)))
                debtor_score += boost
                evidence_items.append(
                    EvidenceItem(
                        factor="CAFIE_MEMORY_PATTERN",
                        description=(
                            f"Recalled prior accountant feedback: token '{memory_match.get('matched_key')}' "
                            f"was previously authorized to {debtor.name}."
                        ),
                        weight=round(boost, 1),
                        verified=True,
                    )
                )

            # E. Invoice Amount Alignment
            # (Note: Strictly capped at 10 pts so amount alone NEVER identifies a debtor)
            has_amount_match = False
            open_invoices = [inv for inv in debtor_invoices if inv.balance_amount > 0]
            for inv in open_invoices:
                if abs(inv.balance_amount - amount) < 1.0:
                    has_amount_match = True
                    if inv.id not in matched_inv_ids:
                        matched_inv_ids.append(inv.id)
                    break

            # Multi-invoice sum check
            if not has_amount_match and len(open_invoices) >= 2:
                for i in range(len(open_invoices)):
                    for j in range(i + 1, len(open_invoices)):
                        if abs((open_invoices[i].balance_amount + open_invoices[j].balance_amount) - amount) < 1.0:
                            has_amount_match = True
                            matched_inv_ids = [open_invoices[i].id, open_invoices[j].id]
                            break
                    if has_amount_match:
                        break

            if has_amount_match:
                debtor_score += 10.0
                evidence_items.append(
                    EvidenceItem(
                        factor="OPEN_INVOICE_BALANCE_ALIGNMENT",
                        description=f"Payment amount ₹{amount:,.2f} exactly matches outstanding invoice balance(s).",
                        weight=10.0,
                        verified=True,
                    )
                )

            candidate_scores.append((debtor, debtor_score, evidence_items, matched_inv_ids))

        # Sort candidate debtors descending by score
        candidate_scores.sort(key=lambda x: x[1], reverse=True)

        # ─────────────────────────────────────────────────────────────────────
        # RULE 4: Strict Preservation Rule — "Do NOT identify debtors from amount alone"
        # Check for Ambiguous Debtors (e.g. Scenario 8)
        # ─────────────────────────────────────────────────────────────────────
        debtors_with_matching_amount = []
        for d in debtors:
            for inv in d.invoices:
                if inv.balance_amount > 0 and abs(inv.balance_amount - amount) < 1.0:
                    debtors_with_matching_amount.append(d)
                    break

        # If 2 or more debtors have matching amounts, and no debtor has strong distinguishing evidence (alias/ref/memory)
        top_candidate = candidate_scores[0] if candidate_scores else None
        top_score = top_candidate[1] if top_candidate else 0.0

        is_ambiguous = False
        if len(debtors_with_matching_amount) >= 2 and top_score < 25.0:
            is_ambiguous = True

        if is_ambiguous:
            alt_matches = [
                AlternativeMatch(
                    debtor_id=d.id,
                    debtor_name=d.name,
                    debtor_code=d.debtor_code,
                    suggested_invoice_ids=[inv.id for inv in d.invoices if abs(inv.balance_amount - amount) < 1.0],
                    confidence_score=48.0,
                    reason=f"Debtor has open invoice with exact matching balance ₹{amount:,.2f}.",
                )
                for d in debtors_with_matching_amount[:3]
            ]
            evidence = [
                EvidenceItem(
                    factor="AMBIGUOUS_AMOUNT_COLLISION",
                    description=f"{len(debtors_with_matching_amount)} debtors have open invoices of exactly ₹{amount:,.2f}.",
                    weight=40.0,
                    verified=True,
                ),
                EvidenceItem(
                    factor="MISSING_DISTINGUISHING_IDENTIFIER",
                    description="Incoming payment lacks payer alias, UTR remittance note, or invoice reference.",
                    weight=30.0,
                    verified=True,
                ),
                EvidenceItem(
                    factor="POLICY_GUARDRAIL",
                    description="FINVORA Anti-Hallucination Policy strictly forbids matching debtors from amount alone.",
                    weight=30.0,
                    verified=True,
                ),
            ]
            rec = IDPReconciliationRecommendation(
                payment_id=payment.id,
                debtor_id=None,
                suggested_invoice_ids=[],
                suggested_ledger="Sundry Debtors (Unassigned)",
                confidence_score=45.0,
                match_tier="AMBIGUOUS_DEBTOR",
                explanation=(
                    f"AMBIGUOUS DEBTOR: Multiple debtors ({', '.join(d.name for d in debtors_with_matching_amount[:2])}) "
                    f"have outstanding invoices of ₹{amount:,.2f}. As per policy, debtors cannot be inferred "
                    "from amount alone. Please select the correct debtor."
                ),
                evidence_breakdown=[e.dict() for e in evidence],
                alternative_matches=[a.dict() for a in alt_matches],
            )
            payment.status = "PENDING_APPROVAL"
            self.db.add(rec)
            self.db.commit()
            self.db.refresh(rec)
            return rec

        # ─────────────────────────────────────────────────────────────────────
        # RULE 5: Unidentified Payments
        # ─────────────────────────────────────────────────────────────────────
        if not top_candidate or top_score < 20.0:
            evidence = [
                EvidenceItem(
                    factor="UNMATCHED_PAYER_IDENTITY",
                    description=f"Payer identity '{extract.payer_name or 'Unknown'}' does not match any known debtor.",
                    weight=40.0,
                    verified=False,
                ),
                EvidenceItem(
                    factor="UNMATCHED_REFERENCE",
                    description=f"Reference '{extract.reference_id or 'None'}' does not match any open sales order or invoice.",
                    weight=35.0,
                    verified=False,
                ),
                EvidenceItem(
                    factor="CLEARING_LEDGER_ALLOCATION",
                    description="Payment will route to Bank Suspense / Clearing account pending manual inquiry.",
                    weight=25.0,
                    verified=True,
                ),
            ]
            rec = IDPReconciliationRecommendation(
                payment_id=payment.id,
                debtor_id=None,
                suggested_invoice_ids=[],
                suggested_ledger="Bank Suspense & Clearing Account",
                confidence_score=25.0,
                match_tier="UNIDENTIFIED",
                explanation=(
                    f"UNIDENTIFIED PAYMENT: Received ₹{amount:,.2f} via {extract.payment_mode}. "
                    "No matching debtor alias, bank account, or invoice reference found. "
                    "Recommend parking in Clearing Ledger."
                ),
                evidence_breakdown=[e.dict() for e in evidence],
                alternative_matches=[],
            )
            payment.status = "UNIDENTIFIED"
            self.db.add(rec)
            self.db.commit()
            self.db.refresh(rec)
            return rec

        # ─────────────────────────────────────────────────────────────────────
        # RULE 6: Invoice Allocation & Tier Matching for Resolved Debtor
        # ─────────────────────────────────────────────────────────────────────
        best_debtor, base_score, best_evidence, suggested_inv_ids = top_candidate
        open_invoices = [inv for inv in best_debtor.invoices if inv.balance_amount > 0]

        # Alternative debtor candidates for HITL UI
        alt_matches = []
        for alt_d, alt_s, _, alt_invs in candidate_scores[1:4]:
            if alt_s > 10.0:
                alt_matches.append(
                    AlternativeMatch(
                        debtor_id=alt_d.id,
                        debtor_name=alt_d.name,
                        debtor_code=alt_d.debtor_code,
                        suggested_invoice_ids=alt_invs,
                        confidence_score=round(min(85.0, alt_s), 1),
                        reason=f"Candidate match with confidence score {alt_s:.0f}%.",
                    )
                )

        match_tier = "EXACT_MATCH"
        explanation = ""
        final_confidence = min(99.0, base_score + 25.0)  # Baseline scaling

        # Case A: Exact Match against a single invoice
        exact_inv = next((inv for inv in open_invoices if abs(inv.balance_amount - amount) < 1.0), None)
        if exact_inv:
            match_tier = "EXACT_MATCH"
            suggested_inv_ids = [exact_inv.id]
            explanation = (
                f"EXACT MATCH: Payment of ₹{amount:,.2f} corresponds 100% to Invoice {exact_inv.invoice_number} "
                f"for debtor {best_debtor.name}."
            )
            final_confidence = max(94.0, final_confidence)

        # Case B: Multi-Invoice Match (1 payment covering 2 or more invoices)
        elif len(open_invoices) >= 2 and any(
            abs((open_invoices[i].balance_amount + open_invoices[j].balance_amount) - amount) < 1.0
            for i in range(len(open_invoices))
            for j in range(i + 1, len(open_invoices))
        ):
            match_tier = "MULTI_INVOICE_SPLIT"
            for i in range(len(open_invoices)):
                for j in range(i + 1, len(open_invoices)):
                    if abs((open_invoices[i].balance_amount + open_invoices[j].balance_amount) - amount) < 1.0:
                        suggested_inv_ids = [open_invoices[i].id, open_invoices[j].id]
                        inv_a = open_invoices[i]
                        inv_b = open_invoices[j]
                        explanation = (
                            f"MULTI-INVOICE MATCH: Payment of ₹{amount:,.2f} precisely clears two invoices: "
                            f"{inv_a.invoice_number} (₹{inv_a.balance_amount:,.2f}) and "
                            f"{inv_b.invoice_number} (₹{inv_b.balance_amount:,.2f})."
                        )
                        final_confidence = max(92.0, final_confidence)
                        break
                if match_tier == "MULTI_INVOICE_SPLIT" and len(suggested_inv_ids) == 2:
                    break

        # Case C: Partial Payment (payment < open invoice balance)
        elif open_invoices and any(amount < inv.balance_amount for inv in open_invoices):
            match_tier = "PARTIAL_PAYMENT"
            target_inv = next((inv for inv in open_invoices if amount < inv.balance_amount), open_invoices[0])
            suggested_inv_ids = [target_inv.id]
            remaining = target_inv.balance_amount - amount
            explanation = (
                f"PARTIAL PAYMENT: Payment of ₹{amount:,.2f} covers part of Invoice {target_inv.invoice_number} "
                f"(Total Balance: ₹{target_inv.balance_amount:,.2f}). Remaining balance after posting: ₹{remaining:,.2f}."
            )
            final_confidence = max(88.0, final_confidence)

        # Case D: Advance / Overpayment (payment > total balance or no open invoices)
        elif not open_invoices or amount > sum(inv.balance_amount for inv in open_invoices):
            total_open = sum(inv.balance_amount for inv in open_invoices)
            if total_open > 0:
                match_tier = "OVERPAYMENT"
                suggested_inv_ids = [inv.id for inv in open_invoices]
                excess = amount - total_open
                explanation = (
                    f"OVERPAYMENT: Payment of ₹{amount:,.2f} exceeds open invoices (₹{total_open:,.2f}) "
                    f"by ₹{excess:,.2f}. Recommends posting ₹{excess:,.2f} to Advance from Customers."
                )
            else:
                match_tier = "ADVANCE_PAYMENT"
                suggested_inv_ids = []
                explanation = (
                    f"ADVANCE PAYMENT: Payment of ₹{amount:,.2f} received with no open invoices. "
                    "Recommend booking against 'Advance Customer Receipts' ledger."
                )
            final_confidence = max(85.0, final_confidence)

        rec = IDPReconciliationRecommendation(
            payment_id=payment.id,
            debtor_id=best_debtor.id,
            suggested_invoice_ids=suggested_inv_ids,
            suggested_ledger=best_debtor.default_ledger or "Sundry Debtors",
            confidence_score=round(min(99.0, final_confidence), 1),
            match_tier=match_tier,
            explanation=explanation,
            evidence_breakdown=[e.dict() for e in best_evidence],
            alternative_matches=[a.dict() for a in alt_matches],
        )
        payment.status = "PENDING_APPROVAL"
        self.db.add(rec)
        self.db.commit()
        self.db.refresh(rec)
        return rec
