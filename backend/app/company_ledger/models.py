"""SQLAlchemy Models for FINVORA Company Ledger & Manager Approval Module.

Strict Preservation:
- Table prefix: ledger_
- Completely isolated from existing tables to prevent regression.
- Reuses existing Base and database engine.
- Proper double-entry bookkeeping architecture with audit logging.
"""

from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import (
    Column,
    Integer,
    String,
    Numeric,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Text,
    JSON,
    Index,
)
from sqlalchemy.orm import relationship

from app.database import Base


class LedgerCompany(Base):
    """Company legal entity master record with financial year and balance tracking."""
    __tablename__ = "ledger_companies"

    id = Column(Integer, primary_key=True, index=True)
    company_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    financial_year = Column(String(20), nullable=False, default="FY 2025-26")
    currency = Column(String(10), default="INR")
    opening_balance = Column(Numeric(15, 2), default=Decimal("2500000.00"), nullable=False)
    current_balance = Column(Numeric(15, 2), default=Decimal("2500000.00"), nullable=False)
    is_demo = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    accounts = relationship("LedgerAccount", back_populates="company", cascade="all, delete-orphan")
    transactions = relationship("LedgerTransaction", back_populates="company", cascade="all, delete-orphan")
    audit_logs = relationship("LedgerAuditLog", back_populates="company", cascade="all, delete-orphan")


class LedgerAccount(Base):
    """Chart of Accounts for a company."""
    __tablename__ = "ledger_accounts"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("ledger_companies.id"), nullable=False, index=True)
    account_code = Column(String(50), index=True, nullable=False)
    account_name = Column(String(255), nullable=False)
    account_type = Column(String(50), nullable=False)  # ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    balance = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    normal_balance = Column(String(10), default="DEBIT")  # DEBIT or CREDIT
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    company = relationship("LedgerCompany", back_populates="accounts")
    entry_lines = relationship("LedgerEntryLine", back_populates="account")


class LedgerTransaction(Base):
    """Core financial transaction & journal entry with complete lifecycle and FINVORA analysis."""
    __tablename__ = "ledger_transactions"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("ledger_companies.id"), nullable=False, index=True)
    transaction_number = Column(String(100), unique=True, index=True, nullable=False)
    voucher_type = Column(String(50), nullable=False, default="PURCHASE_VOUCHER")
    transaction_date = Column(Date, nullable=False, index=True, default=date.today)
    reference_no = Column(String(100), index=True, nullable=False)
    entity_type = Column(String(50), default="VENDOR")  # VENDOR or CUSTOMER
    entity_name = Column(String(255), nullable=False)
    entity_code = Column(String(50), nullable=True)
    ledger_account_id = Column(Integer, ForeignKey("ledger_accounts.id"), nullable=True)
    ledger_account_name = Column(String(255), nullable=False, default="Sundry Creditors - Trade Payables")
    description = Column(Text, nullable=False)
    total_amount = Column(Numeric(15, 2), nullable=False)
    debit_amount = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    credit_amount = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    running_balance = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)

    # Lifecycle & Approval States
    # DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED / REJECTED / CHANGES_REQUESTED -> POSTED
    approval_status = Column(String(50), default="SUBMITTED", index=True, nullable=False)
    posting_status = Column(String(50), default="UNPOSTED", index=True, nullable=False)

    # Manager Decision Data
    manager_remarks = Column(Text, nullable=True)
    approved_by = Column(String(100), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejected_by = Column(String(100), nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    changes_requested_by = Column(String(100), nullable=True)
    changes_requested_at = Column(DateTime, nullable=True)
    changes_requested_remarks = Column(Text, nullable=True)
    posted_by = Column(String(100), nullable=True)
    posted_at = Column(DateTime, nullable=True)
    resubmission_count = Column(Integer, default=0)

    # Journey & 3-Way Match References
    po_number = Column(String(100), nullable=True)
    po_amount = Column(Numeric(15, 2), nullable=True)
    invoice_number = Column(String(100), nullable=True)
    invoice_amount = Column(Numeric(15, 2), nullable=True)
    grn_number = Column(String(100), nullable=True)
    grn_amount = Column(Numeric(15, 2), nullable=True)
    payment_terms = Column(String(100), nullable=True, default="Net 30 Days")
    supporting_documents = Column(JSON, default=list)  # list of {name, type, size, url}

    # FINVORA Intelligence Analysis
    finvora_risk_tier = Column(String(50), default="LOW_RISK")  # LOW_RISK, MEDIUM_RISK, HIGH_RISK
    finvora_risk_score = Column(Numeric(5, 2), default=Decimal("15.00"))
    finvora_risk_reasons = Column(JSON, default=list)  # list of strings
    finvora_recommendation = Column(Text, nullable=True)

    is_demo = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company = relationship("LedgerCompany", back_populates="transactions")
    lines = relationship("LedgerEntryLine", back_populates="transaction", cascade="all, delete-orphan")
    approvals = relationship("LedgerTransactionApproval", back_populates="transaction", cascade="all, delete-orphan", order_by="desc(LedgerTransactionApproval.created_at)")
    audit_logs = relationship("LedgerAuditLog", back_populates="transaction", cascade="all, delete-orphan", order_by="desc(LedgerAuditLog.created_at)")
    comments = relationship("LedgerTransactionComment", back_populates="transaction", cascade="all, delete-orphan", order_by="desc(LedgerTransactionComment.created_at)")


class LedgerEntryLine(Base):
    """Atomic double-entry journal line (Debit / Credit) associated with a transaction."""
    __tablename__ = "ledger_entry_lines"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("ledger_transactions.id"), nullable=False, index=True)
    account_id = Column(Integer, ForeignKey("ledger_accounts.id"), nullable=True)
    account_name = Column(String(255), nullable=False)
    entry_type = Column(String(10), nullable=False)  # DEBIT or CREDIT
    amount = Column(Numeric(15, 2), nullable=False)
    narration = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    transaction = relationship("LedgerTransaction", back_populates="lines")
    account = relationship("LedgerAccount", back_populates="entry_lines")


class LedgerTransactionApproval(Base):
    """Immutable audit log of each manager approval, rejection, or changes requested decision."""
    __tablename__ = "ledger_transaction_approvals"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("ledger_transactions.id"), nullable=False, index=True)
    manager_id = Column(String(100), nullable=False)
    manager_name = Column(String(255), nullable=False)
    decision = Column(String(50), nullable=False)  # APPROVE, REJECT, REQUEST_CHANGES, RESUBMIT
    remarks = Column(Text, nullable=True)
    previous_status = Column(String(50), nullable=False)
    new_status = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    transaction = relationship("LedgerTransaction", back_populates="approvals")


class LedgerAuditLog(Base):
    """Comprehensive timeline and security audit event log."""
    __tablename__ = "ledger_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("ledger_companies.id"), nullable=False, index=True)
    transaction_id = Column(Integer, ForeignKey("ledger_transactions.id"), nullable=True, index=True)
    action = Column(String(100), nullable=False)  # TRANSACTION_CREATED, FINVORA_ANALYZED, APPROVED, REJECTED, etc.
    actor = Column(String(150), nullable=False)
    actor_role = Column(String(100), nullable=False)
    details = Column(JSON, default=dict)
    ip_address = Column(String(50), default="127.0.0.1")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    company = relationship("LedgerCompany", back_populates="audit_logs")
    transaction = relationship("LedgerTransaction", back_populates="audit_logs")


class LedgerTransactionComment(Base):
    """Collaboration notes and feedback comments between accountants and managers."""
    __tablename__ = "ledger_transaction_comments"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("ledger_transactions.id"), nullable=False, index=True)
    author = Column(String(150), nullable=False)
    role = Column(String(50), nullable=False)
    comment = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    transaction = relationship("LedgerTransaction", back_populates="comments")

