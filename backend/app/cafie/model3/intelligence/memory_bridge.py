"""CAFIE Model 3 — Memory Bridge.

Provides clean read and write abstractions over the existing Model 2 financial memory
without duplicating, resetting, or altering the underlying database schema.
"""

from __future__ import annotations
import logging
from typing import Dict, Any, List, Optional
from datetime import date, datetime
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models import (
    Vendor,
    VendorProfile,
    FinancialMemoryEvent,
    FinancialMemoryLink,
    CAFIEApprovalRecord,
    CrossSystemRiskAssessment,
)

logger = logging.getLogger("finvora.cafie.model3.memory_bridge")


class MemoryBridge:
    """Interacts with persistent Financial Risk Memory (Layer D) and Manager Feedback."""

    def __init__(self, db: Session):
        self.db = db

    def get_vendor_memory_history(
        self,
        vendor_id: int,
        company_id: int = 1,
        unresolved_only: bool = False,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Retrieves persistent historical risk events for a vendor."""
        query = (
            self.db.query(FinancialMemoryEvent)
            .filter(
                FinancialMemoryEvent.vendor_id == vendor_id,
                FinancialMemoryEvent.company_id == company_id,
            )
        )
        if unresolved_only:
            query = query.filter(FinancialMemoryEvent.resolution_status == "unresolved")

        events = query.order_by(desc(FinancialMemoryEvent.event_date)).limit(limit).all()

        return [
            {
                "event_id": e.id,
                "transaction_ref": e.transaction_ref,
                "event_category": e.event_category,
                "event_date": e.event_date.isoformat() if e.event_date else None,
                "severity": e.severity,
                "financial_impact": e.financial_impact,
                "risk_category": e.risk_category,
                "resolution_status": e.resolution_status,
                "authorized_manager_remarks": e.authorized_manager_remarks,
                "supporting_evidence": e.supporting_evidence,
                "source_documents": e.source_documents,
            }
            for e in events
        ]

    def get_manager_decision_history(
        self,
        assessment_id: Optional[int] = None,
        vendor_id: Optional[int] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Retrieves manager approval and verification audit history."""
        query = self.db.query(CAFIEApprovalRecord)
        if assessment_id:
            query = query.filter(CAFIEApprovalRecord.assessment_id == assessment_id)
        elif vendor_id:
            query = (
                query.join(CrossSystemRiskAssessment)
                .filter(CrossSystemRiskAssessment.vendor_id == vendor_id)
            )

        records = query.order_by(desc(CAFIEApprovalRecord.created_at)).limit(limit).all()

        return [
            {
                "record_id": r.id,
                "assessment_id": r.assessment_id,
                "action": r.action,
                "previous_status": r.previous_status,
                "new_status": r.new_status,
                "verification_method": r.verification_method,
                "verification_date": r.verification_date.isoformat() if r.verification_date else None,
                "manager_remarks": r.manager_remarks,
                "user_id": r.user_id,
                "user_role": r.user_role,
                "timestamp": r.created_at.isoformat() if r.created_at else None,
            }
            for r in records
        ]

    def record_manager_memory_feedback(
        self,
        assessment_id: int,
        vendor_id: int,
        feedback_category: str,
        remarks: str,
        user_id: str = "manager_1",
        financial_impact_averted: float = 0.0,
        company_id: int = 1,
    ) -> Dict[str, Any]:
        """
        Records an authorized manager feedback event into persistent memory.
        Enables human-in-the-loop continuous learning without model retraining.
        """
        event = FinancialMemoryEvent(
            company_id=company_id,
            vendor_id=vendor_id,
            transaction_ref=f"ASSESSMENT-{assessment_id}",
            event_category="manager_override" if "override" in feedback_category else "manager_verification",
            event_date=date.today(),
            severity="info",
            financial_impact=financial_impact_averted,
            risk_category="LOW",
            resolution_status="resolved",
            authorized_manager_remarks=remarks,
            supporting_evidence=[
                {
                    "metric": "manager_action",
                    "feedback_category": feedback_category,
                    "user_id": user_id,
                    "assessment_id": assessment_id,
                }
            ],
            source_documents={"assessment_id": assessment_id},
        )
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)

        logger.info(f"Recorded manager feedback in financial memory: Event ID {event.id}")
        return {
            "success": True,
            "event_id": event.id,
            "resolution_status": event.resolution_status,
            "recorded_at": event.created_at.isoformat() if event.created_at else None,
        }

    def verify_memory_updated(self, vendor_id: int, event_id: int, company_id: int = 1) -> bool:
        """Confirms that a feedback memory event is persisted and retrievable for subsequent evaluations."""
        found = (
            self.db.query(FinancialMemoryEvent)
            .filter(
                FinancialMemoryEvent.id == event_id,
                FinancialMemoryEvent.vendor_id == vendor_id,
                FinancialMemoryEvent.company_id == company_id,
            )
            .first()
        )
        return found is not None
