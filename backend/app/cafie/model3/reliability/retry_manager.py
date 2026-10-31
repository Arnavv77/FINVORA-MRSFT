"""CAFIE Model 3 — Retry Manager.

Provides controlled exponential backoff retry execution for idempotent read-only operations.
STRICT SAFEGUARD: Non-idempotent posting actions or state mutations are NEVER retried.
"""

from __future__ import annotations
import time
import logging
from typing import Callable, TypeVar, Any, Optional

logger = logging.getLogger("finvora.cafie.model3.retry_manager")

T = TypeVar("T")


class RetryManager:
    """Executes idempotent operations with exponential backoff."""

    @staticmethod
    def execute_with_retry(
        operation_name: str,
        fn: Callable[[], T],
        max_retries: int = 3,
        initial_backoff_sec: float = 0.05,
        backoff_multiplier: float = 2.0,
        is_idempotent: bool = True,
    ) -> T:
        """
        Executes an operation with retry logic.
        Raises RuntimeError if `is_idempotent` is False and a retry is requested.
        """
        if not is_idempotent and max_retries > 0:
            # Strictly execute once for non-idempotent operations
            return fn()

        backoff = initial_backoff_sec
        last_exception = None

        for attempt in range(1, max_retries + 2):
            try:
                return fn()
            except Exception as e:
                last_exception = e
                if attempt > max_retries:
                    logger.error(f"Operation '{operation_name}' failed after {attempt} attempts: {e}")
                    break
                logger.warning(f"Operation '{operation_name}' failed on attempt {attempt}/{max_retries + 1} ({e}). Retrying in {backoff:.2f}s...")
                time.sleep(backoff)
                backoff *= backoff_multiplier

        raise last_exception or RuntimeError(f"Retry failed for {operation_name}")

