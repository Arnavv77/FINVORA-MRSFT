"""CAFIE Model 3 — Validation Service.

Validates action payloads, role permissions, and financial constraints.
"""

from __future__ import annotations
from typing import Optional, Dict, Any


class ReliabilityValidationError(ValueError):
    """Raised when request payload or parameters fail validation."""
    pass


class ValidationService:
    """Enforces business constraints and role authorization rules."""

    ALLOWED_ACTIONS = {"approve", "reject", "hold_for_verification", "verify_bank"}
    ALLOWED_ROLES = {"manager", "admin", "treasury_head", "finance_controller", "analyst"}

    @classmethod
    def validate_action_request(
        cls,
        action: str,
        user_role: str,
        user_id: str,
        verification_method: Optional[str] = None,
    ) -> None:
        """Validates that a human decision action is permitted for the given role."""
        if action not in cls.ALLOWED_ACTIONS:
            raise ReliabilityValidationError(f"Invalid action: '{action}'. Allowed actions: {cls.ALLOWED_ACTIONS}")

        if user_role not in cls.ALLOWED_ROLES:
            raise ReliabilityValidationError(f"Unauthorized role: '{user_role}'. Allowed roles: {cls.ALLOWED_ROLES}")

        if not user_id or not user_id.strip():
            raise ReliabilityValidationError("user_id cannot be empty.")

        if action == "verify_bank" and not verification_method:
            raise ReliabilityValidationError("verification_method is required when performing 'verify_bank'.")

