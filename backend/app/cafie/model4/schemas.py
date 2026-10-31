"""FINVORA CAFIE Model 4 — Pydantic Schemas.

Enterprise Document Intelligence & Predictive Validation Engine schemas:
- Enterprise Data Types: Purchase Orders, Goods Receipt Notes, Invoices, Vendor Master
- ML Model Performance & Evaluation Metrics
- Predictive Validation Results & Explainability
- Human Governance Decisions
- Bill / Invoice OCR Extraction & 3-Way Matching Schemas
- Dashboard Telemetry
"""

from __future__ import annotations
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from datetime import date, datetime


# ============================================================================
# 1. ENTERPRISE DATA TYPE SCHEMAS
# ============================================================================

class POItemSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    line_number: int
    item_code: str
    description: str
    quantity: float
    unit_price: float
    total_price: float
    unit_of_measure: str = "EA"


class PurchaseOrderSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: Optional[int] = None
    company_id: int = 1
    po_number: str
    vendor_code: str
    vendor_name: str
    department: str = "Operations"
    issue_date: date
    delivery_due_date: date
    subtotal_amount: float
    tax_amount: float
    total_amount: float
    currency: str = "INR"
    approval_status: str = "APPROVED"
    items: List[POItemSchema] = []
    created_at: Optional[datetime] = None


class GRNItemSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    line_number: int
    item_code: str
    description: str
    received_quantity: float
    accepted_quantity: float
    rejected_quantity: float
    rejection_reason: Optional[str] = None


class GoodsReceiptNoteSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: Optional[int] = None
    company_id: int = 1
    grn_number: str
    po_number: str
    vendor_code: str
    receipt_date: date
    warehouse_id: str = "WH-BLR-01"
    carrier_name: Optional[str] = None
    received_quantity: float
    accepted_quantity: float
    rejected_quantity: float
    quality_inspection_status: str = "PASSED"
    rejection_reason: Optional[str] = None
    items: List[GRNItemSchema] = []
    created_at: Optional[datetime] = None


class InvoiceItemSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    line_number: int
    item_code: str
    description: str
    quantity: float
    unit_price: float
    total_price: float


class InvoiceSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: Optional[int] = None
    company_id: int = 1
    invoice_number: str
    po_number: Optional[str] = None
    vendor_code: str
    vendor_name: str
    invoice_date: date
    due_date: date
    subtotal_amount: float
    tax_amount: float
    total_amount: float
    currency: str = "INR"
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    payment_status: str = "PENDING_APPROVAL"
    items: List[InvoiceItemSchema] = []
    raw_text: Optional[str] = None
    created_at: Optional[datetime] = None


class VendorMasterSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: Optional[int] = None
    company_id: int = 1
    vendor_code: str
    vendor_name: str
    category: str = "IT & Hardware"
    gst_number: Optional[str] = None
    registered_bank_name: Optional[str] = None
    registered_bank_account: Optional[str] = None
    registered_ifsc: Optional[str] = None
    avg_lead_time_days: float = 7.0
    delivery_fill_rate: float = 100.0
    total_orders_completed: int = 0
    discrepancy_count: int = 0
    bank_change_count: int = 0
    compliance_status: str = "COMPLIANT"
    risk_label: str = "LOW"
    raw_text: Optional[str] = None
    updated_at: Optional[datetime] = None


# ============================================================================
# 2. MACHINE LEARNING BASELINE PERFORMANCE SCHEMAS
# ============================================================================

class MLModelMetricsSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    model_name: str
    model_type: str
    dataset_version: str
    training_timestamp: datetime
    samples_count: int
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1_score: Optional[float] = None
    anomaly_outlier_ratio: Optional[float] = None
    metrics_json: Dict[str, Any] = {}
    status: str = "TRAINED"


class Model4PerformanceSummarySchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    document_classifier: MLModelMetricsSchema
    invoice_risk_classifier: MLModelMetricsSchema
    financial_anomaly_detector: MLModelMetricsSchema
    vendor_risk_predictor: MLModelMetricsSchema
    dataset_version: str
    last_retrained_at: datetime
    is_synthetic: bool = True
    notice: str = "Synthetic enterprise dataset & baseline demonstration models."


# ============================================================================
# 3. PREDICTIVE VALIDATION SCHEMAS
# ============================================================================

class SupportingEvidenceItem(BaseModel):
    category: str  # MATCH, QUANTITY, PRICE, DUPLICATE, ML_ANOMALY, VENDOR_RISK
    severity: str  # INFO, WARNING, CRITICAL
    description: str
    observed_value: Any
    expected_value: Any


class DecisionRecordSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: Optional[int] = None
    validation_id: int
    action: str  # approve | reject | hold
    previous_status: str
    new_status: str
    manager_remarks: Optional[str] = None
    user_id: str = "manager_1"
    user_role: str = "manager"
    created_at: Optional[datetime] = None


class ValidationResultSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: Optional[int] = None
    validation_number: str
    invoice_number: str
    po_number: Optional[str] = None
    grn_number: Optional[str] = None
    vendor_code: str
    vendor_name: str
    three_way_match_status: str
    quantity_delta: float
    price_delta: float
    is_duplicate: bool
    doc_classification_label: str
    doc_classification_confidence: float
    invoice_risk_prediction: str
    invoice_risk_confidence: float
    anomaly_prediction: str
    anomaly_score: float
    vendor_risk_prediction: str
    vendor_risk_confidence: float
    composite_risk_score: float
    risk_level: str
    financial_exposure: float
    recommendations: List[str] = []
    supporting_evidence: List[Dict[str, Any]] = []
    decision_status: str = "PENDING_REVIEW"
    created_at: Optional[datetime] = None
    decisions: List[DecisionRecordSchema] = []


class RunValidationRequest(BaseModel):
    invoice_number: str
    po_number: Optional[str] = None
    grn_number: Optional[str] = None


class DecisionRequest(BaseModel):
    validation_id: int
    action: str = Field(..., pattern="^(approve|reject|hold)$")
    manager_remarks: Optional[str] = None
    user_id: str = "manager_1"


class ResetDemoRequest(BaseModel):
    seed: int = 42
    dataset_version: str = "v4.0.0-seed-42"


class ResetDemoResponse(BaseModel):
    success: bool
    message: str
    seed: int
    batch_name: str
    dataset_version: str
    timestamp: datetime
    counts: Dict[str, Any]
    metrics: Dict[str, Any]


# ============================================================================
# 4. BILL / INVOICE UPLOAD & 3-WAY MATCHING SCHEMAS
# ============================================================================

class BillUploadTextPayload(BaseModel):
    raw_text: str
    po_number: Optional[str] = None
    grn_number: Optional[str] = None
    vendor_code: Optional[str] = None


class ExtractedBillDetails(BaseModel):
    invoice_number: str
    po_number: Optional[str] = None
    vendor_code: str
    vendor_name: str
    subtotal_amount: float
    tax_amount: float
    total_amount: float
    bank_account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    items: List[Dict[str, Any]] = []
    ocr_confidence: float = 0.95
    extraction_source: str = "OCR_PARSER"


class ThreeWayComparisonView(BaseModel):
    invoice_number: str
    po_number: Optional[str] = None
    grn_number: Optional[str] = None
    vendor_name: str
    quantity_status: str
    price_status: str
    bank_status: str
    billed_quantity: float
    accepted_quantity: float
    billed_unit_price: float
    contract_unit_price: float
    registered_bank_account: Optional[str] = None
    invoiced_bank_account: Optional[str] = None


class BillUploadResponse(BaseModel):
    success: bool
    message: str
    extracted_bill: ExtractedBillDetails
    three_way_comparison: ThreeWayComparisonView
    validation_result: ValidationResultSchema
    raw_ocr_text: str


# ============================================================================
# 5. DASHBOARD TELEMETRY SCHEMAS
# ============================================================================

class Model4DashboardTelemetry(BaseModel):
    total_purchase_orders: int
    total_goods_receipts: int
    total_invoices: int
    total_vendors: int
    total_validations: int
    match_status_breakdown: Dict[str, int]
    risk_level_breakdown: Dict[str, int]
    pending_review_count: int
    approved_count: int
    rejected_count: int
    held_count: int
    total_financial_exposure: float
    ml_models: Dict[str, Any]
    recent_validations: List[ValidationResultSchema]
    is_synthetic: bool = True
    dataset_version: str
    batch_name: str = "Q1 Enterprise IT Hardware & Compute Upgrades"
