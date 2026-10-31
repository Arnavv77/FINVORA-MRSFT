"""CAFIE Model 3 — Decision Audit.

Provides structured auditing for Model 3 workflow executions and governance decisions.
Preserves all existing audit records and logs new events additively.
"""

from __future__ import annotations
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger("finvora.cafie.model3.decision_audit")


class DecisionAudit:
    """Manages additive workflow audit trails."""

    _instance: Optional[DecisionAudit] = None

    def __new__(cls) -> DecisionAudit:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._records: List[Dict[str, Any]] = []
            cls._instance._max_records: int = 1000
        return cls._instance

    def record_workflow_event(
        self,
        workflow_id: str,
        transaction_id: int,
        vendor_id: int,
        status: str,
        model2_assessment_id: Optional[int] = None,
        risk_score: float = 0.0,
        risk_level: str = "LOW",
        policy_gate: str = "CLEARED",
        manager_action: Optional[str] = None,
        feedback_status: Optional[str] = None,
        error_info: Optional[str] = None,
        stage_timings: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Records an additive audit entry."""
        entry = {
            "audit_id": len(self._records) + 1,
            "workflow_id": workflow_id,
            "transaction_id": transaction_id,
            "vendor_id": vendor_id,
            "timestamp": datetime.utcnow().isoformat(),
            "status": status,
            "model2_assessment_id": model2_assessment_id,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "policy_gate": policy_gate,
            "manager_action": manager_action,
            "feedback_status": feedback_status,
            "error_info": error_info,
            "stage_timings": stage_timings or [],
        }
        self._records.append(entry)
        if len(self._records) > self._max_records:
            self._records.pop(0)

        logger.info(f"Audit recorded: Workflow {workflow_id} [{status}] Risk: {risk_score:.1f}")
        return entry

    def get_workflow_audit_history(
        self,
        workflow_id: Optional[str] = None,
        vendor_id: Optional[int] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Retrieves audit entries filtered by workflow ID or vendor ID."""
        records = self._records
        if workflow_id:
            records = [r for r in records if r["workflow_id"] == workflow_id]
        elif vendor_id:
            records = [r for r in records if r["vendor_id"] == vendor_id]

        return records[-limit:]

    def clear_records(self) -> None:
        """Clears audit records for isolated testing."""
        self._records.clear()


def get_decision_audit() -> DecisionAudit:
    """Returns the singleton instance of DecisionAudit."""
    return DecisionAudit()

