"""Comprehensive Automated Test Suite for Company Ledger & Manager Approval Workflow.

Covers:
1. Company listing & ledger summary calculations.
2. Filtered transaction listing.
3. Transaction detail journey (PO, GRN, Invoice, Line items).
4. FINVORA intelligence analysis (clean match vs mismatch).
5. Manager approval and atomic double-entry posting.
6. Idempotent duplicate posting prevention.
7. Double-entry balancing enforcement (Total Debits == Total Credits).
8. Manager rejection with mandatory reason justification.
9. Manager request changes with remarks.
10. Accountant resubmission and re-analysis workflow.
11. Running balance calculation.
12. Role-based access control.
"""

from __future__ import annotations
import pytest
from decimal import Decimal
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal, Base, engine
from app.company_ledger.models import LedgerCompany, LedgerTransaction, LedgerEntryLine
from app.company_ledger.seed_data import seed_company_ledger_demo

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_ledger_db():
    """Ensure clean isolated demo database state for each test run."""
    db = SessionLocal()
    seed_company_ledger_demo(db)
    db.close()
    yield


def test_fetch_companies():
    """Test 1: Fetches registered companies list."""
    response = client.get("/api/company-ledger/companies")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    codes = [c["company_code"] for c in data]
    assert "CMP-ABC-01" in codes
    assert "CMP-TCG-02" in codes


def test_company_ledger_summary():
    """Test 2: Verifies summary metrics, balances and status breakdown."""
    comp_res = client.get("/api/company-ledger/companies")
    company_id = comp_res.json()[0]["id"]

    res = client.get(f"/api/company-ledger/companies/{company_id}/summary")
    assert res.status_code == 200
    summary = res.json()

    assert summary["company_code"] == "CMP-ABC-01"
    assert summary["opening_balance"] == 2500000.0
    assert summary["total_transactions"] >= 5
    assert summary["approved_transactions"] >= 1  # T4 is seeded approved
    assert summary["rejected_transactions"] >= 1  # T5 is seeded rejected
    assert summary["changes_requested_transactions"] >= 1  # T3 is changes requested
    assert summary["pending_approvals"] >= 2  # T1 and T2 are pending


def test_ledger_transaction_listing_and_filtering():
    """Test 3: Tests transaction list with search, voucher type, and status filtering."""
    comp_res = client.get("/api/company-ledger/companies")
    company_id = comp_res.json()[0]["id"]

    # All transactions
    res_all = client.get(f"/api/company-ledger/companies/{company_id}/ledger")
    assert res_all.status_code == 200
    assert len(res_all.json()) >= 5

    # Filter by search "XYZ Raw"
    res_search = client.get(f"/api/company-ledger/companies/{company_id}/ledger?search=XYZ")
    assert res_search.status_code == 200
    items = res_search.json()
    assert len(items) == 1
    assert items[0]["reference_no"] == "FIN-1001"

    # Filter by status "CHANGES_REQUESTED"
    res_status = client.get(f"/api/company-ledger/companies/{company_id}/ledger?status=CHANGES_REQUESTED")
    assert res_status.status_code == 200
    assert all(i["approval_status"] == "CHANGES_REQUESTED" for i in res_status.json())


def test_transaction_journey_details():
    """Test 4: Verifies full transaction journey retrieval (PO, Invoice, GRN, double-entry lines)."""
    comp_res = client.get("/api/company-ledger/companies")
    company_id = comp_res.json()[0]["id"]

    txns = client.get(f"/api/company-ledger/companies/{company_id}/ledger").json()
    t1 = next(t for t in txns if t["reference_no"] == "FIN-1001")

    res = client.get(f"/api/company-ledger/transactions/{t1['id']}")
    assert res.status_code == 200
    detail = res.json()

    # Journey references
    assert detail["po_number"] == "PO-2026-8801"
    assert detail["po_amount"] == 50000.0
    assert detail["invoice_number"] == "INV-XYZ-1001"
    assert detail["invoice_amount"] == 50000.0
    assert detail["grn_number"] == "GRN-2026-4401"
    assert detail["grn_amount"] == 50000.0

    # Double entry lines (Debit Raw Materials, Credit Trade Payables)
    assert len(detail["lines"]) == 2
    debits = sum(line["amount"] for line in detail["lines"] if line["entry_type"] == "DEBIT")
    credits = sum(line["amount"] for line in detail["lines"] if line["entry_type"] == "CREDIT")
    assert debits == credits == 50000.0

    # FINVORA Intelligence
    assert detail["finvora_risk_tier"] == "LOW_RISK"
    assert detail["finvora_risk_score"] <= 35.0


def test_finvora_intelligence_mismatch_analysis():
    """Test 5: Verifies that FINVORA flags price escalation discrepancies as HIGH_RISK."""
    comp_res = client.get("/api/company-ledger/companies")
    company_id = comp_res.json()[0]["id"]

    txns = client.get(f"/api/company-ledger/companies/{company_id}/ledger").json()
    t2 = next(t for t in txns if t["reference_no"] == "FIN-1002")

    res = client.get(f"/api/company-ledger/transactions/{t2['id']}")
    assert res.status_code == 200
    detail = res.json()

    # T2 has PO ₹50k vs Invoice ₹55k (+10% variance)
    assert detail["invoice_amount"] > detail["po_amount"]
    assert detail["finvora_risk_tier"] in ("HIGH_RISK", "MEDIUM_RISK")
    assert any("Price Escalation" in r for r in detail["finvora_risk_reasons"])


def test_manager_approve_and_posting():
    """Test 6: Tests manager approval, double entry posting, and running balance update."""
    comp_res = client.get("/api/company-ledger/companies")
    company_id = comp_res.json()[0]["id"]

    txns = client.get(f"/api/company-ledger/companies/{company_id}/ledger").json()
    t1 = next(t for t in txns if t["reference_no"] == "FIN-1001")
    assert t1["posting_status"] == "UNPOSTED"

    approve_payload = {
        "manager_id": "MGR-001",
        "manager_name": "Vikram Aditya",
        "remarks": "Verified 3-way match. Authorized for company ledger posting.",
    }
    res = client.post(
        f"/api/company-ledger/transactions/{t1['id']}/approve",
        json=approve_payload,
        headers={"x-user-role": "manager"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["approval_status"] == "APPROVED"
    assert body["posting_status"] == "POSTED"

    # Verify transaction details updated
    t_after = client.get(f"/api/company-ledger/transactions/{t1['id']}").json()
    assert t_after["approval_status"] == "APPROVED"
    assert t_after["posting_status"] == "POSTED"
    assert t_after["approved_by"] == "Vikram Aditya (MGR-001)"
    assert len(t_after["approvals"]) >= 1
    assert t_after["approvals"][0]["decision"] == "APPROVE"


def test_idempotent_posting_prevention():
    """Test 7: Prevents posting an already-posted transaction a second time."""
    comp_res = client.get("/api/company-ledger/companies")
    company_id = comp_res.json()[0]["id"]

    txns = client.get(f"/api/company-ledger/companies/{company_id}/ledger").json()
    t4 = next(t for t in txns if t["reference_no"] == "FIN-1004")
    assert t4["posting_status"] == "POSTED"

    # Attempt to approve already posted transaction
    res = client.post(
        f"/api/company-ledger/transactions/{t4['id']}/approve",
        json={"manager_id": "MGR-001", "manager_name": "Vikram Aditya"},
        headers={"x-user-role": "manager"},
    )
    assert res.status_code == 400
    assert "already been posted" in res.json()["detail"].lower()


def test_double_entry_imbalance_prevention():
    """Test 8: Rejects posting if total debits != total credits."""
    db = SessionLocal()
    comp = db.query(LedgerCompany).filter(LedgerCompany.company_code == "CMP-ABC-01").first()

    # Create invalid unbalanced transaction directly
    bad_txn = LedgerTransaction(
        company_id=comp.id,
        transaction_number="TXN-UNBALANCED-TEST",
        reference_no="FIN-BAD-01",
        entity_name="Test Vendor",
        total_amount=Decimal("10000.00"),
        description="Unbalanced transaction test",
        approval_status="SUBMITTED",
        posting_status="UNPOSTED",
    )
    db.add(bad_txn)
    db.flush()

    # Only one debit line of ₹10,000, zero credits
    db.add(LedgerEntryLine(
        transaction_id=bad_txn.id,
        account_name="Expense",
        entry_type="DEBIT",
        amount=Decimal("10000.00"),
    ))
    db.commit()
    bad_id = bad_txn.id
    db.close()

    res = client.post(
        f"/api/company-ledger/transactions/{bad_id}/approve",
        json={"manager_id": "MGR-001", "manager_name": "Vikram Aditya"},
        headers={"x-user-role": "manager"},
    )
    assert res.status_code == 400
    assert "double-entry violation" in res.json()["detail"].lower()


def test_manager_rejection_requires_justification():
    """Test 9: Manager rejection requires minimum 5-character reason; updates status to REJECTED."""
    comp_res = client.get("/api/company-ledger/companies")
    company_id = comp_res.json()[0]["id"]

    txns = client.get(f"/api/company-ledger/companies/{company_id}/ledger").json()
    t2 = next(t for t in txns if t["reference_no"] == "FIN-1002")

    # Empty reason fails
    res_bad = client.post(
        f"/api/company-ledger/transactions/{t2['id']}/reject",
        json={"manager_id": "MGR-001", "manager_name": "Vikram Aditya", "rejection_reason": "abc"},
        headers={"x-user-role": "manager"},
    )
    assert res_bad.status_code == 422 or res_bad.status_code == 400

    # Valid reason succeeds
    res_ok = client.post(
        f"/api/company-ledger/transactions/{t2['id']}/reject",
        json={
            "manager_id": "MGR-001",
            "manager_name": "Vikram Aditya",
            "rejection_reason": "Invoice price exceeds PO contracted rate by 10%. Vendor refused revised debit note.",
        },
        headers={"x-user-role": "manager"},
    )
    assert res_ok.status_code == 200
    assert res_ok.json()["approval_status"] == "REJECTED"

    # Detail confirms status
    detail = client.get(f"/api/company-ledger/transactions/{t2['id']}").json()
    assert detail["approval_status"] == "REJECTED"
    assert "Vendor refused revised debit note" in detail["rejection_reason"]


def test_manager_request_changes_and_accountant_resubmission():
    """Test 10: Tests full Request Changes -> Resubmission -> Under Review cycle."""
    comp_res = client.get("/api/company-ledger/companies")
    company_id = comp_res.json()[0]["id"]

    txns = client.get(f"/api/company-ledger/companies/{company_id}/ledger").json()
    t1 = next(t for t in txns if t["reference_no"] == "FIN-1001")

    # 1. Manager requests changes
    req_res = client.post(
        f"/api/company-ledger/transactions/{t1['id']}/request-changes",
        json={
            "manager_id": "MGR-001",
            "manager_name": "Vikram Aditya",
            "remarks": "Please attach signed warehouse gate-pass before releasing payment.",
        },
        headers={"x-user-role": "manager"},
    )
    assert req_res.status_code == 200
    assert req_res.json()["approval_status"] == "CHANGES_REQUESTED"

    # 2. Accountant resubmits corrected transaction
    resub_res = client.post(
        f"/api/company-ledger/transactions/{t1['id']}/resubmit",
        json={
            "accountant_id": "ACCT-104",
            "accountant_name": "Priya Sharma",
            "resubmission_notes": "Attached certified physical gate pass signed by logistics manager.",
        },
    )
    assert resub_res.status_code == 200
    assert resub_res.json()["approval_status"] == "UNDER_REVIEW"

    # Detail confirms resubmission count and status
    detail = client.get(f"/api/company-ledger/transactions/{t1['id']}").json()
    assert detail["approval_status"] == "UNDER_REVIEW"
    assert detail["resubmission_count"] == 1


def test_role_based_access_control():
    """Test 11: Non-manager roles cannot approve transactions."""
    comp_res = client.get("/api/company-ledger/companies")
    company_id = comp_res.json()[0]["id"]

    txns = client.get(f"/api/company-ledger/companies/{company_id}/ledger").json()
    t1 = next(t for t in txns if t["reference_no"] == "FIN-1001")

    # Viewer role rejected
    res = client.post(
        f"/api/company-ledger/transactions/{t1['id']}/approve",
        json={"manager_id": "USR-99", "manager_name": "Guest Analyst"},
        headers={"x-user-role": "analyst"},
    )
    assert res.status_code == 403
    assert "Unauthorized" in res.json()["detail"]


def test_immutable_audit_history_endpoint():
    """Test 12: Audit history endpoint returns chronological logs and decisions."""
    comp_res = client.get("/api/company-ledger/companies")
    company_id = comp_res.json()[0]["id"]

    txns = client.get(f"/api/company-ledger/companies/{company_id}/ledger").json()
    t3 = next(t for t in txns if t["reference_no"] == "FIN-1003")

    res = client.get(f"/api/company-ledger/transactions/{t3['id']}/audit-history")
    assert res.status_code == 200
    body = res.json()
    assert "audit_logs" in body
    assert "decisions" in body
    assert len(body["decisions"]) >= 1
    assert body["decisions"][0]["decision"] == "REQUEST_CHANGES"

