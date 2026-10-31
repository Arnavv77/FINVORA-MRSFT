"""Pydantic Schemas for IDP Multi-Mode Payment Intelligence & Intelligent Reconciliation.

Strict Preservation:
- Defines typed schemas for all 8 payment modes.
- Unified payment schema with optional fields (never fabricates missing information).
- Human-in-the-loop approval actions and federated model states.
"""

from __future__ import annotations
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# 1. Individual Payment Mode Input Payloads
# ─────────────────────────────────────────────────────────────────────────────

class ChequePaymentInput(BaseModel):
    cheque_number: str = Field(..., description="6-digit MICR Cheque Number")
    cheque_series: Optional[str] = Field(None, description="Cheque series code if present")
    amount: float = Field(..., gt=0, description="Cheque amount in INR")
    bank: str = Field(..., description="Drawn on Bank name")
    date: str = Field(..., description="Cheque date (YYYY-MM-DD)")
    payer_details: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Payer/Drawer info (drawer_name, account_number, memo)"
    )


class UPIPaymentInput(BaseModel):
    upi_transaction_id: str = Field(..., description="UPI Transaction ID / Ref ID")
    utr_rrn: Optional[str] = Field(None, description="12-digit UTR or Bank RRN")
    payer_vpa: str = Field(..., description="Payer Virtual Private Address / UPI ID")
    narration: Optional[str] = Field(None, description="UPI payment narration / remark")
    amount: float = Field(..., gt=0, description="Amount in INR")
    transaction_date: str = Field(..., description="Transaction timestamp or date")


class NEFTPaymentInput(BaseModel):
    utr: str = Field(..., description="NEFT Unique Transaction Reference (UTR)")
    remitter_name: str = Field(..., description="Name of the remitter / sender")
    bank_reference: Optional[str] = Field(None, description="Core banking reference number")
    narration: Optional[str] = Field(None, description="NEFT remark / narration")
    amount: float = Field(..., gt=0, description="NEFT amount in INR")
    date: str = Field(..., description="Settlement date")


class RTGSPaymentInput(BaseModel):
    utr: str = Field(..., description="RTGS Unique Transaction Reference (UTR)")
    remitter_details: Dict[str, Any] = Field(..., description="Remitter name, originating bank, account")
    bank_reference: Optional[str] = Field(None, description="RTGS Bank Reference")
    amount: float = Field(..., gt=0, description="RTGS amount in INR")
    date: str = Field(..., description="Settlement date")


class IMPSPaymentInput(BaseModel):
    transaction_reference: str = Field(..., description="IMPS RRN / Reference number")
    sender_details: Dict[str, Any] = Field(..., description="Sender mobile / MMID / Name / Account")
    amount: float = Field(..., gt=0, description="Amount in INR")
    date: str = Field(..., description="Transaction date")


class BankTransferPaymentInput(BaseModel):
    account_reference: str = Field(..., description="Beneficiary / Internal Account Ref")
    narration: Optional[str] = Field(None, description="Bank statement narration text")
    payer_details: Dict[str, Any] = Field(..., description="Payer name and bank account details")
    amount: float = Field(..., gt=0, description="Transfer amount in INR")
    date: Optional[str] = Field(None, description="Value date")


class CashPaymentInput(BaseModel):
    receipt_number: str = Field(..., description="Official Cash Receipt Number")
    payer_identity: Dict[str, Any] = Field(..., description="Customer identity, PAN/Aadhaar/Receipt bearer")
    amount: float = Field(..., gt=0, description="Cash amount in INR")
    date: str = Field(..., description="Collection date")


class CardGatewayPaymentInput(BaseModel):
    transaction_id: str = Field(..., description="Payment Gateway Transaction ID")
    settlement_id: Optional[str] = Field(None, description="PG Batch Settlement ID")
    order_reference: Optional[str] = Field(None, description="Merchant Order / Invoice Reference")
    amount: float = Field(..., gt=0, description="Net settled amount")
    settlement_date: str = Field(..., description="PG settlement timestamp")


# ─────────────────────────────────────────────────────────────────────────────
# 2. Unified Payment Extraction Structure
# ─────────────────────────────────────────────────────────────────────────────

class UnifiedPaymentExtract(BaseModel):
    """Unified representation of any payment mode without fabricating missing fields."""
    payment_mode: str
    amount: float
    payment_date: str
    reference_id: Optional[str] = None
    secondary_reference: Optional[str] = None
    payer_name: Optional[str] = None
    payer_vpa: Optional[str] = None
    payer_account: Optional[str] = None
    payer_bank: Optional[str] = None
    narration: Optional[str] = None
    raw_metadata: Dict[str, Any] = Field(default_factory=dict)
    confidence: float = 95.0


# ─────────────────────────────────────────────────────────────────────────────
# 3. Intelligent Recommendation Schemas
# ─────────────────────────────────────────────────────────────────────────────

class EvidenceItem(BaseModel):
    factor: str
    description: str
    weight: float
    verified: bool


class AlternativeMatch(BaseModel):
    debtor_id: int
    debtor_name: str
    debtor_code: str
    suggested_invoice_ids: List[int] = Field(default_factory=list)
    confidence_score: float
    reason: str


class ReconciliationRecommendationResponse(BaseModel):
    payment_id: int
    payment_mode: str
    amount: float
    reference_id: Optional[str] = None
    payment_date: str
    payer_name: Optional[str] = None
    payer_vpa: Optional[str] = None
    narration: Optional[str] = None
    match_tier: str
    # EXACT_MATCH, PARTIAL_PAYMENT, MULTI_INVOICE_SPLIT, ADVANCE_PAYMENT,
    # OVERPAYMENT, AMBIGUOUS_DEBTOR, UNIDENTIFIED, DUPLICATE_SUSPECT
    confidence_score: float
    suggested_debtor_id: Optional[int] = None
    suggested_debtor_name: Optional[str] = None
    suggested_debtor_code: Optional[str] = None
    suggested_ledger: str = "Sundry Debtors"
    suggested_invoices: List[Dict[str, Any]] = Field(default_factory=list)
    explanation: str
    evidence_breakdown: List[EvidenceItem] = Field(default_factory=list)
    alternative_matches: List[AlternativeMatch] = Field(default_factory=list)
    status: str
    is_duplicate_suspect: bool = False
    memory_boost_applied: bool = False


# ─────────────────────────────────────────────────────────────────────────────
# 4. Human-in-the-Loop Approval Action Schemas
# ─────────────────────────────────────────────────────────────────────────────

class SplitAllocationItem(BaseModel):
    invoice_id: int
    amount: float


class HumanApprovalRequest(BaseModel):
    action: str = Field(
        ...,
        description=(
            "Action to execute: APPROVE_AND_POST, CORRECT_DEBTOR, CORRECT_INVOICE, "
            "SPLIT_PAYMENT, REJECT, MARK_UNIDENTIFIED, SEND_FOR_VERIFICATION"
        )
    )
    approved_by: str = Field(default="Senior Accountant (CFO Auth)")
    corrected_debtor_id: Optional[int] = None
    corrected_invoice_ids: Optional[List[int]] = None
    corrected_ledger: Optional[str] = None
    split_allocations: Optional[List[SplitAllocationItem]] = None
    remarks: Optional[str] = None
    simulate_erp_failure: Optional[bool] = False  # For negative testing of ERP failures


class HumanApprovalResponse(BaseModel):
    success: bool
    payment_id: int
    action_taken: str
    message: str
    erp_voucher_number: Optional[str] = None
    erp_status: Optional[str] = None
    tally_xml_snippet: Optional[str] = None
    memory_feedback_stored: bool = False


# ─────────────────────────────────────────────────────────────────────────────
# 5. Federated Intelligence Schemas
# ─────────────────────────────────────────────────────────────────────────────

class FederatedModelStatus(BaseModel):
    version: str
    round_number: int
    participants_count: int
    clipping_norm: float
    epsilon: float
    delta: float
    model_weights: Dict[str, float]
    opt_in_status: bool
    is_simulated: bool = True
    last_aggregated: str
    participants_summary: List[Dict[str, Any]] = Field(default_factory=list)


class FederatedTrainRoundRequest(BaseModel):
    round_number: Optional[int] = None
    differential_privacy_noise: bool = True

