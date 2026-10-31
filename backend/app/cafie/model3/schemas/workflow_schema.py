"""CAFIE Model 3 — Workflow Schemas."""

from __future__ import annotations
from enum import Enum
from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class WorkflowStatus(str, Enum):
    INITIALIZED = "INITIALIZED"
    VALIDATING = "VALIDATING"
    EVALUATING = "EVALUATING"
    REQUIRES_VERIFICATION = "REQUIRES_VERIFICATION"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    FAILED = "FAILED"


class WorkflowExecutionRequest(BaseModel):
    invoice_id: int
    company_id: int = 1
    force_reassess: bool = False
    idempotency_key: Optional[str] = None
    requested_by: str = "system"


class WorkflowExecutionResult(BaseModel):
    workflow_id: str
    invoice_id: int
    company_id: int = 1
    status: WorkflowStatus
    model2_assessment_id: Optional[int] = None
    risk_score: float = 0.0
    risk_level: str = "LOW"
    policy_gate: str = "CLEARED"
    payment_at_risk: float = 0.0
    historical_unresolved_exposure: float = 0.0
    combined_exposure: float = 0.0
    execution_time_ms: float = 0.0
    stage_timings: List[Dict[str, Any]] = Field(default_factory=list)
    evidence_count: int = 0
    memory_events_count: int = 0
    explanation: Optional[str] = None
    recommended_action: Optional[str] = None
    idempotency_key: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    errors: List[str] = Field(default_factory=list)


class DecisionActionRequest(BaseModel):
    workflow_id: str
    assessment_id: int
    action: str  # approve, reject, hold_for_verification, verify_bank
    verification_confirmed: bool = False
    verification_method: Optional[str] = None
    manager_remarks: Optional[str] = None
    user_id: str = "manager_1"
    user_role: str = "manager"


class DecisionActionResult(BaseModel):
    workflow_id: str
    assessment_id: int
    action: str
    status: str
    new_risk_score: Optional[float] = None
    new_policy_gate: Optional[str] = None
    sap_posting_status: Optional[str] = None
    manager_remarks: Optional[str] = None
    audit_id: Optional[int] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

