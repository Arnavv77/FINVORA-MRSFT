"""SQLAlchemy Models for IDP Multi-Mode Payment Intelligence & Intelligent Reconciliation.

Strict Preservation:
- Table prefix: idp_
- Completely isolated from existing CAFIE tables.
- Reuses existing Base and database engine.
"""

from __future__ import annotations
from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    JSON,
    Index,
)
from sqlalchemy.orm import relationship

from app.database import Base


class IDPCompany(Base):
    """Company tenant record for multi-entity / isolated company reconciliation."""
    __tablename__ = "idp_companies"

    id = Column(Integer, primary_key=True, index=True)
    company_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    federated_opt_in = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    debtors = relationship("IDPDebtorLedger", back_populates="company")
    invoices = relationship("IDPInvoice", back_populates="company")
    payments = relationship("IDPPayment", back_populates="company")


class IDPDebtorLedger(Base):
    """Debtor (Sundry Debtor / Customer) master record with aliases and bank profile."""
    __tablename__ = "idp_debtor_ledgers"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("idp_companies.id"), nullable=False, index=True)
    debtor_code = Column(String(50), index=True, nullable=False)
    name = Column(String(200), nullable=False)
    aliases = Column(JSON, default=list)  # list of strings e.g. ["Apex Cloud", "Apex Infra", "Apex"]
    gstin = Column(String(20), nullable=True)
    pan = Column(String(20), nullable=True)
    bank_account = Column(String(50), nullable=True, index=True)
    ifsc = Column(String(20), nullable=True)
    vpa = Column(String(100), nullable=True, index=True)
    default_ledger = Column(String(150), default="Sundry Debtors")
    opening_balance = Column(Float, default=0.0)
    current_balance = Column(Float, default=0.0)
    credit_limit = Column(Float, default=5000000.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("IDPCompany", back_populates="debtors")
    invoices = relationship("IDPInvoice", back_populates="debtor")


class IDPInvoice(Base):
    """Outstanding or historical customer invoice to be reconciled against incoming payments."""
    __tablename__ = "idp_invoices"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("idp_companies.id"), nullable=False, index=True)
    debtor_id = Column(Integer, ForeignKey("idp_debtor_ledgers.id"), nullable=False, index=True)
    invoice_number = Column(String(100), index=True, nullable=False)
    invoice_date = Column(DateTime, default=datetime.utcnow)
    due_date = Column(DateTime, nullable=True)
    total_amount = Column(Float, nullable=False)
    paid_amount = Column(Float, default=0.0)
    balance_amount = Column(Float, nullable=False)
    status = Column(String(50), default="UNPAID")  # UNPAID, PARTIALLY_PAID, PAID
    items_summary = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("IDPCompany", back_populates="invoices")
    debtor = relationship("IDPDebtorLedger", back_populates="invoices")


class IDPPayment(Base):
    """Incoming payment transaction across any of the 8 payment modes."""
    __tablename__ = "idp_payments"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("idp_companies.id"), nullable=False, index=True)
    payment_mode = Column(String(50), nullable=False, index=True)  # CHEQUE, UPI, NEFT, RTGS, IMPS, BANK_TRANSFER, CASH, CARD_GATEWAY
    raw_payload = Column(JSON, nullable=False)
    extracted_fields = Column(JSON, nullable=False)
    amount = Column(Float, nullable=False, index=True)
    payment_date = Column(DateTime, default=datetime.utcnow)
    reference_id = Column(String(100), index=True, nullable=True)  # Cheque No, UTR, Txn ID, RRN, Receipt No
    payer_name = Column(String(200), nullable=True)
    payer_vpa = Column(String(100), nullable=True)
    payer_account = Column(String(50), nullable=True)
    payer_bank = Column(String(100), nullable=True)
    narration = Column(Text, nullable=True)
    status = Column(String(50), default="PENDING_APPROVAL", index=True)
    # Statuses: PENDING_APPROVAL, APPROVED, POSTED, REJECTED, UNIDENTIFIED, MANUAL_VERIFICATION, DUPLICATE_SUSPECT
    idempotency_key = Column(String(120), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("IDPCompany", back_populates="payments")
    recommendation = relationship("IDPReconciliationRecommendation", uselist=False, back_populates="payment")
    decision = relationship("IDPApprovalDecision", uselist=False, back_populates="payment")
    erp_voucher = relationship("IDPERPPostingVoucher", uselist=False, back_populates="payment")


class IDPReconciliationRecommendation(Base):
    """Reconciliation recommendation generated by the intelligent matching engine."""
    __tablename__ = "idp_reconciliation_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(Integer, ForeignKey("idp_payments.id"), nullable=False, unique=True, index=True)
    debtor_id = Column(Integer, ForeignKey("idp_debtor_ledgers.id"), nullable=True, index=True)
    suggested_invoice_ids = Column(JSON, default=list)  # list of int invoice IDs
    suggested_ledger = Column(String(150), default="Sundry Debtors")
    confidence_score = Column(Float, nullable=False)  # 0.0 - 100.0
    match_tier = Column(String(50), nullable=False)
    # Tiers: EXACT_MATCH, PARTIAL_PAYMENT, MULTI_INVOICE_SPLIT, ADVANCE_PAYMENT, OVERPAYMENT, AMBIGUOUS_DEBTOR, UNIDENTIFIED, DUPLICATE_SUSPECT
    explanation = Column(Text, nullable=False)
    evidence_breakdown = Column(JSON, default=list)  # [{ factor: "UTR_MATCH", weight: 35, note: "..." }]
    alternative_matches = Column(JSON, default=list)  # [{ debtor_id: 2, name: "...", invoice_ids: [...], score: 55 }]
    created_at = Column(DateTime, default=datetime.utcnow)

    payment = relationship("IDPPayment", back_populates="recommendation")
    debtor = relationship("IDPDebtorLedger")


class IDPApprovalDecision(Base):
    """Immutable Human-in-the-Loop decision record made by an authorized accountant."""
    __tablename__ = "idp_approval_decisions"

    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(Integer, ForeignKey("idp_payments.id"), nullable=False, unique=True, index=True)
    recommendation_id = Column(Integer, ForeignKey("idp_reconciliation_recommendations.id"), nullable=True)
    action_taken = Column(String(50), nullable=False)
    # Actions: APPROVE_AND_POST, CORRECT_DEBTOR, CORRECT_INVOICE, SPLIT_PAYMENT, REJECT, MARK_UNIDENTIFIED, SEND_FOR_VERIFICATION
    approved_by = Column(String(100), default="Senior Accountant (CFO Auth)")
    approved_debtor_id = Column(Integer, ForeignKey("idp_debtor_ledgers.id"), nullable=True)
    approved_invoice_ids = Column(JSON, default=list)
    approved_ledger = Column(String(150), nullable=True)
    split_allocations = Column(JSON, default=list)  # [{"invoice_id": 1, "amount": 50000.0}, ...]
    remarks = Column(Text, nullable=True)
    audit_timestamp = Column(DateTime, default=datetime.utcnow)

    payment = relationship("IDPPayment", back_populates="decision")
    debtor = relationship("IDPDebtorLedger")


class IDPERPPostingVoucher(Base):
    """External ERP / Tally receipt voucher record confirming ledger posting."""
    __tablename__ = "idp_erp_postings"

    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(Integer, ForeignKey("idp_payments.id"), nullable=False, unique=True, index=True)
    decision_id = Column(Integer, ForeignKey("idp_approval_decisions.id"), nullable=True)
    erp_system = Column(String(50), default="TALLY_PRIME")  # TALLY_PRIME, SAP_S4HANA, ZOHO_BOOKS
    voucher_type = Column(String(50), default="Receipt")
    voucher_number = Column(String(100), unique=True, index=True, nullable=False)
    total_amount = Column(Float, nullable=False)
    debtor_ledger = Column(String(150), nullable=False)
    bank_cash_ledger = Column(String(150), default="HDFC Bank Main A/c")
    status = Column(String(50), nullable=False)  # POSTED_CONFIRMED, POSTING_FAILED
    external_reference = Column(String(100), nullable=True)
    erp_response = Column(JSON, default=dict)
    tally_xml_payload = Column(Text, nullable=True)
    idempotency_hash = Column(String(120), unique=True, index=True, nullable=False)
    posted_at = Column(DateTime, default=datetime.utcnow)

    payment = relationship("IDPPayment", back_populates="erp_voucher")


class IDPMemoryFeedback(Base):
    """Company-specific learned feedback pattern persisted via CAFIE memory loop."""
    __tablename__ = "idp_memory_feedback"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("idp_companies.id"), nullable=False, index=True)
    pattern_type = Column(String(50), nullable=False)
    # Types: DEBTOR_ALIAS_CORRECTION, NARRATION_TO_DEBTOR, VPA_TO_DEBTOR, ACCOUNT_TO_DEBTOR, LEDGER_CORRECTION
    pattern_key = Column(String(200), index=True, nullable=False)  # e.g. "apex infra" or "upi/apex@okhdfc"
    debtor_id = Column(Integer, ForeignKey("idp_debtor_ledgers.id"), nullable=False)
    ledger_name = Column(String(150), default="Sundry Debtors")
    confidence_boost = Column(Float, default=25.0)
    times_applied = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    debtor = relationship("IDPDebtorLedger")


class IDPFederatedModel(Base):
    """Federated intelligence model version snapshot and aggregation metrics."""
    __tablename__ = "idp_federated_models"

    id = Column(Integer, primary_key=True, index=True)
    version_tag = Column(String(50), unique=True, index=True, nullable=False)  # e.g. "v1.0.0", "v1.1.0"
    round_number = Column(Integer, nullable=False)
    weights_blob = Column(JSON, nullable=False)  # Model weights dictionary
    participants_count = Column(Integer, default=3)
    clipping_norm = Column(Float, default=1.0)
    epsilon = Column(Float, default=1.2)  # Differential privacy budget
    delta = Column(Float, default=1e-5)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

