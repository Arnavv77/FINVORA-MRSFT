"""CAFIE Model 3 — Context Aggregator.

Aggregates financial context across existing tables (Vendor, PO, GRN, Invoices,
Inventory, Stock Movements, Memory Events, and Approvals) without fabricating data.
"""

from __future__ import annotations
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models import (
    Vendor,
    VendorProfile,
    PurchaseOrder,
    GoodsReceiptNote,
    VendorInvoiceRecord,
    InventoryRecord,
    StockMovement,
    FinancialMemoryEvent,
    FinancialMemoryLink,
    CrossSystemRiskAssessment,
    CAFIEApprovalRecord,
)

logger = logging.getLogger("finvora.cafie.model3.context_aggregator")


class ContextAggregator:
    """Collects multi-system contextual snapshot for a given invoice."""

    def __init__(self, db: Session):
        self.db = db

    def aggregate_full_context(self, invoice_id: int, company_id: int = 1) -> Dict[str, Any]:
        """
        Gathers complete context across all 7 financial domains.
        Returns empty/None structures where data is absent without inventing records.
        """
        # 1. Invoice Context
        invoice = (
            self.db.query(VendorInvoiceRecord)
            .filter(
                VendorInvoiceRecord.id == invoice_id,
                VendorInvoiceRecord.company_id == company_id,
            )
            .first()
        )
        if not invoice:
            return {"error": f"Invoice ID {invoice_id} not found", "found": False}

        inv_items = [
            {
                "line_number": item.line_number,
                "sku": item.sku,
                "description": item.description,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "tax_amount": item.tax_amount,
                "total_price": item.total_price,
            }
            for item in (invoice.items or [])
        ]

        # 2. Vendor Context
        vendor = self.db.query(Vendor).filter(Vendor.id == invoice.vendor_id).first()
        profile = (
            self.db.query(VendorProfile)
            .filter(VendorProfile.vendor_id == invoice.vendor_id, VendorProfile.company_id == company_id)
            .first()
        )

        vendor_ctx = {
            "vendor_id": invoice.vendor_id,
            "vendor_name": vendor.name if vendor else "Unknown Vendor",
            "vendor_code": profile.vendor_code if profile else None,
            "bank_name": profile.bank_name if profile else None,
            "bank_account_number": profile.bank_account_number if profile else None,
            "bank_account_hash": profile.bank_account_hash if profile else None,
            "verification_status": profile.verification_status if profile else "unverified",
            "delivery_fill_rate": profile.delivery_fill_rate if profile else None,
            "avg_lead_time_days": profile.avg_lead_time_days if profile else None,
            "discrepancy_count": profile.discrepancy_count if profile else 0,
            "risk_score": profile.risk_score if profile else 15.0,
        }

        # 3. Purchase Order Context
        po = None
        po_items = []
        if invoice.po_id:
            po = (
                self.db.query(PurchaseOrder)
                .filter(PurchaseOrder.id == invoice.po_id, PurchaseOrder.company_id == company_id)
                .first()
            )
            if po:
                po_items = [
                    {
                        "line_number": item.line_number,
                        "sku": item.sku,
                        "quantity": item.quantity,
                        "unit_price": item.unit_price,
                        "tax_rate": item.tax_rate,
                        "total_price": item.total_price,
                    }
                    for item in (po.items or [])
                ]

        po_ctx = {
            "found": po is not None,
            "po_id": po.id if po else None,
            "po_number": po.po_number if po else None,
            "total_amount": po.total_amount if po else 0.0,
            "tax_amount": po.tax_amount if po else 0.0,
            "status": po.status if po else "NOT_FOUND",
            "items": po_items,
        }

        # 4. Goods Receipt Note Context
        grn = None
        grn_items = []
        if po:
            grn = (
                self.db.query(GoodsReceiptNote)
                .filter(GoodsReceiptNote.po_id == po.id, GoodsReceiptNote.company_id == company_id)
                .first()
            )
            if grn:
                grn_items = [
                    {
                        "sku": item.sku,
                        "ordered_quantity": item.ordered_quantity,
                        "received_quantity": item.received_quantity,
                        "accepted_quantity": item.accepted_quantity,
                        "rejected_quantity": item.rejected_quantity,
                    }
                    for item in (grn.items or [])
                ]

        grn_ctx = {
            "found": grn is not None,
            "grn_id": grn.id if grn else None,
            "grn_number": grn.grn_number if grn else None,
            "quality_status": grn.quality_inspection_status if grn else "NOT_FOUND",
            "items": grn_items,
        }

        # 5. Inventory Context for Invoice SKUs
        inventory_ctx = []
        for itm in inv_items:
            inv_rec = (
                self.db.query(InventoryRecord)
                .filter(InventoryRecord.sku == itm["sku"], InventoryRecord.company_id == company_id)
                .first()
            )
            if inv_rec:
                inventory_ctx.append({
                    "sku": inv_rec.sku,
                    "item_name": inv_rec.item_name,
                    "quantity_on_hand": inv_rec.quantity_on_hand,
                    "unit_cost": inv_rec.unit_cost,
                    "safety_stock": inv_rec.safety_stock,
                    "consumption_velocity_daily": inv_rec.consumption_velocity_daily,
                    "ageing_days": inv_rec.ageing_days,
                })

        # 6. Historical Risk Memory Events
        memory_events = (
            self.db.query(FinancialMemoryEvent)
            .filter(
                FinancialMemoryEvent.vendor_id == invoice.vendor_id,
                FinancialMemoryEvent.company_id == company_id,
            )
            .order_by(desc(FinancialMemoryEvent.event_date))
            .limit(20)
            .all()
        )

        unresolved_exposure = sum(
            e.financial_impact
            for e in memory_events
            if e.resolution_status == "unresolved" and e.financial_impact > 0
        )

        mem_ctx = {
            "total_events_count": len(memory_events),
            "unresolved_events_count": sum(1 for e in memory_events if e.resolution_status == "unresolved"),
            "unresolved_exposure": unresolved_exposure,
            "recent_events": [
                {
                    "event_id": e.id,
                    "event_category": e.event_category,
                    "severity": e.severity,
                    "event_date": e.event_date.isoformat() if e.event_date else None,
                    "financial_impact": e.financial_impact,
                    "resolution_status": e.resolution_status,
                }
                for e in memory_events[:5]
            ],
        }

        # 7. Previous Approvals / Governance Audit
        previous_assessments = (
            self.db.query(CrossSystemRiskAssessment)
            .filter(
                CrossSystemRiskAssessment.vendor_id == invoice.vendor_id,
                CrossSystemRiskAssessment.company_id == company_id,
            )
            .order_by(desc(CrossSystemRiskAssessment.created_at))
            .limit(5)
            .all()
        )

        return {
            "found": True,
            "invoice": {
                "id": invoice.id,
                "invoice_number": invoice.invoice_number,
                "invoice_date": invoice.invoice_date.isoformat() if invoice.invoice_date else None,
                "total_amount": invoice.total_amount,
                "subtotal_amount": invoice.subtotal_amount,
                "tax_amount": invoice.tax_amount,
                "currency": invoice.currency,
                "bank_name": invoice.bank_name,
                "bank_account_number": invoice.bank_account_number,
                "bank_account_hash": invoice.bank_account_hash,
                "status": invoice.status,
                "items": inv_items,
            },
            "vendor": vendor_ctx,
            "purchase_order": po_ctx,
            "goods_receipt": grn_ctx,
            "inventory": inventory_ctx,
            "memory": mem_ctx,
            "previous_assessments_count": len(previous_assessments),
        }
