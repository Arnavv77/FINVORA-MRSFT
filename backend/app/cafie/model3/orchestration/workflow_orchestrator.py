"""CAFIE Model 3 — Workflow Orchestrator.

Coordinates transaction validation, context aggregation, financial memory access,
and Model 2 evaluation invocation with structured audit and error handling.
Does NOT implement a second risk-scoring algorithm; delegates evaluation to Model 2.
"""

from __future__ import annotations
import uuid
import time
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from ..schemas.workflow_schema import (
    WorkflowStatus,
    WorkflowExecutionRequest,
    WorkflowExecutionResult,
)
from ..integration.integration_manager import get_integration_manager
from ..integration.event_dispatcher import get_event_dispatcher
from ..context.context_validator import ContextValidator, ContextValidationError
from ..context.context_aggregator import ContextAggregator
from ..intelligence.memory_bridge import MemoryBridge
from ..intelligence.explanation_bridge import ExplanationBridge
from ..reliability.error_handler import ErrorHandler
from ..audit.decision_audit import get_decision_audit
from app.services.cafie_model2_engine import execute_cafie_pipeline

logger = logging.getLogger("finvora.cafie.model3.workflow_orchestrator")


class WorkflowOrchestrator:
    """End-to-end coordinator for CAFIE transactions and evaluation workflows."""

    def __init__(self, db: Session):
        self.db = db
        self.integration_mgr = get_integration_manager()
        self.event_dispatcher = get_event_dispatcher()
        self.context_aggregator = ContextAggregator(db)
        self.memory_bridge = MemoryBridge(db)
        self.audit = get_decision_audit()

    def execute_workflow(self, request: WorkflowExecutionRequest) -> WorkflowExecutionResult:
        """
        Executes the full 10-step Model 3 orchestration pipeline:
        1. Input validation
        2. Idempotency / duplicate protection
        3. System readiness check
        4. Context aggregation
        5. Memory retrieval
        6. Model 2 evaluation delegation
        7. Executive explanation synthesis
        8. Status classification
        9. Additive audit recording
        10. Structured response output
        """
        workflow_id = f"wf_{uuid.uuid4().hex[:12]}"
        t_start = time.perf_counter()
        errors = []

        # Step 1: Input Validation
        try:
            ContextValidator.validate_invoice_request(
                invoice_id=request.invoice_id,
                company_id=request.company_id,
            )
        except ContextValidationError as ve:
            ErrorHandler.handle_error(ve, context={"request": request.dict()}, source="context_validator")
            return WorkflowExecutionResult(
                workflow_id=workflow_id,
                invoice_id=request.invoice_id,
                company_id=request.company_id,
                status=WorkflowStatus.FAILED,
                errors=[ve.message],
            )

        # Step 2: Idempotency Protection
        idemp_key = request.idempotency_key or f"inv-{request.invoice_id}-co-{request.company_id}"
        if not request.force_reassess:
            is_dup, cached = self.integration_mgr.check_or_register_idempotency(
                idempotency_key=idemp_key,
                payload_summary={"invoice_id": request.invoice_id, "company_id": request.company_id},
            )
            if is_dup and cached and cached.get("result"):
                logger.info(f"Returning cached assessment for duplicate idempotency key: {idemp_key}")
                cached_res = cached["result"]
                return WorkflowExecutionResult(**cached_res)

        # Step 3: Check System Readiness
        is_ready, health = self.integration_mgr.check_system_readiness()
        if not is_ready:
            msg = "Core CAFIE Model 2 Engine is unavailable."
            errors.append(msg)
            return WorkflowExecutionResult(
                workflow_id=workflow_id,
                invoice_id=request.invoice_id,
                company_id=request.company_id,
                status=WorkflowStatus.FAILED,
                errors=errors,
            )

        # Step 4: Context Aggregation
        context = self.context_aggregator.aggregate_full_context(
            invoice_id=request.invoice_id,
            company_id=request.company_id,
        )
        if not context.get("found"):
            errors.append(context.get("error", "Transaction not found"))
            return WorkflowExecutionResult(
                workflow_id=workflow_id,
                invoice_id=request.invoice_id,
                company_id=request.company_id,
                status=WorkflowStatus.FAILED,
                errors=errors,
            )

        vendor_id = context["vendor"]["vendor_id"]

        # Step 5: Memory Retrieval
        memory_history = self.memory_bridge.get_vendor_memory_history(
            vendor_id=vendor_id,
            company_id=request.company_id,
            limit=10,
        )

        # Step 6: Invoke Existing Model 2 Evaluation Pipeline
        # STRICT RULE: Does NOT recalculate or invent risk formulas. Calls execute_cafie_pipeline.
        try:
            m2_assessment = execute_cafie_pipeline(
                db=self.db,
                invoice_id=request.invoice_id,
                company_id=request.company_id,
                force_reassess=request.force_reassess,
            )
        except Exception as e:
            ErrorHandler.handle_error(e, context={"invoice_id": request.invoice_id}, source="model2_engine")
            return WorkflowExecutionResult(
                workflow_id=workflow_id,
                invoice_id=request.invoice_id,
                company_id=request.company_id,
                status=WorkflowStatus.FAILED,
                errors=[f"Model 2 Evaluation Failure: {str(e)}"],
            )

        # Step 7: Explanation Synthesis
        assessment_dict = {
            "composite_risk_score": m2_assessment.composite_risk_score,
            "risk_level": m2_assessment.risk_level,
            "policy_gate": m2_assessment.policy_gate,
            "payment_at_risk": m2_assessment.payment_at_risk,
            "historical_unresolved_exposure": m2_assessment.historical_unresolved_exposure,
            "combined_exposure": m2_assessment.combined_exposure,
            "reconciliation_status": m2_assessment.reconciliation_status,
            "recommended_action": m2_assessment.recommended_action,
        }
        executive_explanation = ExplanationBridge.generate_executive_explanation(assessment_dict)

        # Step 8: Workflow Status Classification
        if "G1" in str(m2_assessment.policy_gate) or "HOLD" in str(m2_assessment.policy_gate):
            wf_status = WorkflowStatus.REQUIRES_VERIFICATION
        elif m2_assessment.approval_status == "approved":
            wf_status = WorkflowStatus.APPROVED
        elif m2_assessment.approval_status == "rejected":
            wf_status = WorkflowStatus.REJECTED
        else:
            wf_status = WorkflowStatus.PENDING_APPROVAL

        total_duration_ms = (time.perf_counter() - t_start) * 1000.0

        # Step 9: Additive Audit Recording
        audit_entry = self.audit.record_workflow_event(
            workflow_id=workflow_id,
            transaction_id=request.invoice_id,
            vendor_id=vendor_id,
            status=wf_status.value,
            model2_assessment_id=m2_assessment.id,
            risk_score=m2_assessment.composite_risk_score,
            risk_level=m2_assessment.risk_level,
            policy_gate=m2_assessment.policy_gate,
            stage_timings=m2_assessment.pipeline_execution_stages or [],
        )

        # Publish Event
        self.event_dispatcher.publish(
            event_type="workflow_completed",
            source_service="workflow_orchestrator",
            payload={
                "workflow_id": workflow_id,
                "invoice_id": request.invoice_id,
                "status": wf_status.value,
                "risk_score": m2_assessment.composite_risk_score,
            },
        )

        # Step 10: Build Structured Result
        res = WorkflowExecutionResult(
            workflow_id=workflow_id,
            invoice_id=request.invoice_id,
            company_id=request.company_id,
            status=wf_status,
            model2_assessment_id=m2_assessment.id,
            risk_score=m2_assessment.composite_risk_score,
            risk_level=m2_assessment.risk_level,
            policy_gate=m2_assessment.policy_gate,
            payment_at_risk=m2_assessment.payment_at_risk,
            historical_unresolved_exposure=m2_assessment.historical_unresolved_exposure,
            combined_exposure=m2_assessment.combined_exposure,
            execution_time_ms=round(total_duration_ms, 2),
            stage_timings=m2_assessment.pipeline_execution_stages or [],
            evidence_count=len(m2_assessment.evidence or []),
            memory_events_count=len(memory_history),
            explanation=executive_explanation,
            recommended_action=m2_assessment.recommended_action,
            idempotency_key=idemp_key,
            created_at=datetime.utcnow(),
            errors=[],
        )

        # Cache in idempotency registry
        self.integration_mgr.store_idempotency_result(idemp_key, res.dict())

        return res
