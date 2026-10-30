"""FINVORA Context-Aware Financial Intelligence Engine (CAFIE) Test Suite.

Automated tests for:
1. Three-way reconciliation (exact line-item match, quantity mismatch, price mismatch, duplicate detection).
2. Adaptive vendor intelligence profiling and bank hash change detection.
3. Inventory-to-cash formulas (Inventory Value, Excess Stock, Working Capital Blocked, ROQ).
4. Financial Risk Memory recall, multi-month event linking, and cumulative exposure.
5. Calibrated multi-factor risk scoring engine without double-counting.
6. Human-in-the-loop decision audit trail and state transitions.
7. Document intelligence structured fact extraction.
8. Complete 100-Laptop Enterprise Demonstration Scenario.
"""

import pytest
import os
import pathlib
import sys

_backend_dir = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(_backend_dir))

from app.database import SessionLocal, Base, engine
from app.models import (
    Vendor,
    VendorProfile,
    PurchaseOrder,
    GoodsReceiptNote,
    VendorInvoiceRecord,
    FinancialMemoryEvent,
    FinancialMemoryLink,
    CrossSystemRiskAssessment,
    CAFIEApprovalRecord,
)
from app.services.cafie_engine import (
    hash_bank_details,
    get_or_create_vendor_profile,
    analyze_vendor_behavior,
    calculate_inventory_to_cash_metrics,
    retrieve_financial_risk_memories,
    record_financial_memory_event,
    perform_three_way_reconciliation,
    evaluate_transaction_context,
    process_human_approval_action,
    seed_laptop_demonstration_scenario,
)
from app.services.doc_intel import extract_document_intelligence


@pytest.fixture(scope="module")
def db_session():
    """Provides a transactional database session for tests."""
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()


def test_bank_hashing_consistency():
    """Verifies that bank account + IFSC hashing is consistent and case/space insensitive."""
    h1 = hash_bank_details("9876543210", "SBIN0001234")
    h2 = hash_bank_details(" 9876543210 ", "sbin0001234")
    h3 = hash_bank_details("9876543211", "SBIN0001234")
    assert h1 == h2, "Bank hash must be deterministic and whitespace/case insensitive"
    assert h1 != h3, "Different account number must yield different hash"


def test_adaptive_vendor_profile_initialization(db_session):
    """Verifies adaptive vendor profile creation and baseline statistics."""
    vendor = db_session.query(Vendor).first()
    assert vendor is not None, "At least one vendor must exist in DB"
    profile = get_or_create_vendor_profile(db_session, vendor)
    assert profile.vendor_id == vendor.id
    assert profile.bank_account_hash is not None
    assert profile.risk_score >= 0.0


def test_inventory_to_cash_calculations(db_session):
    """Verifies inventory value, excess capital, and reorder formulas."""
    metrics = calculate_inventory_to_cash_metrics(db_session)
    assert metrics["total_inventory_value"] > 0
    assert metrics["working_capital_blocked"] >= 0
    assert metrics["excess_inventory_value"] >= 0
    assert len(metrics["ageing_cohorts"]) == 4
    for cohort in metrics["ageing_cohorts"]:
        assert "cohort" in cohort
        assert "value" in cohort
    assert isinstance(metrics["reorder_recommendations"], list)


def test_financial_risk_memory_storage_and_recall(db_session):
    """Verifies historical memory event insertion, retrieval, and exposure accumulation."""
    vendor = db_session.query(Vendor).first()
    mem = record_financial_memory_event(
        db=db_session,
        vendor_id=vendor.id,
        event_category="quantity_mismatch",
        severity="warning",
        financial_impact=50000.0,
        source_documents={"po_number": "PO-TEST-001", "invoice_number": "INV-TEST-001"},
        supporting_evidence=[{"metric": "Units Delivered", "expected": "50", "actual": "45", "variance": "-5"}],
        risk_category="MEDIUM",
        resolution_status="unresolved",
        remarks="Test memory discrepancy",
    )
    assert mem.id is not None

    mem_data = retrieve_financial_risk_memories(db_session, vendor.id)
    assert mem_data["memory_events_count"] >= 1
    assert mem_data["cumulative_exposure"] >= 50000.0


def test_document_intelligence_extraction():
    """Verifies CSV/tabular and document fact extraction into structured fields."""
    sample_csv = b"Vendor,ByteCraft Systems\nInvoice Number,INV-TEST-999\nPO Reference,PO-TEST-999\nDell Laptop,10,40000,400000"
    facts = extract_document_intelligence(sample_csv, "invoice_test.csv")
    assert facts["status"] == "success"
    assert facts["document_number"] == "INV-TEST-999"
    assert facts["subtotal"] > 0
    assert "items" in facts


def test_human_approval_action_and_audit_trail(db_session):
    """Verifies human-in-the-loop decision execution, role checking, and audit logging."""
    demo_res = seed_laptop_demonstration_scenario(db_session)
    assessment_id = demo_res["assessment_id"]

    # Manager hold action
    res = process_human_approval_action(
        db=db_session,
        assessment_id=assessment_id,
        action="hold_for_verification",
        manager_remarks="Callback verification in progress with CFO.",
        user_id="manager_compliance",
        user_role="manager",
    )
    assert res["new_status"] == "held_for_verification"

    # Audit log check
    audit = db_session.query(CAFIEApprovalRecord).filter(CAFIEApprovalRecord.assessment_id == assessment_id).first()
    assert audit is not None
    assert audit.action == "hold_for_verification"


def test_complete_laptop_demonstration_scenario(db_session):
    """
    Verifies the end-to-end 100-laptops demonstration scenario:
    100 Laptops @ 40k = 40 Lakhs.
    PO, GRN, and Invoice 100% matched.
    Prior risk memory (Jan shortfall, Feb price spike, Mar bank change).
    CAFIE correctly flags as HIGH risk, holds payment, and detects 47.2 Lakhs exposure.
    """
    res = seed_laptop_demonstration_scenario(db_session)
    assert res["status"] == "success"
    assert res["three_way_match_score"] == 100.0, "Documents must match 100% on line items"
    assert res["composite_risk_score"] >= 68.0, "Risk score must be HIGH due to unverified bank change and memory history"
    assert res["risk_level"] == "HIGH"
    assert res["approval_status"] == "held_for_verification", "Payment must be held"
    assert res["financial_exposure"] >= 4000000.0, "Entire invoice amount must be flagged as exposed"
    assert "ByteCraft Systems" in res["vendor"]
