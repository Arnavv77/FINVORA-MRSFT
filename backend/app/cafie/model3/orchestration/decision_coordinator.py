"""CAFIE Model 3 — Decision Coordinator.

Coordinates human actions (bank verification, approvals, rejections, holds)
by validating permissions and delegating to Model 2's process_human_action_v2.
"""

from __future__ import annotations
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from ..schemas.workflow_schema import DecisionActionRequest, DecisionActionResult
from ..reliability.validation_service import ValidationService
from ..audit.decision_audit import get_decision_audit
from ..intelligence.memory_bridge import MemoryBridge
from app.services.cafie_model2_engine import process_human_action_v2

logger = logging.getLogger("finvora.cafie.model3.decision_coordinator")


class DecisionCoordinator:
    """Coordinates governance actions and routes to Model 2's human action handler."""

    def __init__(self, db: Session):
        self.db = db
        self.audit = get_decision_audit()
        self.memory_bridge = MemoryBridge(db)

    def execute_decision_action(self, request: DecisionActionRequest) -> DecisionActionResult:
        """
        Validates request and delegates to Model 2 process_human_action_v2.
        Records audit trail and returns structured DecisionActionResult.
        """
        # 1. Validation
        ValidationService.validate_action_request(
            action=request.action,
            user_role=request.user_role,
            user_id=request.user_id,
            verification_method=request.verification_method,
        )

        # 2. Delegate to Model 2 Human Action Engine
        # Note: If gate is active and action == "approve", process_human_action_v2
        # will raise HTTPException(409), which is expected and preserved!
        m2_result = process_human_action_v2(
            db=self.db,
            assessment_id=request.assessment_id,
            action=request.action,
            verification_confirmed=request.verification_confirmed,
            verification_method=request.verification_method,
            manager_remarks=request.manager_remarks,
            user_id=request.user_id,
            user_role=request.user_role,
        )

        # 3. Record in Model 3 Audit Trail
        audit_entry = self.audit.record_workflow_event(
            workflow_id=request.workflow_id,
            transaction_id=request.assessment_id,
            vendor_id=m2_result.get("vendor_id", 0),
            status=m2_result.get("approval_status", "updated"),
            model2_assessment_id=request.assessment_id,
            risk_score=m2_result.get("new_risk_score", 0.0),
            policy_gate=m2_result.get("new_policy_gate", "CLEARED"),
            manager_action=request.action,
            feedback_status="CONFIRMED" if request.verification_confirmed else "RECORDED",
        )

        return DecisionActionResult(
            workflow_id=request.workflow_id,
            assessment_id=request.assessment_id,
            action=request.action,
            status=m2_result.get("approval_status", "updated"),
            new_risk_score=m2_result.get("new_risk_score"),
            new_policy_gate=m2_result.get("new_policy_gate"),
            sap_posting_status=m2_result.get("sap_posting_status"),
            manager_remarks=request.manager_remarks,
            audit_id=audit_entry.get("audit_id"),
            timestamp=datetime.utcnow(),
        )
