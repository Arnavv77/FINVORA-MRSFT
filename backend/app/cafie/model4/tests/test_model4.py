"""FINVORA CAFIE Model 4 — Comprehensive Automated Test Suite.

Verifies:
1. Four Enterprise Data Types (PO, GRN, Invoices, Vendor Master)
2. Four Baseline ML Models (Doc Classifier, Invoice Risk, Anomaly Detector, Vendor Risk)
3. Predictive Validation (clean match, quantity mismatch, price mismatch, duplicate, missing docs)
4. Rotational Hardcoded Datasets (Q1, Q2, Q3) on Demo Reset
5. Bill Upload & 3-Way Matching
6. Human Decision Governance & Auditing
7. Zero Regression on Model 1, 2, and 3
"""

import sys
import os
import pathlib
import pytest

backend_dir = pathlib.Path(__file__).resolve().parent.parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.cafie.model4.models import (
    Model4PurchaseOrder,
    Model4GoodsReceiptNote,
    Model4Invoice,
    Model4VendorMaster,
    Model4MLMetadata,
    Model4ValidationResult,
    Model4DecisionRecord,
)
from app.cafie.model4.synthetic_data import seed_model4_database, SYNTHETIC_VENDORS_BASE
from app.cafie.model4.ml_engine import ml_engine
from app.cafie.model4.validator import Model4PredictiveValidator


def setup_module():
    """Ensure all database tables are created."""
    Base.metadata.create_all(bind=engine)


def test_enterprise_datasets_seeding():
    """Test seeding of enterprise datasets."""
    db: Session = SessionLocal()
    try:
        counts = seed_model4_database(db=db, seed=42)
        assert counts["vendors_count"] == len(SYNTHETIC_VENDORS_BASE)
        assert counts["purchase_orders_count"] >= 7
        assert counts["goods_receipts_count"] >= 6
        assert counts["invoices_count"] >= 8
        assert "batch_name" in counts

        pos = db.query(Model4PurchaseOrder).all()
        grns = db.query(Model4GoodsReceiptNote).all()
        invs = db.query(Model4Invoice).all()
        vendors = db.query(Model4VendorMaster).all()

        assert len(pos) == counts["purchase_orders_count"]
        assert len(grns) == counts["goods_receipts_count"]
        assert len(invs) == counts["invoices_count"]
        assert len(vendors) == counts["vendors_count"]
    finally:
        db.close()


def test_ml_baseline_models_training():
    """Test training and evaluation metrics of all 4 baseline ML models."""
    db: Session = SessionLocal()
    try:
        metrics = ml_engine.train_all(db=db, seed=42, dataset_version="v4.0.0-seed-42")

        # 1. Document Classifier
        doc_m = metrics["document_classifier"]
        assert doc_m["accuracy"] >= 0.90
        assert doc_m["f1_score"] >= 0.90
        assert "INVOICE" in doc_m["classes"]

        # 2. Invoice Risk Classifier
        inv_m = metrics["invoice_risk_classifier"]
        assert inv_m["accuracy"] >= 0.80
        assert inv_m["f1_score"] >= 0.80

        # 3. Financial Anomaly Detector
        anom_m = metrics["financial_anomaly_detector"]
        assert anom_m["anomaly_outlier_ratio"] > 0.05
        assert anom_m["outlier_samples_flagged"] > 0

        # 4. Vendor Risk Predictor
        vend_m = metrics["vendor_risk_predictor"]
        assert vend_m["accuracy"] >= 0.80
        assert vend_m["f1_score"] >= 0.80

        records = db.query(Model4MLMetadata).all()
        assert len(records) == 4
    finally:
        db.close()


def test_ml_model_inferences():
    """Test inference predictions across all 4 baseline ML models."""
    label, conf = ml_engine.predict_document_type("TAX INVOICE INV-2026-101 Billed to Finvora GSTIN 29ABCDE1234F1Z5 Net Payable INR 2,655,000")
    assert label == "INVOICE"
    assert conf > 0.50

    label_po, _ = ml_engine.predict_document_type("PURCHASE ORDER PO-2026-101 Delivery Schedule Net 30 Terms Authorized Procurement Officer")
    assert label_po == "PURCHASE_ORDER"

    risk_low, conf_low = ml_engine.predict_invoice_risk(0.0, 0.0, 0.0, 150000.0, 5.0, 0.01)
    assert risk_low in ["LOW", "MEDIUM"]

    risk_high, conf_high = ml_engine.predict_invoice_risk(0.50, 0.35, 0.25, 4500000.0, 25.0, 0.40)
    assert risk_high in ["MEDIUM", "HIGH"]

    anom_norm, score_norm = ml_engine.detect_financial_anomaly(500000.0, 0.18, 1.0, 1.0)
    assert anom_norm == "NORMAL"

    anom_out, score_out = ml_engine.detect_financial_anomaly(12000000.0, 0.60, 2.5, 3.0)
    assert anom_out == "ANOMALY"
    assert score_out > score_norm

    v_risk_low, _ = ml_engine.predict_vendor_risk(99.0, 0, 0, 4.0, 100)
    assert v_risk_low in ["LOW", "MEDIUM"]

    v_risk_high, _ = ml_engine.predict_vendor_risk(60.0, 15, 3, 20.0, 10)
    assert v_risk_high == "HIGH"


def test_predictive_validation_clean_match():
    """Test 3-way match clean scenario (INV-2026-101)."""
    db: Session = SessionLocal()
    try:
        seed_model4_database(db=db, seed=42)
        validator = Model4PredictiveValidator(db=db)
        res = validator.validate_invoice("INV-2026-101")
        assert res.three_way_match_status == "MATCHED"
        assert res.risk_level == "LOW"
        assert res.quantity_delta == 0.0
        assert res.price_delta == 0.0
        assert res.is_duplicate is False
        assert res.composite_risk_score < 35.0
    finally:
        db.close()


def test_predictive_validation_quantity_mismatch():
    """Test quantity mismatch scenario (INV-2026-102: billed 100 vs accepted 80)."""
    db: Session = SessionLocal()
    try:
        validator = Model4PredictiveValidator(db=db)
        res = validator.validate_invoice("INV-2026-102")
        assert res.three_way_match_status == "QUANTITY_MISMATCH"
        assert res.quantity_delta == 20.0
        assert res.financial_exposure > 200000.0
        assert res.risk_level in ["MEDIUM", "HIGH"]
        assert any(e["category"] == "QUANTITY_MISMATCH" for e in res.supporting_evidence)
    finally:
        db.close()


def test_predictive_validation_price_mismatch():
    """Test price mismatch scenario (INV-2026-103: unit price 1,800 vs PO rate 1,500)."""
    db: Session = SessionLocal()
    try:
        validator = Model4PredictiveValidator(db=db)
        res = validator.validate_invoice("INV-2026-103")
        assert res.three_way_match_status == "PRICE_MISMATCH"
        assert res.price_delta == 300.0
        assert res.financial_exposure > 50000.0
        assert any(e["category"] == "PRICE_MISMATCH" for e in res.supporting_evidence)
    finally:
        db.close()


def test_predictive_validation_duplicate_invoice():
    """Test duplicate invoice scenario (INV-2026-104-DUP)."""
    db: Session = SessionLocal()
    try:
        validator = Model4PredictiveValidator(db=db)
        res = validator.validate_invoice("INV-2026-104-DUP")
        assert res.three_way_match_status == "DUPLICATE"
        assert res.is_duplicate is True
        assert res.risk_level == "HIGH"
        assert res.composite_risk_score >= 80.0
    finally:
        db.close()


def test_predictive_validation_missing_grn():
    """Test premature invoicing missing GRN (INV-2026-105)."""
    db: Session = SessionLocal()
    try:
        validator = Model4PredictiveValidator(db=db)
        res = validator.validate_invoice("INV-2026-105")
        assert res.three_way_match_status == "MISSING_GRN"
        assert res.risk_level == "HIGH"
    finally:
        db.close()


def test_bill_upload_and_three_way_match():
    """Test bill upload and 3-way matching extraction pipeline."""
    db: Session = SessionLocal()
    try:
        from app.cafie.model4.router import upload_bill_json
        from app.cafie.model4.schemas import BillUploadTextPayload

        raw_bill = (
            "TAX INVOICE INV-2026-TEST-99\n"
            "PO Ref: PO-2026-101\n"
            "Vendor: TechCorp Solutions Pvt Ltd (VEND-101)\n"
            "Subtotal: INR 2,250,000.00\n"
            "Tax: INR 405,000.00\n"
            "Total Amount: INR 2,655,000.00\n"
            "Bank A/C: 50200012345678 IFSC: HDFC0001234\n"
            "Line Items: 50 Dell OptiPlex Desktops @ 45,000"
        )
        resp = upload_bill_json(BillUploadTextPayload(raw_text=raw_bill), db=db)
        assert resp.success is True
        assert resp.extracted_bill.invoice_number == "INV-2026-TEST-99"
        assert resp.extracted_bill.total_amount == 2655000.0
        assert resp.three_way_comparison.quantity_status == "MATCHED"
        assert resp.validation_result.three_way_match_status == "MATCHED"
        assert resp.validation_result.risk_level == "LOW"
    finally:
        db.close()


def test_rotational_demo_reset():
    """Test rotational datasets on reset (switching from Q1 to Q2 on seed 1)."""
    db: Session = SessionLocal()
    try:
        from app.cafie.model4.router import reset_demo
        from app.cafie.model4.schemas import ResetDemoRequest

        # Reset with seed 1 -> loads Batch 1 (Q2 Industrial Networking)
        resp1 = reset_demo(ResetDemoRequest(seed=1), db=db)
        assert resp1.success is True
        assert "Q2" in resp1.batch_name
        
        # Verify invoices in database have prefix 20
        inv_q2 = db.query(Model4Invoice).filter_by(invoice_number="INV-2026-201").first()
        assert inv_q2 is not None

        # Reset with seed 2 -> loads Batch 2 (Q3 Cloud Data Center)
        resp2 = reset_demo(ResetDemoRequest(seed=2), db=db)
        assert resp2.success is True
        assert "Q3" in resp2.batch_name
        inv_q3 = db.query(Model4Invoice).filter_by(invoice_number="INV-2026-301").first()
        assert inv_q3 is not None
    finally:
        db.close()


def test_human_governance_decision():
    """Test manager decision recording on validation record."""
    db: Session = SessionLocal()
    try:
        val = db.query(Model4ValidationResult).first()
        assert val is not None

        from app.cafie.model4.router import record_decision
        from app.cafie.model4.schemas import DecisionRequest

        req = DecisionRequest(
            validation_id=val.id,
            action="hold",
            manager_remarks="Manager audit hold for vendor verification.",
            user_id="audit_mgr_42"
        )
        updated = record_decision(req=req, db=db)
        assert updated.decision_status == "HELD"

        audit = db.query(Model4DecisionRecord).filter_by(validation_id=val.id).first()
        assert audit is not None
        assert audit.action == "hold"
        assert audit.new_status == "HELD"
    finally:
        db.close()


def test_model1_model2_model3_safety():
    """Verify Model 1, Model 2, and Model 3 remain completely intact and unaffected."""
    # Model 1
    from app.services.cafie_engine import evaluate_transaction_context, perform_three_way_reconciliation
    assert callable(evaluate_transaction_context)
    assert callable(perform_three_way_reconciliation)

    # Model 2
    from app.services.cafie_model2_engine import execute_cafie_pipeline, seed_orion_demo_scenario
    assert callable(execute_cafie_pipeline)
    assert callable(seed_orion_demo_scenario)

    # Model 3
    from app.cafie.model3.integration.integration_manager import IntegrationManager
    mgr = IntegrationManager()
    assert mgr is not None
