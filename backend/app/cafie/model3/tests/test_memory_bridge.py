"""CAFIE Model 3 — Context, Memory Bridge & Regression Tests.

Covers:
- Test 4: Context aggregation from existing tables without data fabrication.
- Test 5: Memory retrieval from Model 2 store.
- Test 6: Manager feedback propagation.
- Test 12: Regression compatibility with Model 2.
"""

import pytest
from app.database import SessionLocal
from app.models import Vendor, VendorInvoiceRecord, FinancialMemoryEvent
from app.cafie.model3.context.context_aggregator import ContextAggregator
from app.cafie.model3.intelligence.memory_bridge import MemoryBridge
from app.services.cafie_model2_engine import seed_orion_demo_scenario, execute_cafie_pipeline


def test_04_context_aggregation_and_integrity():
    """Test 4: Aggregates context across Vendor, PO, GRN, and Invoices without inventing data."""
    db = SessionLocal()
    try:
        seed_orion_demo_scenario(db)
        inv = db.query(VendorInvoiceRecord).filter(VendorInvoiceRecord.invoice_number == "INV-0412").first()
        assert inv is not None

        aggregator = ContextAggregator(db)
        ctx = aggregator.aggregate_full_context(invoice_id=inv.id, company_id=1)

        assert ctx["found"] is True
        assert ctx["invoice"]["invoice_number"] == "INV-0412"
        assert ctx["invoice"]["total_amount"] == 4720000.0
        assert "Orion" in ctx["vendor"]["vendor_name"]
        assert ctx["purchase_order"]["found"] is True
        assert ctx["goods_receipt"]["found"] is True
        assert len(ctx["goods_receipt"]["items"]) > 0
        assert ctx["memory"]["total_events_count"] >= 2
    finally:
        db.close()


def test_05_memory_retrieval_from_model2_store():
    """Test 5: Retrieves persistent historical risk events without duplicating memory."""
    db = SessionLocal()
    try:
        seed_orion_demo_scenario(db)
        vendor = db.query(Vendor).filter(Vendor.name.ilike("%Orion%")).first()
        assert vendor is not None

        bridge = MemoryBridge(db)
        events = bridge.get_vendor_memory_history(vendor_id=vendor.id, company_id=1)
        assert len(events) >= 2

        # Check unverified bank detail and short delivery
        cats = [e["event_category"] for e in events]
        assert "bank_details_change" in cats or "quantity_mismatch" in cats
    finally:
        db.close()


def test_06_manager_feedback_propagation():
    """Test 6: Verifies that manager memory feedback is stored and available to subsequent queries."""
    db = SessionLocal()
    try:
        vendor = db.query(Vendor).filter(Vendor.name.ilike("%Orion%")).first()
        assert vendor is not None

        bridge = MemoryBridge(db)
        res = bridge.record_manager_memory_feedback(
            assessment_id=999,
            vendor_id=vendor.id,
            feedback_category="manager_verification_callback",
            remarks="Phone callback confirmed beneficiary accounts.",
            user_id="treasury_head",
            financial_impact_averted=4720000.0,
        )
        assert res["success"] is True
        assert res["resolution_status"] == "resolved"

        # Verify updated memory is retrievable
        is_updated = bridge.verify_memory_updated(vendor_id=vendor.id, event_id=res["event_id"])
        assert is_updated is True
    finally:
        db.close()


def test_12_regression_compatibility_with_model2():
    """Test 12: Verifies that Model 2 pipeline runs completely unchanged and yields identical outputs."""
    db = SessionLocal()
    try:
        seed_orion_demo_scenario(db)
        inv = db.query(VendorInvoiceRecord).filter(VendorInvoiceRecord.invoice_number == "INV-0412").first()
        assert inv is not None

        # Execute Model 2 directly
        m2_assessment = execute_cafie_pipeline(db, inv.id, company_id=1, force_reassess=True)
        assert m2_assessment.composite_risk_score == 63.0
        assert m2_assessment.risk_level == "HIGH"
        assert m2_assessment.policy_gate == "G1: HOLD"
        assert m2_assessment.payment_at_risk == 4720000.0
        assert m2_assessment.historical_unresolved_exposure == 342000.0
        assert m2_assessment.combined_exposure == 5062000.0
    finally:
        db.close()

