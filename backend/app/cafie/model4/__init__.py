"""FINVORA CAFIE Model 4 — Enterprise Document Intelligence & Predictive Validation Engine.

Strictly additive intelligence module featuring:
1. Four Enterprise Data Types: Purchase Orders, Goods Receipt Notes, Invoices, Vendor Master.
2. Four Baseline ML Models: Document Classifier, Invoice Risk Classifier, Financial Anomaly Detector, Vendor Risk Predictor.
3. Three-Way PO-GRN-Invoice Predictive Validation & Duplicate Detection.
4. Deterministic Demo Seeding & In-Memory Model Retraining with Metrics Tracking.
5. Explainable Risk Scoring, Confidence Scores, and Human-in-the-Loop Governance.
"""

from app.cafie.model4.models import (
    Model4PurchaseOrder,
    Model4GoodsReceiptNote,
    Model4Invoice,
    Model4VendorMaster,
    Model4MLMetadata,
    Model4ValidationResult,
    Model4DecisionRecord,
)
from app.cafie.model4.ml_engine import ml_engine
from app.cafie.model4.validator import Model4PredictiveValidator
from app.cafie.model4.router import router

__version__ = "4.0.0"

__all__ = [
    "Model4PurchaseOrder",
    "Model4GoodsReceiptNote",
    "Model4Invoice",
    "Model4VendorMaster",
    "Model4MLMetadata",
    "Model4ValidationResult",
    "Model4DecisionRecord",
    "ml_engine",
    "Model4PredictiveValidator",
    "router",
]
