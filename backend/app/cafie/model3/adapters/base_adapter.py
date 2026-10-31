"""CAFIE Model 3 — Base Adapter Interface.

Defines the standard contract for ERP, WMS, and Accounting adapters.
Includes health check, fetch, and disbursement interfaces.
"""

from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from datetime import datetime


class BaseERPAdapter(ABC):
    """Abstract contract for future and mock ERP integrations."""

    def __init__(self, adapter_name: str):
        self.adapter_name = adapter_name
        self.is_mock = True

    @abstractmethod
    def check_health(self) -> Dict[str, Any]:
        """Returns adapter operational and latency status."""
        pass

    @abstractmethod
    def fetch_purchase_order(self, po_number: str) -> Dict[str, Any]:
        """Fetches normalized Purchase Order record."""
        pass

    @abstractmethod
    def fetch_supplier_invoice(self, invoice_number: str) -> Dict[str, Any]:
        """Fetches normalized Supplier Invoice record."""
        pass

    @abstractmethod
    def fetch_goods_receipt(self, grn_number: str) -> Dict[str, Any]:
        """Fetches normalized Goods Receipt Note record."""
        pass

    @abstractmethod
    def post_disbursement(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Simulates or posts approved payment disbursement."""
        pass

