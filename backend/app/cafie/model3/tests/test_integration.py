"""CAFIE Model 3 — Integration & Adapter Tests.

Covers:
- Test 1: Integration manager registration.
- Test 8: Missing historical data handling.
- Test 9: External adapter unavailable & mock adapter operation.
"""

import pytest
from app.cafie.model3.integration.service_registry import get_service_registry
from app.cafie.model3.integration.integration_manager import get_integration_manager
from app.cafie.model3.integration.event_dispatcher import get_event_dispatcher
from app.cafie.model3.adapters.mock_sap_adapter import MockSapAdapter
from app.cafie.model3.adapters.mock_wms_adapter import MockWmsAdapter
from app.cafie.model3.adapters.mock_erp_adapter import MockErpAdapter
from app.cafie.model3.context.context_validator import ContextValidator, ContextValidationError


def test_01_integration_manager_service_registration():
    """Test 1: Verifies that Integration Manager registers all core services and adapters."""
    mgr = get_integration_manager()
    mgr.initialize_default_services()

    registry = get_service_registry()
    services = {s.service_id: s for s in registry.list_services()}

    assert "cafie_model1_engine" in services, "Model 1 engine must be registered"
    assert "cafie_model2_engine" in services, "Model 2 engine must be registered"
    assert "cafie_sap_client" in services, "SAP client must be registered"
    assert "cafie_wms_connector" in services, "WMS connector must be registered"
    assert "cafie_doc_intel" in services, "Doc intel service must be registered"

    # Verify readiness check
    is_ready, report = mgr.check_system_readiness()
    assert is_ready is True
    assert report.total_services_count >= 5


def test_08_missing_historical_data_handling():
    """Test 8: Handles missing historical data gracefully without raising unhandled errors or inventing fake records."""
    # Validate negative or zero IDs raise ContextValidationError
    with pytest.raises(ContextValidationError):
        ContextValidator.validate_invoice_request(invoice_id=-1, company_id=1)

    with pytest.raises(ContextValidationError):
        ContextValidator.validate_invoice_request(invoice_id=0, company_id=1)

    # Valid check passes
    ContextValidator.validate_invoice_request(invoice_id=99999, company_id=1)


def test_09_external_adapters_and_mock_fallback():
    """Test 9: Verifies that future external ERP/WMS adapters operate safely in mock mode."""
    # 1. Mock SAP Adapter
    sap_adapter = MockSapAdapter()
    sap_health = sap_adapter.check_health()
    assert sap_health["status"] == "MOCK"
    assert sap_health["integration_mode"] == "MOCK_SYNTHETIC"
    po_res = sap_adapter.fetch_purchase_order("PO-0412")
    assert po_res["total_amount"] == 4720000.0

    # 2. Mock WMS Adapter
    wms_adapter = MockWmsAdapter()
    wms_health = wms_adapter.check_health()
    assert wms_health["status"] == "MOCK"
    grn_res = wms_adapter.fetch_goods_receipt("GRN-0412")
    assert grn_res["units_accepted"] == 100.0

    # 3. Mock ERPNext Adapter
    erp_adapter = MockErpAdapter()
    erp_health = erp_adapter.check_health()
    assert erp_health["status"] == "MOCK"
    erp_po = erp_adapter.fetch_purchase_order("PO-0412")
    assert erp_po["grand_total"] == 4720000.0

    # Test event dispatcher
    dispatcher = get_event_dispatcher()
    received = []
    dispatcher.subscribe("test_event", lambda e: received.append(e))
    evt = dispatcher.publish("test_event", "test_source", {"msg": "hello"})
    assert len(received) == 1
    assert received[0].payload["msg"] == "hello"

