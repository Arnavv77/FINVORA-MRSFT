"""CAFIE Model 3 — Mock SAP S/4HANA Adapter.

Provides deterministic synthetic SAP OData responses with health checks and error handling.
Does NOT require API keys, credentials, or external network calls.
"""

from __future__ import annotations
import time
from typing import Dict, Any, Optional
from datetime import date, datetime

from .base_adapter import BaseERPAdapter


class MockSapAdapter(BaseERPAdapter):
    """Mock SAP S/4HANA OData v2 Adapter returning clearly labelled synthetic data."""

    def __init__(self):
        super().__init__(adapter_name="Mock SAP S/4HANA Adapter")
        self.system_id = "SAP_MOCK_S4HANA_DEV"

    def check_health(self) -> Dict[str, Any]:
        """Health check for mock SAP adapter."""
        return {
            "adapter": self.adapter_name,
            "status": "MOCK",
            "integration_mode": "MOCK_SYNTHETIC",
            "is_live": False,
            "latency_ms": 2.5,
            "services_available": [
                "API_PURCHASEORDER_2",
                "API_SUPPLIERINVOICE_PROCESS_SRV_0001",
                "API_MATERIAL_DOCUMENT",
                "API_BUSINESS_PARTNER",
            ],
            "timestamp": datetime.utcnow().isoformat(),
        }

    def fetch_purchase_order(self, po_number: str) -> Dict[str, Any]:
        """Returns synthetic Purchase Order data."""
        return {
            "adapter": self.adapter_name,
            "integration_mode": "MOCK_SYNTHETIC",
            "po_number": po_number,
            "sap_document_id": f"45000{abs(hash(po_number)) % 90000 + 10000}",
            "company_code": "1000",
            "vendor_code": "VEND-ORION-01",
            "total_amount": 4720000.0,
            "net_amount": 4000000.0,
            "tax_amount": 720000.0,
            "currency": "INR",
            "status": "RELEASED",
            "items": [
                {
                    "item_number": 10,
                    "sku": "LAPTOP-ENT-01",
                    "description": "Enterprise Core Ultra 7 Laptops (16GB/512GB)",
                    "ordered_quantity": 100.0,
                    "unit_price": 40000.0,
                    "net_amount": 4000000.0,
                }
            ],
        }

    def fetch_supplier_invoice(self, invoice_number: str) -> Dict[str, Any]:
        """Returns synthetic Supplier Invoice data."""
        return {
            "adapter": self.adapter_name,
            "integration_mode": "MOCK_SYNTHETIC",
            "invoice_number": invoice_number,
            "sap_document_number": f"51000{abs(hash(invoice_number)) % 90000 + 10000}",
            "vendor_code": "VEND-ORION-01",
            "gross_amount": 4720000.0,
            "currency": "INR",
            "remittance_bank": "Yes Bank",
            "remittance_account": "98765432107731",
            "status": "PARKED_FOR_APPROVAL",
        }

    def fetch_goods_receipt(self, grn_number: str) -> Dict[str, Any]:
        """Returns synthetic Material Document goods receipt data."""
        return {
            "adapter": self.adapter_name,
            "integration_mode": "MOCK_SYNTHETIC",
            "grn_number": grn_number,
            "material_document_id": f"50000{abs(hash(grn_number)) % 90000 + 10000}",
            "posting_date": date.today().isoformat(),
            "quality_status": "PASSED",
            "accepted_quantity": 100.0,
            "unit": "PC",
        }

    def post_disbursement(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Simulates disbursement posting to SAP S/4HANA."""
        inv_no = payload.get("invoice_number", "INV-UNKNOWN")
        amt = payload.get("amount", 0.0)
        return {
            "adapter": self.adapter_name,
            "integration_mode": "MOCK_SYNTHETIC",
            "status": "SIMULATED_POSTED",
            "sap_document_number": f"51000{abs(hash(inv_no)) % 90000 + 10000}",
            "invoice_number": inv_no,
            "amount": amt,
            "currency": "INR",
            "posting_timestamp": datetime.utcnow().isoformat(),
            "message": "Mock SAP disbursement posted successfully (Synthetic Demonstration).",
        }

