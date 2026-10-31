"""CAFIE Model 3 — Mock ERPNext Adapter.

Provides deterministic synthetic ERPNext responses for accounting ledgers and PO verification.
"""

from __future__ import annotations
from typing import Dict, Any, Optional
from datetime import datetime

from .base_adapter import BaseERPAdapter


class MockErpAdapter(BaseERPAdapter):
    """Mock ERPNext Adapter returning synthetic general ledger and PO records."""

    def __init__(self):
        super().__init__(adapter_name="Mock ERPNext Adapter")
        self.company = "Finvora Enterprise Pvt Ltd"

    def check_health(self) -> Dict[str, Any]:
        """Health check for mock ERPNext adapter."""
        return {
            "adapter": self.adapter_name,
            "status": "MOCK",
            "integration_mode": "MOCK_SYNTHETIC",
            "company": self.company,
            "latency_ms": 2.1,
            "timestamp": datetime.utcnow().isoformat(),
        }

    def fetch_purchase_order(self, po_number: str) -> Dict[str, Any]:
        """Returns synthetic ERPNext Purchase Order."""
        return {
            "adapter": self.adapter_name,
            "integration_mode": "MOCK_SYNTHETIC",
            "name": po_number,
            "supplier": "Orion Tech Distributors Pvt Ltd",
            "status": "To Receive and Bill",
            "grand_total": 4720000.0,
            "currency": "INR",
        }

    def fetch_supplier_invoice(self, invoice_number: str) -> Dict[str, Any]:
        """Returns synthetic Purchase Invoice."""
        return {
            "adapter": self.adapter_name,
            "integration_mode": "MOCK_SYNTHETIC",
            "name": invoice_number,
            "bill_no": invoice_number,
            "status": "Unpaid",
            "outstanding_amount": 4720000.0,
        }

    def fetch_goods_receipt(self, grn_number: str) -> Dict[str, Any]:
        """Returns synthetic Purchase Receipt."""
        return {
            "adapter": self.adapter_name,
            "integration_mode": "MOCK_SYNTHETIC",
            "name": grn_number,
            "status": "Completed",
            "per_received": 100.0,
        }

    def post_disbursement(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Simulates Payment Entry creation in ERPNext."""
        return {
            "adapter": self.adapter_name,
            "integration_mode": "MOCK_SYNTHETIC",
            "payment_entry_id": f"PAY-{abs(hash(payload.get('invoice_number', ''))) % 90000 + 10000}",
            "status": "SIMULATED_SUBMITTED",
            "message": "Payment Entry created in ERPNext (Synthetic Demonstration).",
        }

