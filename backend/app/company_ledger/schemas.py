"""Pydantic V2 Schemas for FINVORA Company Ledger & Manager Approval Module."""

from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field, ConfigDict


# ── Company Schemas ──────────────────────────────────────────────────────────

class LedgerCompanyBase(BaseModel):
    company_code: str
    name: str
    financial_year: str = "FY 2025-26"
    currency: str = "INR"
    opening_balance: Decimal = Decimal("2500000.00")
    current_balance: Decimal = Decimal("2500000.00")
    is_demo: bool = False


class LedgerCompanyOut(LedgerCompanyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class CompanyLedgerSummary(BaseModel):
    company_id: int
    company_code: str
    company_name: str
    financial_year: str
    currency: str
    opening_balance: float
    total_debit: float
    total_credit: float
    closing_balance: float
    total_transactions: int
    pending_approvals: int
    approved_transactions: int
    rejected_transactions: int
    changes_requested_transactions: int
    posted_transactions: int


# ── Double Entry Line Schemas ─────────────────────────────────────────────────

class LedgerEntryLineSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[int] = None
    account_id: Optional[int] = None
    account_name: str
    entry_type: str  # DEBIT or CREDIT
    amount: float
    narration: Optional[str] = None


# ── Transaction Schemas ───────────────────────────────────────────────────────

class LedgerTransactionItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    transaction_number: str
    transaction_date: date
    voucher_type: str
    reference_no: str
    entity_name: str
    entity_code: Optional[str] = None
    ledger_account_name: str
    description: str
    total_amount: float
    debit_amount: float
    credit_amount: float
    running_balance: float
    approval_status: str
    posting_status: str
    manager_remarks: Optional[str] = None
    finvora_risk_tier: str
    finvora_risk_score: float
    is_demo: bool


class LedgerTransactionDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: int
    company_code: str
    company_name: str
    transaction_number: str
    voucher_type: str
    transaction_date: date
    reference_no: str
    entity_type: str
    entity_name: str
    entity_code: Optional[str] = None
    ledger_account_name: str
    description: str
    total_amount: float
    debit_amount: float
    credit_amount: float
    running_balance: float

    # Lifecycle & Decision States
    approval_status: str
    posting_status: str
    manager_remarks: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejected_by: Optional[str] = None
    rejected_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    changes_requested_by: Optional[str] = None
    changes_requested_at: Optional[datetime] = None
    changes_requested_remarks: Optional[str] = None
    posted_by: Optional[str] = None
    posted_at: Optional[datetime] = None
    resubmission_count: int

    # 3-Way Journey Matching Information
    po_number: Optional[str] = None
    po_amount: Optional[float] = None
    invoice_number: Optional[str] = None
    invoice_amount: Optional[float] = None
    grn_number: Optional[str] = None
    grn_amount: Optional[float] = None
    payment_terms: Optional[str] = None
    supporting_documents: List[Dict[str, Any]] = Field(default_factory=list)

    # FINVORA Intelligence Analysis
    finvora_risk_tier: str
    finvora_risk_score: float
    finvora_risk_reasons: List[str] = Field(default_factory=list)
    finvora_recommendation: Optional[str] = None

    # Double Entry Lines
    lines: List[LedgerEntryLineSchema] = Field(default_factory=list)

    # Audit & Approval Trails
    approvals: List[Dict[str, Any]] = Field(default_factory=list)
    audit_logs: List[Dict[str, Any]] = Field(default_factory=list)
    comments: List[Dict[str, Any]] = Field(default_factory=list)

    is_demo: bool
    created_at: datetime


# ── Manager Action Requests ───────────────────────────────────────────────────

class ManagerApproveRequest(BaseModel):
    manager_id: str = "MGR-001"
    manager_name: str = "Vikram Aditya (Finance Manager)"
    remarks: Optional[str] = "Verified 3-way match against contract terms and GRN. Approved for ledger posting."


class ManagerRejectRequest(BaseModel):
    manager_id: str = "MGR-001"
    manager_name: str = "Vikram Aditya (Finance Manager)"
    rejection_reason: str = Field(..., min_length=5, description="Mandatory detailed rejection justification")


class ManagerRequestChangesRequest(BaseModel):
    manager_id: str = "MGR-001"
    manager_name: str = "Vikram Aditya (Finance Manager)"
    remarks: str = Field(..., min_length=5, description="Explanation of discrepancies or corrections required")


class AccountantResubmitRequest(BaseModel):
    accountant_id: str = "ACCT-104"
    accountant_name: str = "Priya Sharma (Senior Accountant)"
    invoice_amount: Optional[float] = None
    po_amount: Optional[float] = None
    grn_amount: Optional[float] = None
    description: Optional[str] = None
    resubmission_notes: str = Field(..., min_length=5, description="Notes on corrections made")


class ActionResponse(BaseModel):
    success: bool
    message: str
    transaction_id: int
    approval_status: str
    posting_status: str
    updated_balance: Optional[float] = None
    audit_event_id: Optional[int] = None

