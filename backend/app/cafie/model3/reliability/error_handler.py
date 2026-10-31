"""CAFIE Model 3 — Error Handler.

Normalizes exceptions into structured error responses without raw stack traces.
Enforces the core rule: NEVER automatically approve a transaction because a service fails.
"""

from __future__ import annotations
import logging
import traceback
from typing import Dict, Any, Optional

logger = logging.getLogger("finvora.cafie.model3.error_handler")


class ErrorHandler:
    """Centralized error handling and normalization for Model 3."""

    @staticmethod
    def handle_error(
        error: Exception,
        context: Optional[Dict[str, Any]] = None,
        source: str = "orchestrator",
    ) -> Dict[str, Any]:
        """Formats and logs errors into a safe structured JSON payload."""
        error_type = type(error).__name__
        error_msg = str(error)

        logger.error(
            f"CAFIE Model 3 Error in '{source}': [{error_type}] {error_msg} | Context: {context}"
        )

        return {
            "success": False,
            "source": source,
            "error_type": error_type,
            "error_message": error_msg,
            "context": context or {},
            "fallback_status": "REQUIRES_MANUAL_REVIEW",  # NEVER automatically approve!
        }

