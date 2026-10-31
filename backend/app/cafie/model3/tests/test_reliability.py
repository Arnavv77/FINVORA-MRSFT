"""CAFIE Model 3 — Reliability & Audit Tests.

Covers:
- Test 10: Timeout, safe retries, error normalization, and non-approval safeguard.
- Test 11: Audit event creation and filtering.
"""

import pytest
from app.cafie.model3.reliability.validation_service import ValidationService, ReliabilityValidationError
from app.cafie.model3.reliability.retry_manager import RetryManager
from app.cafie.model3.reliability.error_handler import ErrorHandler
from app.cafie.model3.reliability.health_monitor import HealthMonitor
from app.cafie.model3.audit.decision_audit import get_decision_audit
from app.database import SessionLocal


def test_10_reliability_retry_and_error_handling():
    """Test 10: Validates safe retries on idempotent calls, strict non-retry on mutations, and error normalization."""
    # 1. Validation service constraints
    with pytest.raises(ReliabilityValidationError):
        ValidationService.validate_action_request(action="invalid_action", user_role="manager", user_id="u1")

    with pytest.raises(ReliabilityValidationError):
        ValidationService.validate_action_request(action="approve", user_role="unauthorized_role", user_id="u1")

    with pytest.raises(ReliabilityValidationError):
        ValidationService.validate_action_request(action="verify_bank", user_role="manager", user_id="u1", verification_method=None)

    # 2. Retry Manager: Success after transient failure on idempotent call
    attempts = [0]
    def flaky_read():
        attempts[0] += 1
        if attempts[0] < 2:
            raise ConnectionError("Temporary socket timeout")
        return "SUCCESS"

    result = RetryManager.execute_with_retry("flaky_read", flaky_read, max_retries=2, initial_backoff_sec=0.01)
    assert result == "SUCCESS"
    assert attempts[0] == 2

    # 3. Non-idempotent operation executes strictly once
    mutation_attempts = [0]
    def post_action():
        mutation_attempts[0] += 1
        raise ValueError("Posting failure")

    with pytest.raises(ValueError):
        RetryManager.execute_with_retry("post_action", post_action, max_retries=3, is_idempotent=False)
    assert mutation_attempts[0] == 1, "Non-idempotent operations must NEVER be retried!"

    # 4. Error Handler Safeguard: Fallback status is NEVER auto-approved
    err_res = ErrorHandler.handle_error(RuntimeError("Service down"), source="sap_gateway")
    assert err_res["success"] is False
    assert err_res["fallback_status"] == "REQUIRES_MANUAL_REVIEW"
    assert "auto_approve" not in err_res["fallback_status"]

    # 5. Health Monitor
    db = SessionLocal()
    try:
        report = HealthMonitor.check_system_health(db=db)
        assert report.system_status in ("OPERATIONAL", "DEGRADED")
        assert len(report.components) > 0
    finally:
        db.close()


def test_11_audit_event_creation_and_query():
    """Test 11: Validates additive audit event creation and lookup."""
    audit = get_decision_audit()
    audit.clear_records()

    entry = audit.record_workflow_event(
        workflow_id="wf_test_123",
        transaction_id=412,
        vendor_id=88,
        status="REQUIRES_VERIFICATION",
        model2_assessment_id=1,
        risk_score=63.0,
        risk_level="HIGH",
        policy_gate="G1: HOLD",
        manager_action=None,
    )

    assert entry["workflow_id"] == "wf_test_123"
    assert entry["risk_score"] == 63.0

    history = audit.get_workflow_audit_history(workflow_id="wf_test_123")
    assert len(history) == 1
    assert history[0]["policy_gate"] == "G1: HOLD"

