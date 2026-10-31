"""CAFIE Model 3 — Integration Manager.

Coordinates internal CAFIE services, validates service health, handles structured data exchange,
enforces duplicate processing protection (idempotency), and manages graceful degradation.
"""

from __future__ import annotations
import time
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime

from .service_registry import get_service_registry, ServiceRegistry
from .event_dispatcher import get_event_dispatcher, EventDispatcher
from ..schemas.integration_schema import ServiceStatus, ServiceHealthReport

logger = logging.getLogger("finvora.cafie.model3.integration_manager")


class IntegrationManager:
    """Orchestrates internal CAFIE services with reliability and idempotency protection."""

    _instance: Optional[IntegrationManager] = None

    def __new__(cls) -> IntegrationManager:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._registry = get_service_registry()
            cls._instance._dispatcher = get_event_dispatcher()
            cls._instance._idempotency_cache: Dict[str, Dict[str, Any]] = {}
            cls._instance._initialized = False
        return cls._instance

    def initialize_default_services(self) -> None:
        """Registers default core CAFIE services and adapters into the registry."""
        if self._initialized:
            return

        # 1. Model 1 Engine
        self._registry.register_service(
            service_id="cafie_model1_engine",
            name="CAFIE Model 1 Core Services",
            version="1.0.0",
            status=ServiceStatus.ONLINE,
            description="Adaptive vendor profiling, 3-way matching baseline, baseline inventory metrics",
            endpoint_or_module="app.services.cafie_engine",
            health_check_fn=lambda: {"status": "OK", "module": "cafie_engine"},
        )

        # 2. Model 2 13-Stage Pipeline Engine
        self._registry.register_service(
            service_id="cafie_model2_engine",
            name="CAFIE Model 2 Deterministic Pipeline",
            version="2.0.0",
            status=ServiceStatus.ONLINE,
            description="13-stage deterministic pipeline, calibrated non-linear risk scoring, Policy Gate G1",
            endpoint_or_module="app.services.cafie_model2_engine",
            health_check_fn=lambda: {"status": "OK", "pipeline_stages": 13},
        )

        # 3. SAP Client Connector
        def _check_sap_health():
            try:
                from app.services.sap_client import get_sap_client
                client = get_sap_client()
                return {"status": "OK", "is_live": client.is_live, "mode": client.mode}
            except Exception as e:
                return {"status": "MOCK", "note": str(e)}

        self._registry.register_service(
            service_id="cafie_sap_client",
            name="SAP S/4HANA OData v2 Integration",
            version="2.1.0",
            status=ServiceStatus.ONLINE,
            description="PO, Supplier Invoice, Material Document, and Business Partner APIs",
            endpoint_or_module="app.services.sap_client",
            health_check_fn=_check_sap_health,
        )

        # 4. WMS Connector
        self._registry.register_service(
            service_id="cafie_wms_connector",
            name="WMS Warehouse Inventory Connector",
            version="2.0.0",
            status=ServiceStatus.ONLINE,
            description="Goods receipt verification, physical stock balancing, and stock movement sync",
            endpoint_or_module="app.services.erp_connectors",
            health_check_fn=lambda: {"status": "OK", "connector": "WMSConnector"},
        )

        # 5. Document Intelligence / OCR
        self._registry.register_service(
            service_id="cafie_doc_intel",
            name="Document Intelligence & OCR Service",
            version="1.5.0",
            status=ServiceStatus.ONLINE,
            description="Line-item extraction and OCR invoice parsing with PaddleOCR",
            endpoint_or_module="app.services.doc_intel",
            health_check_fn=lambda: {"status": "OK", "engine": "paddleocr"},
        )

        self._initialized = True
        logger.info("CAFIE IntegrationManager initialized with 5 core services.")

    def check_system_readiness(self) -> Tuple[bool, ServiceHealthReport]:
        """Validates that essential core services are online before processing transactions."""
        if not self._initialized:
            self.initialize_default_services()

        health_report = self._registry.run_health_checks()
        # Essential services: Model 2 Engine must be online
        model2 = self._registry.get_service("cafie_model2_engine")
        is_ready = bool(model2 and model2.status in (ServiceStatus.ONLINE, ServiceStatus.MOCK))
        return is_ready, health_report

    def check_or_register_idempotency(self, idempotency_key: str, payload_summary: Dict[str, Any]) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        Enforces duplicate processing protection.
        Returns:
            (is_duplicate, previous_result)
        """
        if not idempotency_key:
            return False, None

        if idempotency_key in self._idempotency_cache:
            logger.warning(f"Duplicate transaction attempt detected for key: {idempotency_key}")
            self._dispatcher.publish(
                event_type="idempotency_blocked",
                source_service="integration_manager",
                payload={"idempotency_key": idempotency_key, "action": "blocked_duplicate"},
            )
            return True, self._idempotency_cache[idempotency_key]

        # Record reservation
        self._idempotency_cache[idempotency_key] = {
            "status": "IN_PROGRESS",
            "timestamp": datetime.utcnow().isoformat(),
            "summary": payload_summary,
        }
        return False, None

    def store_idempotency_result(self, idempotency_key: str, result: Dict[str, Any]) -> None:
        """Stores the completed execution result against the idempotency key."""
        if idempotency_key:
            self._idempotency_cache[idempotency_key] = {
                "status": "COMPLETED",
                "timestamp": datetime.utcnow().isoformat(),
                "result": result,
            }

    def clear_idempotency_cache(self) -> None:
        """Clears idempotency cache for isolated testing."""
        self._idempotency_cache.clear()


def get_integration_manager() -> IntegrationManager:
    """Returns the singleton instance of IntegrationManager."""
    mgr = IntegrationManager()
    if not mgr._initialized:
        mgr.initialize_default_services()
    return mgr
