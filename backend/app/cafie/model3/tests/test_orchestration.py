"""CAFIE Model 3 — Workflow Orchestration & 3 Deterministic Scenarios.

Covers:
- Test 2: Workflow orchestration.
- Test 3: Existing CAFIE evaluation invocation.
- Test 7: Duplicate transaction handling (idempotency).
- Scenario 1: Normal invoice enters CAFIE and receives existing Model 2 evaluation.
- Scenario 2: Invoice passes matching checks but relevant vendor history affects existing CAFIE evaluation.
- Scenario 3: Manager records feedback, existing memory is updated, and next evaluation reflects that feedback according to existing CAFIE rules.
"""

import pytest
from app.database import SessionLocal
from app.models import VendorInvoiceRecord, CrossSystemRiskAssessment
from app.services.cafie_model2_engine import seed_orion_demo_scenario
from app.cafie.model3.schemas.workflow_schema import (
    WorkflowStatus,
    WorkflowExecutionRequest,
    DecisionActionRequest,
)
from app.cafie.model3.orchestration.workflow_orchestrator import WorkflowOrchestrator
from app.cafie.model3.orchestration.decision_coordinator import DecisionCoordinator


def test_02_and_03_workflow_orchestration_and_model2_invocation():
    """Test 2 & 3: Validates end-to-end workflow execution delegating evaluation to Model 2."""
    db = SessionLocal()
    try:
        seed_orion_demo_scenario(db)
        inv = db.query(VendorInvoiceRecord).filter(VendorInvoiceRecord.invoice_number == "INV-0412").first()
        assert inv is not None

        orchestrator = WorkflowOrchestrator(db)
        req = WorkflowExecutionRequest(
            invoice_id=inv.id,
            company_id=1,
            force_reassess=True,
            idempotency_key="wf-test-02-inv-412",
        )
        res = orchestrator.execute_workflow(req)

        assert res.status in (WorkflowStatus.REQUIRES_VERIFICATION, WorkflowStatus.PENDING_APPROVAL)
        assert res.model2_assessment_id is not None
        assert res.risk_score == 63.0
        assert res.risk_level == "HIGH"
        assert res.policy_gate == "G1: HOLD"
        assert res.payment_at_risk == 4720000.0
        assert res.combined_exposure == 5062000.0
        assert len(res.stage_timings) >= 11
        assert "EXECUTIVE RISK ASSESSMENT BRIEF" in res.explanation
    finally:
        db.close()


def test_07_duplicate_transaction_handling_idempotency():
    """Test 7: Validates that repeating an assessment with the same idempotency key returns the cached result without duplicate execution."""
    db = SessionLocal()
    try:
        inv = db.query(VendorInvoiceRecord).filter(VendorInvoiceRecord.invoice_number == "INV-0412").first()
        assert inv is not None

        orchestrator = WorkflowOrchestrator(db)
        key = "idemp-unique-test-key-99"

        # First run
        req1 = WorkflowExecutionRequest(invoice_id=inv.id, idempotency_key=key, force_reassess=False)
        res1 = orchestrator.execute_workflow(req1)

        # Duplicate run with identical key and force_reassess=False
        req2 = WorkflowExecutionRequest(invoice_id=inv.id, idempotency_key=key, force_reassess=False)
        res2 = orchestrator.execute_workflow(req2)

        # Must return the same workflow_id and assessment results
        assert res1.workflow_id == res2.workflow_id
        assert res1.risk_score == res2.risk_score
    finally:
        db.close()


def test_deterministic_three_scenarios():
    """
    Demonstrates the 3 Required Deterministic Scenarios via Model 3 without bypassing Model 2:
    - Scenario 1: Normal transaction enters CAFIE and receives Model 2 evaluation.
    - Scenario 2: Invoice passes matching checks but relevant vendor history affects evaluation.
    - Scenario 3: Manager records feedback, memory updates, and next evaluation reflects that feedback.
    """
    db = SessionLocal()
    try:
        # --- SCENARIO 1 & 2: Orion Tech INV-0412 ---
        # 100 laptops @ ₹40,000 matches PO/GRN perfectly (Scenario 1),
        # but historical unverified bank change & unresolved past exposure triggers Gate G1 and HIGH risk (Scenario 2).
        seed_orion_demo_scenario(db)
        inv = db.query(VendorInvoiceRecord).filter(VendorInvoiceRecord.invoice_number == "INV-0412").first()
        assert inv is not None

        orchestrator = WorkflowOrchestrator(db)
        coordinator = DecisionCoordinator(db)

        exec_res = orchestrator.execute_workflow(
            WorkflowExecutionRequest(invoice_id=inv.id, force_reassess=True, idempotency_key="scenario-run-1")
        )
        assert exec_res.risk_score == 63.0
        assert exec_res.risk_level == "HIGH"
        assert exec_res.policy_gate == "G1: HOLD"
        assert exec_res.status == WorkflowStatus.REQUIRES_VERIFICATION

        # Attempting direct approval while Gate G1 is active must be blocked (HTTP 409)
        from fastapi import HTTPException
        blocked = False
        try:
            coordinator.execute_decision_action(
                DecisionActionRequest(
                    workflow_id=exec_res.workflow_id,
                    assessment_id=exec_res.model2_assessment_id,
                    action="approve",
                    user_id="manager_1",
                    user_role="manager",
                )
            )
        except HTTPException as e:
            if e.status_code == 409:
                blocked = True
        assert blocked is True, "Scenario 2: Policy Gate G1 must block approval when bank is unverified"

        # --- SCENARIO 3: Manager Feedback & Recalculation ---
        # Manager performs verbal callback verification to CFO
        verify_action_res = coordinator.execute_decision_action(
            DecisionActionRequest(
                workflow_id=exec_res.workflow_id,
                assessment_id=exec_res.model2_assessment_id,
                action="verify_bank",
                verification_confirmed=True,
                verification_method="phone_call_signatory",
                manager_remarks="Verified beneficiary bank change with CFO Vikram Mehta over registered phone.",
                user_id="treasury_head",
                user_role="manager",
            )
        )
        assert verify_action_res.new_policy_gate == "CLEARED"
        assert verify_action_res.new_risk_score == 32.0  # Recalculated down from 63 to 32

        # Subsequent evaluation reflects that feedback and Gate is CLEARED
        db.expire_all()
        reassess_res = orchestrator.execute_workflow(
            WorkflowExecutionRequest(invoice_id=inv.id, force_reassess=False, idempotency_key="scenario-run-after-verify")
        )
        assert reassess_res.risk_score == 32.0
        assert reassess_res.risk_level == "MEDIUM"
        assert reassess_res.policy_gate == "CLEARED"

        # Manager now approves payment release -> triggers SAP posting
        approve_action_res = coordinator.execute_decision_action(
            DecisionActionRequest(
                workflow_id=reassess_res.workflow_id,
                assessment_id=reassess_res.model2_assessment_id,
                action="approve",
                manager_remarks="Approved disbursement following cleared beneficiary verification.",
                user_id="treasury_head",
                user_role="manager",
            )
        )
        assert approve_action_res.status == "approved"
        assert "POSTED" in approve_action_res.sap_posting_status
    finally:
        db.close()
