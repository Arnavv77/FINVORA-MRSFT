from sqlalchemy import (
    Column, Integer, String, Float, Date, DateTime, ForeignKey, JSON, Text, Boolean
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    first_seen_date = Column(Date, nullable=False)
    avg_transaction_amount = Column(Float, nullable=False, default=0.0)

    transactions = relationship("Transaction", back_populates="vendor")
    invoices = relationship("Invoice", back_populates="vendor")
    risk_alerts = relationship("RiskAlert", back_populates="vendor")


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)   # checking / savings / credit
    balance = Column(Float, nullable=False, default=0.0)

    transactions = relationship("Transaction", back_populates="account")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    reference_no = Column(String(100), nullable=True)
    description = Column(String(255), nullable=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    category = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    amount = Column(Float, nullable=False)
    date = Column(Date, nullable=False, index=True)
    direction = Column(String(10), nullable=False)       # inflow / outflow
    source_system = Column(String(50), nullable=False)   # tally / zoho / bank / invoice
    status = Column(String(20), nullable=False, default="cleared")  # cleared / pending / flagged / held
    is_anomaly = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)

    vendor = relationship("Vendor", back_populates="transactions")
    account = relationship("Account", back_populates="transactions")
    risk_alerts = relationship("RiskAlert", back_populates="transaction")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    invoice_number = Column(String(50), nullable=False, unique=True)
    amount = Column(Float, nullable=False)
    issue_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # paid/pending/overdue

    vendor = relationship("Vendor", back_populates="invoices")


class DepartmentBudget(Base):
    __tablename__ = "department_budgets"

    id = Column(String(50), primary_key=True, index=True)
    department = Column(String(100), nullable=False)
    head_of_department = Column(String(150), nullable=False)
    allocated = Column(Float, nullable=False)
    spent = Column(Float, nullable=False)
    committed = Column(Float, nullable=False, default=0.0)
    projected_month_end = Column(Float, nullable=False, default=0.0)
    historical_spend = Column(Float, nullable=False, default=0.0)
    variance_amount = Column(Float, nullable=False, default=0.0)
    variance_percentage = Column(Float, nullable=False, default=0.0)
    is_unfavorable = Column(Boolean, default=False)
    status = Column(String(20), nullable=False, default="on_track")  # on_track / at_risk / over_budget
    categories = Column(JSON, nullable=False, default=list)          # list of {name, allocated, spent}


# Alias for backwards compatibility
Budget = DepartmentBudget


class RiskAlert(Base):
    __tablename__ = "risk_alerts"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    title = Column(String(255), nullable=False)
    # Frontend enum: duplicate_invoice | unusual_transaction | budget_deviations | abnormal_vendor_activity | payment_risks
    risk_type = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False, default="warning")  # critical | warning | info
    amount = Column(Float, nullable=False, default=0.0)
    estimated_exposure = Column(Float, nullable=False, default=0.0)
    status = Column(String(20), nullable=False, default="open")       # open | under_review | held | resolved | dismissed
    confidence_score = Column(Float, nullable=False, default=80.0)    # 0 - 100 directly
    rule_triggered = Column(String(255), nullable=True)
    evidence = Column(JSON, nullable=False, default=list)             # list of {label, value, matchHighlight}
    supporting_records = Column(JSON, nullable=False, default=list)   # list of {recordId, description, date, amount, source}
    recommended_action = Column(Text, nullable=True)
    assigned_to = Column(String(100), nullable=True)
    review_history = Column(JSON, nullable=False, default=list)       # list of {timestamp, user, action, note}
    dismiss_reason = Column(String(255), nullable=True)
    explanation = Column(Text, nullable=True)                         # precomputed LLM explanation
    detected_at = Column(DateTime, server_default=func.now(), nullable=False)

    transaction = relationship("Transaction", back_populates="risk_alerts")
    vendor = relationship("Vendor", back_populates="risk_alerts")


# ── Context-Aware Financial Intelligence Engine (CAFIE) Models ───────────────
from .cafie_models import (
    VendorProfile,
    PurchaseOrder,
    PurchaseOrderItem,
    GoodsReceiptNote,
    GoodsReceiptNoteItem,
    VendorInvoiceRecord,
    VendorInvoiceItem,
    InventoryRecord,
    StockMovement,
    FinancialMemoryEvent,
    FinancialMemoryLink,
    CrossSystemRiskAssessment,
    CAFIEApprovalRecord,
    ERPIntegrationLog,
)
