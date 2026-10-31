"""CAFIE Memory Bridge for IDP Payment Intelligence.

Strict Preservation:
- Reuses existing CAFIE FinancialMemoryEvent and FinancialMemoryLink from app.cafie_models.
- Never replaces or alters existing CAFIE memory schemas or logic.
- Adds learning loop: when an accountant corrects a debtor, invoice, or ledger,
  the authorized pattern is stored and used to boost future recommendation confidence.
"""

from __future__ import annotations
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models import Vendor
from app.cafie_models import FinancialMemoryEvent
from .models import IDPMemoryFeedback, IDPDebtorLedger

logger = logging.getLogger("finvora.idp.memory_bridge")


class IDPCafieMemoryBridge:
    """Bridges IDP Payment Intelligence with persistent CAFIE financial memory."""

    def __init__(self, db: Session):
        self.db = db

    def record_accountant_feedback(
        self,
        company_id: int,
        payment_id: int,
        pattern_type: str,
        pattern_key: str,
        debtor_id: int,
        ledger_name: str,
        accountant_name: str = "Senior Accountant (CFO Auth)",
        remarks: Optional[str] = None,
    ) -> IDPMemoryFeedback:
        """Stores authorized correction pattern in CAFIE memory and local feedback registry."""
        normalized_key = pattern_key.strip().lower()

        # 1. Update or create in IDPMemoryFeedback
        existing = (
            self.db.query(IDPMemoryFeedback)
            .filter(
                IDPMemoryFeedback.company_id == company_id,
                IDPMemoryFeedback.pattern_key == normalized_key,
            )
            .first()
        )

        if existing:
            existing.debtor_id = debtor_id
            existing.ledger_name = ledger_name
            existing.times_applied += 1
            existing.confidence_boost = min(45.0, existing.confidence_boost + 5.0)
            existing.updated_at = datetime.utcnow()
            record = existing
        else:
            record = IDPMemoryFeedback(
                company_id=company_id,
                pattern_type=pattern_type,
                pattern_key=normalized_key,
                debtor_id=debtor_id,
                ledger_name=ledger_name,
                confidence_boost=35.0,
                times_applied=1,
            )
            self.db.add(record)

        # 2. Also log an immutable FinancialMemoryEvent in existing CAFIE memory
        try:
            with self.db.begin_nested():
                valid_vendor = self.db.query(Vendor).filter(Vendor.id == debtor_id).first()
                if not valid_vendor:
                    valid_vendor = self.db.query(Vendor).first()
                valid_vendor_id = valid_vendor.id if valid_vendor else 1

                cafie_event = FinancialMemoryEvent(
                    vendor_id=valid_vendor_id,
                    company_id=company_id,
                    transaction_ref=f"IDP-PAY-{payment_id}",
                    event_category="RECONCILIATION_CORRECTION",
                    event_date=datetime.utcnow().date(),
                    severity="LOW",
                    financial_impact=0.0,
                    risk_category="OPERATIONAL",
                    resolution_status="resolved",
                    authorized_manager_remarks=(
                        f"Accountant {accountant_name} authorized pattern '{normalized_key}' "
                        f"to Debtor ID {debtor_id} (Ledger: {ledger_name}). {remarks or ''}"
                    ),
                )
                self.db.add(cafie_event)
        except Exception as e:
            logger.warning("Could not persist to CAFIE FinancialMemoryEvent: %s", e)

        self.db.commit()
        self.db.refresh(record)
        return record

    def lookup_memory_pattern(
        self,
        company_id: int,
        search_keys: List[str],
    ) -> Optional[Dict[str, Any]]:
        """
        Looks up whether any search key (e.g. narration token, VPA, alias)
        has been previously corrected and verified by an accountant.
        """
        patterns = (
            self.db.query(IDPMemoryFeedback)
            .filter(IDPMemoryFeedback.company_id == company_id)
            .all()
        )
        if not patterns:
            return None

        clean_keys = [k.strip().lower() for k in search_keys if k and len(k.strip()) >= 3]

        for p in patterns:
            pattern_norm = p.pattern_key.strip().lower()
            pattern_tokens = [t for t in pattern_norm.replace("-", " ").split() if len(t) >= 3]

            for key_norm in clean_keys:
                key_tokens = [t for t in key_norm.replace("-", " ").split() if len(t) >= 3]

                # Match criteria:
                # 1. Exact string match
                # 2. Pattern substring in search key
                # 3. Search key substring in pattern
                # 4. Token intersection
                token_overlap = any(pt in key_tokens or any(pt in kt for kt in key_tokens) for pt in pattern_tokens)

                if (
                    pattern_norm == key_norm
                    or pattern_norm in key_norm
                    or key_norm in pattern_norm
                    or token_overlap
                ):
                    debtor = self.db.query(IDPDebtorLedger).filter(IDPDebtorLedger.id == p.debtor_id).first()
                    return {
                        "pattern_type": p.pattern_type,
                        "pattern_key": p.pattern_key,
                        "matched_key": key_norm,
                        "debtor_id": p.debtor_id,
                        "debtor_name": debtor.name if debtor else f"Debtor #{p.debtor_id}",
                        "debtor_code": debtor.debtor_code if debtor else "UNKNOWN",
                        "suggested_ledger": p.ledger_name,
                        "confidence_boost": p.confidence_boost,
                        "times_applied": p.times_applied,
                        "source": "CAFIE_FINANCIAL_MEMORY",
                    }

        return None
