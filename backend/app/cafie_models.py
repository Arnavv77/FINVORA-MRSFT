"""FINVORA Context-Aware Financial Intelligence Engine (CAFIE) Models.

Entities:
- VendorProfile: Adaptive vendor profiling, behavioral baselines, bank hashes.
- PurchaseOrder & PurchaseOrderItem: ERP/SAP PO records.
- GoodsReceiptNote & GoodsReceiptNoteItem: WMS receipt verification.
- VendorInvoiceRecord & VendorInvoiceItem: Detailed line-item invoices.
- InventoryRecord & StockMovement: WMS inventory, ageing, and stock velocity.
- FinancialMemoryEvent & FinancialMemoryLink: Persistent financial risk memory.
- CrossSystemRiskAssessment: Central 3-way reconciliation & composite risk assessment.
- CAFIEApprovalRecord: Human-in-the-loop audit trail.
- ERPIntegrationLog: SAP and WMS connector logs with simulated/live states.
"""

from sqlalchemy import (
    Column, Integer, String, Float, Date, DateTime, ForeignKey, JSON, Text, Boolean
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class VendorProfile(Base):
    __tablename__ = "cafie_vendor_profiles"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False, unique=True, index=True)
    vendor_code = Column(String(50), nullable=True)
    gst_number = Column(String(50), nullable=True)
    bank_name = Column(String(100), nullable=True)
    bank_account_number = Column(String(100), nullable=True)
    bank_account_hash = Column(String(64), nullable=True)  # SHA256
    ifsc_code = Column(String(50), nullable=True)
    registered_address = Column(String(255), nullable=True)
    avg_invoice_amount = Column(Float, nullable=False, default=0.0)
    avg_lead_time_days = Column(Float, nullable=False, default=7.0)
    total_orders_completed = Column(Integer, nullable=False, default=0)
    discrepancy_count = Column(Integer, nullable=False, default=0)
    risk_score = Column(Float, nullable=False, default=15.0)  # 0 - 100
    behavioral_anomaly_score = Column(Float, nullable=False, default=10.0)
    last_bank_change_date = Column(Date, nullable=True)
    verification_status = Column(String(50), nullable=False, default="verified")  # verified / pending_verification / flagged
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    vendor = relationship("Vendor", backref="cafie_profile")


class PurchaseOrder(Base):
    __tablename__ = "cafie_purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    po_number = Column(String(100), nullable=False, unique=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False, index=True)
    department = Column(String(100), nullable=False, default="Operations")
    issue_date = Column(Date, nullable=False, index=True)
    delivery_due_date = Column(Date, nullable=False)
    total_amount = Column(Float, nullable=False, default=0.0)
    tax_amount = Column(Float, nullable=False, default=0.0)
    status = Column(String(50), nullable=False, default="issued")  # issued / received / partially_received / closed
    delivery_terms = Column(String(100), nullable=True, default="Net 30 FOB Destination")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    vendor = relationship("Vendor")
    items = relationship("PurchaseOrderItem", back_populates="po", cascade="all, delete-orphan")
    grns = relationship("GoodsReceiptNote", back_populates="po")
    invoices = relationship("VendorInvoiceRecord", back_populates="po")


class PurchaseOrderItem(Base):
    __tablename__ = "cafie_purchase_order_items"

    id = Column(Integer, primary_key=True, index=True)
    po_id = Column(Integer, ForeignKey("cafie_purchase_orders.id"), nullable=False, index=True)
    line_number = Column(Integer, nullable=False, default=1)
    sku = Column(String(100), nullable=False)
    description = Column(String(255), nullable=False)
    quantity = Column(Float, nullable=False)
    unit_of_measure = Column(String(50), nullable=False, default="Units")
    unit_price = Column(Float, nullable=False)
    tax_rate = Column(Float, nullable=False, default=0.18)
    total_price = Column(Float, nullable=False)

    po = relationship("PurchaseOrder", back_populates="items")


class GoodsReceiptNote(Base):
    __tablename__ = "cafie_goods_receipt_notes"

    id = Column(Integer, primary_key=True, index=True)
    grn_number = Column(String(100), nullable=False, unique=True, index=True)
    po_id = Column(Integer, ForeignKey("cafie_purchase_orders.id"), nullable=False, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False, index=True)
    received_date = Column(Date, nullable=False, index=True)
    warehouse_id = Column(String(50), nullable=False, default="WH-BLR-01")
    carrier_name = Column(String(100), nullable=True)
    vehicle_number = Column(String(50), nullable=True)
    received_by = Column(String(100), nullable=False, default="Warehouse Incharge")
    quality_inspection_status = Column(String(50), nullable=False, default="passed")  # passed / conditional_pass / failed
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    po = relationship("PurchaseOrder", back_populates="grns")
    vendor = relationship("Vendor")
    items = relationship("GoodsReceiptNoteItem", back_populates="grn", cascade="all, delete-orphan")


class GoodsReceiptNoteItem(Base):
    __tablename__ = "cafie_goods_receipt_note_items"

    id = Column(Integer, primary_key=True, index=True)
    grn_id = Column(Integer, ForeignKey("cafie_goods_receipt_notes.id"), nullable=False, index=True)
    po_item_id = Column(Integer, ForeignKey("cafie_purchase_order_items.id"), nullable=True)
    sku = Column(String(100), nullable=False)
    description = Column(String(255), nullable=False)
    ordered_quantity = Column(Float, nullable=False)
    received_quantity = Column(Float, nullable=False)
    accepted_quantity = Column(Float, nullable=False)
    rejected_quantity = Column(Float, nullable=False, default=0.0)
    rejection_reason = Column(String(255), nullable=True)
    unit_of_measure = Column(String(50), nullable=False, default="Units")

    grn = relationship("GoodsReceiptNote", back_populates="items")


class VendorInvoiceRecord(Base):
    __tablename__ = "cafie_vendor_invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(100), nullable=False, unique=True, index=True)
    po_id = Column(Integer, ForeignKey("cafie_purchase_orders.id"), nullable=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False, index=True)
    invoice_date = Column(Date, nullable=False, index=True)
    due_date = Column(Date, nullable=False)
    subtotal_amount = Column(Float, nullable=False)
    tax_amount = Column(Float, nullable=False, default=0.0)
    total_amount = Column(Float, nullable=False)
    currency = Column(String(10), nullable=False, default="INR")
    bank_name = Column(String(100), nullable=True)
    bank_account_number = Column(String(100), nullable=True)
    bank_account_hash = Column(String(64), nullable=True)
    ifsc_code = Column(String(50), nullable=True)
    status = Column(String(50), nullable=False, default="submitted")  # submitted / under_review / held / approved / paid / rejected
    document_url = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    po = relationship("PurchaseOrder", back_populates="invoices")
    vendor = relationship("Vendor")
    items = relationship("VendorInvoiceItem", back_populates="invoice", cascade="all, delete-orphan")


class VendorInvoiceItem(Base):
    __tablename__ = "cafie_vendor_invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("cafie_vendor_invoices.id"), nullable=False, index=True)
    line_number = Column(Integer, nullable=False, default=1)
    sku = Column(String(100), nullable=False)
    description = Column(String(255), nullable=False)
    quantity = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False)
    tax_amount = Column(Float, nullable=False, default=0.0)
    total_price = Column(Float, nullable=False)

    invoice = relationship("VendorInvoiceRecord", back_populates="items")


class InventoryRecord(Base):
    __tablename__ = "cafie_inventory_records"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(100), nullable=False, unique=True, index=True)
    item_name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False, default="Hardware")
    warehouse_id = Column(String(50), nullable=False, default="WH-BLR-01")
    quantity_on_hand = Column(Float, nullable=False, default=0.0)
    physical_quantity = Column(Float, nullable=False, default=0.0)
    unit_cost = Column(Float, nullable=False, default=0.0)
    safety_stock = Column(Float, nullable=False, default=10.0)
    reorder_point = Column(Float, nullable=False, default=20.0)
    lead_time_days = Column(Integer, nullable=False, default=7)
    last_movement_date = Column(Date, nullable=False)
    consumption_velocity_daily = Column(Float, nullable=False, default=1.0)
    ageing_days = Column(Integer, nullable=False, default=30)
    is_slow_moving = Column(Boolean, nullable=False, default=False)
    is_excess = Column(Boolean, nullable=False, default=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    movements = relationship("StockMovement", back_populates="inventory", cascade="all, delete-orphan")


class StockMovement(Base):
    __tablename__ = "cafie_stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("cafie_inventory_records.id"), nullable=False, index=True)
    movement_date = Column(Date, nullable=False, index=True)
    movement_type = Column(String(50), nullable=False)  # inward_grn / outward_consumption / shrinkage_adjustment / transfer
    reference_no = Column(String(100), nullable=True)
    quantity = Column(Float, nullable=False)
    unit_cost = Column(Float, nullable=False)
    balance_after = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)

    inventory = relationship("InventoryRecord", back_populates="movements")


class FinancialMemoryEvent(Base):
    __tablename__ = "cafie_financial_memory_events"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False, index=True)
    transaction_ref = Column(String(100), nullable=True, index=True)
    event_category = Column(String(100), nullable=False, index=True)
    # categories: quantity_mismatch | price_spike | delayed_delivery | duplicate_invoice_attempt | bank_details_change | unusual_ledger_mapping | inventory_shrinkage | manager_override
    event_date = Column(Date, nullable=False, index=True)
    severity = Column(String(20), nullable=False, default="warning")  # critical | warning | info
    financial_impact = Column(Float, nullable=False, default=0.0)
    source_documents = Column(JSON, nullable=False, default=dict)
    # e.g. {"po_number": "PO-...", "grn_number": "GRN-...", "invoice_number": "INV-..."}
    supporting_evidence = Column(JSON, nullable=False, default=list)
    # list of {"metric": str, "expected": str, "actual": str, "variance": str}
    risk_category = Column(String(20), nullable=False, default="MEDIUM")  # LOW | MEDIUM | HIGH
    resolution_status = Column(String(50), nullable=False, default="unresolved")  # unresolved | verified_authentic | resolved | disputed
    authorized_manager_remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    vendor = relationship("Vendor")


class FinancialMemoryLink(Base):
    __tablename__ = "cafie_financial_memory_links"

    id = Column(Integer, primary_key=True, index=True)
    source_event_id = Column(Integer, ForeignKey("cafie_financial_memory_events.id"), nullable=False, index=True)
    target_event_id = Column(Integer, ForeignKey("cafie_financial_memory_events.id"), nullable=False, index=True)
    link_type = Column(String(50), nullable=False, default="recurring_pattern")
    # link_types: recurring_pattern | escalation | multi_month_progression | causally_linked
    confidence = Column(Float, nullable=False, default=0.90)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    source_event = relationship("FinancialMemoryEvent", foreign_keys=[source_event_id])
    target_event = relationship("FinancialMemoryEvent", foreign_keys=[target_event_id])


class CrossSystemRiskAssessment(Base):
    __tablename__ = "cafie_risk_assessments"

    id = Column(Integer, primary_key=True, index=True)
    assessment_number = Column(String(100), nullable=False, unique=True, index=True)
    po_id = Column(Integer, ForeignKey("cafie_purchase_orders.id"), nullable=True, index=True)
    grn_id = Column(Integer, ForeignKey("cafie_goods_receipt_notes.id"), nullable=True, index=True)
    invoice_id = Column(Integer, ForeignKey("cafie_vendor_invoices.id"), nullable=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False, index=True)
    
    three_way_match_score = Column(Float, nullable=False, default=100.0)  # 0 - 100
    vendor_behavior_score = Column(Float, nullable=False, default=15.0)
    inventory_impact_score = Column(Float, nullable=False, default=10.0)
    memory_risk_score = Column(Float, nullable=False, default=0.0)
    composite_risk_score = Column(Float, nullable=False, default=20.0)  # 0 - 100
    risk_level = Column(String(20), nullable=False, default="LOW")      # LOW | MEDIUM | HIGH
    estimated_financial_exposure = Column(Float, nullable=False, default=0.0)
    
    reconciliation_status = Column(String(50), nullable=False, default="matched")
    # matched | quantity_mismatch | price_mismatch | tax_mismatch | duplicate | multi_anomaly
    approval_status = Column(String(50), nullable=False, default="pending_review")
    # pending_review | held_for_verification | approved | rejected
    is_synthetic_demo = Column(Boolean, nullable=False, default=False)
    
    discrepancy_details = Column(JSON, nullable=False, default=dict)
    evidence = Column(JSON, nullable=False, default=list)
    historical_memory_refs = Column(JSON, nullable=False, default=list)
    explanation = Column(Text, nullable=True)
    recommended_action = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    po = relationship("PurchaseOrder")
    grn = relationship("GoodsReceiptNote")
    invoice = relationship("VendorInvoiceRecord")
    vendor = relationship("Vendor")
    approval_history = relationship("CAFIEApprovalRecord", back_populates="assessment", cascade="all, delete-orphan")


class CAFIEApprovalRecord(Base):
    __tablename__ = "cafie_approval_records"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("cafie_risk_assessments.id"), nullable=False, index=True)
    action = Column(String(50), nullable=False)  # approve | reject | hold_for_verification | request_documents
    previous_status = Column(String(50), nullable=False)
    new_status = Column(String(50), nullable=False)
    manager_remarks = Column(Text, nullable=True)
    user_id = Column(String(100), nullable=False, default="analyst_1")
    user_role = Column(String(50), nullable=False, default="analyst")
    created_at = Column(DateTime, server_default=func.now())

    assessment = relationship("CrossSystemRiskAssessment", back_populates="approval_history")


class ERPIntegrationLog(Base):
    __tablename__ = "cafie_erp_integration_logs"

    id = Column(Integer, primary_key=True, index=True)
    system_type = Column(String(50), nullable=False)  # SAP_ERP | WMS_WAREHOUSE
    action = Column(String(100), nullable=False)
    status = Column(String(50), nullable=False, default="SIMULATED")  # SIMULATED | API_CONNECTED | POSTED_CONFIRMED | FAILED
    entity_reference = Column(String(100), nullable=True)
    payload = Column(JSON, nullable=False, default=dict)
    response_data = Column(JSON, nullable=False, default=dict)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

