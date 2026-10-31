"""CAFIE Model 3 — Service Registry.

Maintains an in-memory catalog of all internal and external CAFIE services,
their operational state, latency, and capability metadata.
"""

from __future__ import annotations
import time
import logging
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime

from ..schemas.integration_schema import (
    ServiceRegistration,
    ServiceStatus,
    ServiceHealthReport,
)

logger = logging.getLogger("finvora.cafie.model3.service_registry")


class ServiceRegistry:
    """Thread-safe registry of CAFIE internal & adapter services."""

    _instance: Optional[ServiceRegistry] = None

    def __new__(cls) -> ServiceRegistry:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._services: Dict[str, ServiceRegistration] = {}
            cls._instance._health_checks: Dict[str, Callable[[], Dict[str, Any]]] = {}
        return cls._instance

    def register_service(
        self,
        service_id: str,
        name: str,
        version: str = "3.0.0",
        status: ServiceStatus = ServiceStatus.ONLINE,
        description: str = "",
        is_mock: bool = False,
        endpoint_or_module: str = "",
        health_check_fn: Optional[Callable[[], Dict[str, Any]]] = None,
    ) -> ServiceRegistration:
        """Registers a service into the catalog."""
        reg = ServiceRegistration(
            service_id=service_id,
            name=name,
            version=version,
            status=status,
            description=description,
            is_mock=is_mock,
            endpoint_or_module=endpoint_or_module,
            last_health_check=datetime.utcnow(),
        )
        self._services[service_id] = reg
        if health_check_fn:
            self._health_checks[service_id] = health_check_fn
        logger.info(f"Registered CAFIE service: {service_id} [{status.value}] is_mock={is_mock}")
        return reg

    def get_service(self, service_id: str) -> Optional[ServiceRegistration]:
        """Retrieves a service registration by ID."""
        return self._services.get(service_id)

    def list_services(self) -> List[ServiceRegistration]:
        """Lists all registered services."""
        return list(self._services.values())

    def update_service_status(
        self,
        service_id: str,
        status: ServiceStatus,
        latency_ms: float = 0.0,
        error_message: Optional[str] = None,
    ) -> Optional[ServiceRegistration]:
        """Updates the operational status and latency for a service."""
        reg = self._services.get(service_id)
        if not reg:
            return None
        reg.status = status
        reg.latency_ms = latency_ms
        reg.error_message = error_message
        reg.last_health_check = datetime.utcnow()
        return reg

    def run_health_checks(self) -> ServiceHealthReport:
        """Executes registered health check functions and returns a unified report."""
        active_count = 0
        overall_status = "HEALTHY"

        for s_id, check_fn in self._health_checks.items():
            reg = self._services.get(s_id)
            if not reg:
                continue
            start_t = time.perf_counter()
            try:
                res = check_fn()
                dur_ms = (time.perf_counter() - start_t) * 1000.0
                reg.latency_ms = round(dur_ms, 2)
                reg.last_health_check = datetime.utcnow()
                if res.get("status") in ("OK", "HEALTHY", "CONNECTED", "ONLINE", "MOCK"):
                    if reg.is_mock:
                        reg.status = ServiceStatus.MOCK
                    else:
                        reg.status = ServiceStatus.ONLINE
                    reg.error_message = None
                    active_count += 1
                else:
                    reg.status = ServiceStatus.DEGRADED
                    reg.error_message = res.get("error") or "Health check returned non-healthy status"
                    overall_status = "DEGRADED"
            except Exception as e:
                dur_ms = (time.perf_counter() - start_t) * 1000.0
                reg.latency_ms = round(dur_ms, 2)
                reg.status = ServiceStatus.OFFLINE
                reg.error_message = str(e)
                overall_status = "DEGRADED"

        # Count any services without custom health check functions
        for s_id, reg in self._services.items():
            if s_id not in self._health_checks:
                if reg.status in (ServiceStatus.ONLINE, ServiceStatus.MOCK):
                    active_count += 1

        return ServiceHealthReport(
            overall_status=overall_status,
            timestamp=datetime.utcnow(),
            active_services_count=active_count,
            total_services_count=len(self._services),
            services=dict(self._services),
        )


def get_service_registry() -> ServiceRegistry:
    """Returns the singleton instance of ServiceRegistry."""
    return ServiceRegistry()

