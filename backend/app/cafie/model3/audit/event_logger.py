"""CAFIE Model 3 — Event Logger.

Provides structured JSON audit logging for SIEM ingestion and operational monitoring.
"""

from __future__ import annotations
import json
import logging
from typing import Dict, Any
from datetime import datetime

logger = logging.getLogger("finvora.cafie.model3.audit_log")


class EventLogger:
    """Outputs structured diagnostic and compliance log lines."""

    @staticmethod
    def log_event(event_name: str, payload: Dict[str, Any], level: str = "INFO") -> None:
        """Formats and outputs a JSON log message."""
        log_payload = {
            "timestamp": datetime.utcnow().isoformat(),
            "event": event_name,
            "version": "3.0.0",
            "data": payload,
        }
        msg = json.dumps(log_payload, default=str)
        if level == "ERROR":
            logger.error(msg)
        elif level == "WARNING":
            logger.warning(msg)
        else:
            logger.info(msg)

