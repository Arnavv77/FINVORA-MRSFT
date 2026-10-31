"""CAFIE Model 3 — Context Validator.

Provides schema, type, and financial integrity validation on input transactions.
"""

from __future__ import annotations
import re
from typing import Dict, Any, List, Optional
from datetime import date, datetime


class ContextValidationError(ValueError):
    """Raised when incoming transaction context fails schema or financial validation."""
    def __init__(self, message: str, field: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.field = field


class ContextValidator:
    """Validates transaction payloads and relational structures."""

    @staticmethod
    def validate_invoice_request(invoice_id: int, company_id: int = 1) -> None:
        """Validates primary identifier constraints."""
        if not isinstance(invoice_id, int) or invoice_id <= 0:
            raise ContextValidationError(f"Invalid invoice_id: {invoice_id}. Must be a positive integer.", field="invoice_id")
        if not isinstance(company_id, int) or company_id <= 0:
            raise ContextValidationError(f"Invalid company_id: {company_id}. Must be a positive integer.", field="company_id")

    @staticmethod
    def validate_amount(amount: float, field_name: str = "amount") -> None:
        """Validates that monetary amounts are finite, non-negative numbers."""
        if not isinstance(amount, (int, float)) or amount < 0 or amount != amount:  # NaN check
            raise ContextValidationError(f"Invalid amount for {field_name}: {amount}", field=field_name)

    @staticmethod
    def validate_bank_account_number(account_number: Optional[str]) -> bool:
        """Validates account number format (digits, length 8 to 20)."""
        if not account_number:
            return False
        clean = account_number.strip()
        return bool(re.match(r"^\d{8,20}$", clean))

    @staticmethod
    def validate_ifsc_code(ifsc: Optional[str]) -> bool:
        """Validates Indian IFSC format (4 letters, 0, 6 alphanumeric)."""
        if not ifsc:
            return False
        clean = ifsc.strip().upper()
        return bool(re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", clean))

