"""CAFIE Model 3 — Health Monitor.

Continuously monitors health and latency across internal engines, database sessions,
and external ERP/WMS mock/live adapters.
"""

from __future__ import annotations
import time
import logging
from typing import Dict, Any, List
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..schemas.health_schema import ComponentHealth, SystemHealthReport
from ..integration.service_registry import get_service_registry

logger = logging.getLogger("finvora.cafie.model3.health_monitor")


class HealthMonitor:
    """Monitors system-wide health and component diagnostics."""

    _start_time = time.time()

    @classmethod
    def check_system_health(cls, db: Optional[Session] = None) -> SystemHealthReport:
        """Runs diagnostics across all core components."""
        components: List[ComponentHealth] = []
        overall_status = "OPERATIONAL"

        # 1. Database Connectivity Check
        if db is not None:
            t0 = time.perf_counter()
            try:
                db.execute(text("SELECT 1")).scalar()
                latency = (time.perf_counter() - t0) * 1000.0
                components.append(
                    ComponentHealth(
                        name="PostgreSQL Database",
                        status="HEALTHY",
                        latency_ms=round(latency, 2),
                        details={"engine": "SQLAlchemy", "pool": "Active"},
                    )
                )
            except Exception as e:
                components.append(
                    ComponentHealth(
                        name="PostgreSQL Database",
                        status="UNHEALTHY",
                        latency_ms=round((time.perf_counter() - t0) * 1000.0, 2),
                        details={"error": str(e)},
                    )
                )
                overall_status = "DEGRADED"

        # 2. Service Registry Checks
        registry = get_service_registry()
        reg_report = registry.run_health_checks()

        for s_id, s_info in reg_report.services.items():
            components.append(
                ComponentHealth(
                    name=s_info.name,
                    status=s_info.status.value,
                    latency_ms=s_info.latency_ms,
                    details={
                        "version": s_info.version,
                        "is_mock": s_info.is_mock,
                        "error": s_info.error_message,
                    },
                )
            )

        uptime = time.time() - cls._start_time

        return SystemHealthReport(
            system_status=overall_status,
            version="3.0.0",
            uptime_seconds=round(uptime, 1),
            timestamp=datetime.utcnow(),
            components=components,
        )

