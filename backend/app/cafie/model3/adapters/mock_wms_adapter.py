"""CAFIE Model 3 — Mock WMS Adapter.

Provides deterministic synthetic WMS warehouse responses for inventory and receipt verification.
"""

from __future__ import annotations
from typing import Dict, Any, Optional
from datetime import datetime

from .base_adapter import BaseERPAdapter


class MockWmsAdapter(BaseERPAdapter):
    """Mock WMS Adapter returning synthetic warehouse inventory and receipt records."""

    def __init__(self):
        super().__init__(adapter_name="Mock WMS Warehouse Adapter")
        self.warehouse_id = "WH-BLR-01"

    def check_health(self) -> Dict[str, Any]:
        """Health check for mock WMS adapter."""
        return {
            "adapter": self.adapter_name,
            "status": "MOCK",
            "integration_mode": "MOCK_SYNTHETIC",
            "warehouse_id": self.warehouse_id,
            "latency_ms": 1.8,
            "timestamp": datetime.utcnow().isoformat(),
        }

    def fetch_purchase_order(self, po_number: str) -> Dict[str, Any]:
        """PO lookups on WMS return warehouse inbound delivery advisory."""
        return {
            "adapter": self.adapter_name,
            "integration_mode": "MOCK_SYNTHETIC",
            "po_number": po_number,
            "inbound_status": "ARRIVED_AT_BAY",
            "dock_number": "DOCK-04",
        }

    def fetch_supplier_invoice(self, invoice_number: str) -> Dict[str, Any]:
        """Invoices on WMS return invoice-to-receipt matching status."""
        return {
            "adapter": self.adapter_name,
            "integration_mode": "MOCK_SYNTHETIC",
            "invoice_number": invoice_number,
            "matching_grn": "GRN-0412",
            "discrepancy_flag": False,
        }

    def fetch_goods_receipt(self, grn_number: str) -> Dict[str, Any]:
        """Returns synthetic goods receipt inspection records."""
        return {
            "adapter": self.adapter_name,
            "integration_mode": "MOCK_SYNTHETIC",
            "grn_number": grn_number,
            "warehouse_id": self.warehouse_id,
            "inspection_status": "PASSED",
            "total_packages": 10,
            "units_received": 100.0,
            "units_accepted": 100.0,
            "units_damaged": 0.0,
        }

    def post_disbursement(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """WMS responds with inventory hold release advisory."""
        return {
            "adapter": self.adapter_name,
            "integration_mode": "MOCK_SYNTHETIC",
            "status": "INVENTORY_HOLD_CLEARED",
            "message": "Warehouse released inventory hold following disbursement authorization.",
        }

