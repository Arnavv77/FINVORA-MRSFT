"""CAFIE Model 3 — REST API Router.

Exposes endpoints for:
- Service health & diagnostic monitoring
- Internal service registry
- Mock adapter status
- Workflow orchestration execution
- Decision coordination & human actions
- Additive audit history
- Event bus history
"""

from __future__ import annotations
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import SessionLocal
from .schemas.workflow_schema import (
    WorkflowExecutionRequest,
    WorkflowExecutionResult,
    DecisionActionRequest,
    DecisionActionResult,
)
from .schemas.health_schema import SystemHealthReport
from .integration.service_registry import get_service_registry
from .integration.integration_manager import get_integration_manager
from .integration.event_dispatcher import get_event_dispatcher
from .orchestration.workflow_orchestrator import WorkflowOrchestrator
from .orchestration.decision_coordinator import DecisionCoordinator
from .reliability.health_monitor import HealthMonitor
from .audit.decision_audit import get_decision_audit
from .adapters.mock_sap_adapter import MockSapAdapter
from .adapters.mock_wms_adapter import MockWmsAdapter
from .adapters.mock_erp_adapter import MockErpAdapter

router = APIRouter(prefix="/api/cafie/model3", tags=["CAFIE Model 3 — Integration & Reliability"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/health", response_model=SystemHealthReport)
def get_model3_health(db: Session = Depends(get_db)):
    """Returns comprehensive health, component latencies, and uptime across CAFIE."""
    get_integration_manager()  # Ensure default services are registered
    return HealthMonitor.check_system_health(db=db)


@router.get("/services")
def list_registered_services():
    """Lists all registered internal CAFIE services, their status, latency, and capabilities."""
    mgr = get_integration_manager()
    registry = get_service_registry()
    services = registry.list_services()
    return {
        "services": [s.dict() for s in services],
        "total_count": len(services),
    }


@router.get("/adapters")
def get_adapters_status():
    """Returns operational status of all ERP, WMS, and Accounting adapters."""
    sap = MockSapAdapter()
    wms = MockWmsAdapter()
    erp = MockErpAdapter()
    return {
        "adapters": [
            sap.check_health(),
            wms.check_health(),
            erp.check_health(),
        ],
        "all_mock": True,
        "mode": "SYNTHETIC_DEMO",
    }


@router.post("/workflow/execute", response_model=WorkflowExecutionResult)
def execute_workflow(request: WorkflowExecutionRequest, db: Session = Depends(get_db)):
    """
    Executes the 10-step Model 3 Workflow Orchestration pipeline,
    delegating evaluation to Model 2's deterministic 13-stage engine.
    """
    orchestrator = WorkflowOrchestrator(db)
    result = orchestrator.execute_workflow(request)
    return result


@router.post("/workflow/action", response_model=DecisionActionResult)
def execute_decision_action(request: DecisionActionRequest, db: Session = Depends(get_db)):
    """
    Coordinates human verification and approval actions,
    enforcing Policy Gate G1 and delegating to Model 2's human action engine.
    """
    coordinator = DecisionCoordinator(db)
    return coordinator.execute_decision_action(request)


@router.get("/audit")
def get_model3_audit(
    workflow_id: Optional[str] = Query(None),
    vendor_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    """Returns additive audit logs for Model 3 workflow runs."""
    audit = get_decision_audit()
    records = audit.get_workflow_audit_history(
        workflow_id=workflow_id,
        vendor_id=vendor_id,
        limit=limit,
    )
    return {
        "audit_records": records,
        "count": len(records),
    }


@router.get("/events")
def get_recent_events(limit: int = Query(50, ge=1, le=100)):
    """Returns event dispatcher message history."""
    dispatcher = get_event_dispatcher()
    events = dispatcher.get_history(limit=limit)
    return {
        "events": [e.dict() for e in events],
        "count": len(events),
    }
