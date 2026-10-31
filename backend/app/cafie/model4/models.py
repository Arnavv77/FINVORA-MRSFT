"""FINVORA CAFIE Model 4 — Database Models.

Strictly isolated entities using the table prefix `cafie_model4_`:
1. Model4PurchaseOrder: Enterprise PO records
2. Model4GoodsReceiptNote: Warehouse receipt & inspection records
3. Model4Invoice: Supplier invoice line-item records
4. Model4VendorMaster: Vendor compliance and behavioral baseline records
5. Model4MLMetadata: Trained baseline ML model evaluation metrics & versions
6. Model4ValidationResult: PO-GRN-Invoice predictive validation runs & risk scores
7. Model4DecisionRecord: Human governance decision audit trail
"""

from __future__ import annotations
from sqlalchemy import (
    Column, Integer, String, Float, Date, DateTime, ForeignKey, JSON, Text, Boolean
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Model4PurchaseOrder(Base):
    __tablename__ = "cafie_model4_purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, nullable=False, default=1, index=True)
    po_number = Column(String(100), nullable=False, unique=True, index=True)
    vendor_code = Column(String(50), nullable=False, index=True)
    vendor_name = Column(String(255), nullable=False)
    department = Column(String(100), nullable=False, default="Operations")
    issue_date = Column(Date, nullable=False, index=True)
    delivery_due_date = Column(Date, nullable=False)
    subtotal_amount = Column(Float, nullable=False, default=0.0)
    tax_amount = Column(Float, nullable=False, default=0.0)
    total_amount = Column(Float, nullable=False, default=0.0)
    currency = Column(String(10), nullable=False, default="INR")
    approval_status = Column(String(50), nullable=False, default="APPROVED")  # APPROVED, DRAFT, REJECTED
    items = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime, server_default=func.now())


class Model4GoodsReceiptNote(Base):
    __tablename__ = "cafie_model4_goods_receipt_notes"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, nullable=False, default=1, index=True)
    grn_number = Column(String(100), nullable=False, unique=True, index=True)
    po_number = Column(String(100), nullable=False, index=True)
    vendor_code = Column(String(50), nullable=False, index=True)
    receipt_date = Column(Date, nullable=False, index=True)
    warehouse_id = Column(String(50), nullable=False, default="WH-BLR-01")
    carrier_name = Column(String(100), nullable=True)
    received_quantity = Column(Float, nullable=False, default=0.0)
    accepted_quantity = Column(Float, nullable=False, default=0.0)
    rejected_quantity = Column(Float, nullable=False, default=0.0)
    quality_inspection_status = Column(String(50), nullable=False, default="PASSED")  # PASSED, CONDITIONAL, FAILED
    rejection_reason = Column(String(255), nullable=True)
    items = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime, server_default=func.now())


class Model4Invoice(Base):
    __tablename__ = "cafie_model4_invoices"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, nullable=False, default=1, index=True)
    invoice_number = Column(String(100), nullable=False, unique=True, index=True)
    po_number = Column(String(100), nullable=True, index=True)
    vendor_code = Column(String(50), nullable=False, index=True)
    vendor_name = Column(String(255), nullable=False)
    invoice_date = Column(Date, nullable=False, index=True)
    due_date = Column(Date, nullable=False)
    subtotal_amount = Column(Float, nullable=False, default=0.0)
    tax_amount = Column(Float, nullable=False, default=0.0)
    total_amount = Column(Float, nullable=False, default=0.0)
    currency = Column(String(10), nullable=False, default="INR")
    bank_name = Column(String(100), nullable=True)
    bank_account_number = Column(String(100), nullable=True)
    ifsc_code = Column(String(50), nullable=True)
    payment_status = Column(String(50), nullable=False, default="PENDING_APPROVAL")  # PENDING_APPROVAL, APPROVED, REJECTED, HELD, PAID
    items = Column(JSON, nullable=False, default=list)
    raw_text = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class Model4VendorMaster(Base):
    __tablename__ = "cafie_model4_vendor_master"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, nullable=False, default=1, index=True)
    vendor_code = Column(String(50), nullable=False, unique=True, index=True)
    vendor_name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False, default="IT & Hardware")
    gst_number = Column(String(50), nullable=True)
    registered_bank_name = Column(String(100), nullable=True)
    registered_bank_account = Column(String(100), nullable=True)
    registered_ifsc = Column(String(50), nullable=True)
    avg_lead_time_days = Column(Float, nullable=False, default=7.0)
    delivery_fill_rate = Column(Float, nullable=False, default=100.0)
    total_orders_completed = Column(Integer, nullable=False, default=0)
    discrepancy_count = Column(Integer, nullable=False, default=0)
    bank_change_count = Column(Integer, nullable=False, default=0)
    compliance_status = Column(String(50), nullable=False, default="COMPLIANT")  # COMPLIANT, UNDER_AUDIT, SUSPENDED
    risk_label = Column(String(20), nullable=False, default="LOW")  # LOW, MEDIUM, HIGH
    raw_text = Column(Text, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Model4MLMetadata(Base):
    __tablename__ = "cafie_model4_ml_metadata"

    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String(100), nullable=False, unique=True, index=True)
    model_type = Column(String(100), nullable=False)
    dataset_version = Column(String(50), nullable=False, default="v4.0.0-seed-42")
    training_timestamp = Column(DateTime, server_default=func.now())
    samples_count = Column(Integer, nullable=False, default=0)
    accuracy = Column(Float, nullable=True)
    precision = Column(Float, nullable=True)
    recall = Column(Float, nullable=True)
    f1_score = Column(Float, nullable=True)
    anomaly_outlier_ratio = Column(Float, nullable=True)
    metrics_json = Column(JSON, nullable=False, default=dict)
    status = Column(String(50), nullable=False, default="TRAINED")  # TRAINED, RETRAINING, FAILED


class Model4ValidationResult(Base):
    __tablename__ = "cafie_model4_validation_results"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, nullable=False, default=1, index=True)
    validation_number = Column(String(100), nullable=False, unique=True, index=True)
    invoice_number = Column(String(100), nullable=False, index=True)
    po_number = Column(String(100), nullable=True, index=True)
    grn_number = Column(String(100), nullable=True, index=True)
    vendor_code = Column(String(50), nullable=False, index=True)
    vendor_name = Column(String(255), nullable=False)
    three_way_match_status = Column(String(50), nullable=False, default="MATCHED")
    # MATCHED | QUANTITY_MISMATCH | PRICE_MISMATCH | DUPLICATE | MISSING_GRN | MISSING_PO | MULTI_ANOMALY
    quantity_delta = Column(Float, nullable=False, default=0.0)
    price_delta = Column(Float, nullable=False, default=0.0)
    is_duplicate = Column(Boolean, nullable=False, default=False)
    
    # ML Baseline Predictions
    doc_classification_label = Column(String(50), nullable=False, default="INVOICE")
    doc_classification_confidence = Column(Float, nullable=False, default=0.95)
    invoice_risk_prediction = Column(String(20), nullable=False, default="LOW")
    invoice_risk_confidence = Column(Float, nullable=False, default=0.85)
    anomaly_prediction = Column(String(20), nullable=False, default="NORMAL")
    anomaly_score = Column(Float, nullable=False, default=0.15)
    vendor_risk_prediction = Column(String(20), nullable=False, default="LOW")
    vendor_risk_confidence = Column(Float, nullable=False, default=0.90)

    composite_risk_score = Column(Float, nullable=False, default=15.0)  # 0 - 100
    risk_level = Column(String(20), nullable=False, default="LOW")  # LOW | MEDIUM | HIGH
    financial_exposure = Column(Float, nullable=False, default=0.0)

    recommendations = Column(JSON, nullable=False, default=list)
    supporting_evidence = Column(JSON, nullable=False, default=list)
    decision_status = Column(String(50), nullable=False, default="PENDING_REVIEW")  # PENDING_REVIEW, APPROVED, REJECTED, HELD
    created_at = Column(DateTime, server_default=func.now())

    decisions = relationship("Model4DecisionRecord", back_populates="validation", cascade="all, delete-orphan")


class Model4DecisionRecord(Base):
    __tablename__ = "cafie_model4_decisions"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, nullable=False, default=1, index=True)
    validation_id = Column(Integer, ForeignKey("cafie_model4_validation_results.id"), nullable=False, index=True)
    action = Column(String(50), nullable=False)  # approve | reject | hold
    previous_status = Column(String(50), nullable=False)
    new_status = Column(String(50), nullable=False)
    manager_remarks = Column(Text, nullable=True)
    user_id = Column(String(100), nullable=False, default="manager_1")
    user_role = Column(String(50), nullable=False, default="manager")
    created_at = Column(DateTime, server_default=func.now())

    validation = relationship("Model4ValidationResult", back_populates="decisions")

