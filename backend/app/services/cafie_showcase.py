"""FINVORA CAFIE Showcase Seed Scenarios.

Populates realistic cross-system multi-anomaly scenarios:
1. Scenario 1: The 100 Laptops Enterprise Demo (ByteCraft Systems) - Perfect 3-way match, unverified bank change, prior risk memory.
2. Scenario 2: HyperScale Systems - Quantity Shortfall (50 ordered, 45 received, 50 billed).
3. Scenario 3: Apex Growth Media - Unauthorized Rate Card Price Hike (120k PO, 165k Billed).
4. Scenario 4: Cognitive Infotech - Clean 100% Match (Automated Low Risk Approval).
"""

from __future__ import annotations
from datetime import date
from sqlalchemy.orm import Session

from ..models import (
    Vendor,
    PurchaseOrder,
    PurchaseOrderItem,
    GoodsReceiptNote,
    GoodsReceiptNoteItem,
    VendorInvoiceRecord,
    VendorInvoiceItem,
    CrossSystemRiskAssessment,
)
from .cafie_engine import (
    evaluate_transaction_context,
    get_or_create_vendor_profile,
    seed_laptop_demonstration_scenario,
)


def seed_comprehensive_cafie_showcase(db: Session) -> None:
    """Seeds the 100-laptops demo plus 3 diverse enterprise cross-system scenarios."""
    # 1. 100 Laptops Demonstration Scenario
    seed_laptop_demonstration_scenario(db)

    # 2. HyperScale Systems - Quantity Shortfall (50 ordered, 45 received, 50 billed)
    v_hyper = db.query(Vendor).filter(Vendor.name.like("%HyperScale%")).first()
    if v_hyper:
        po_num = "PO-2026-HPS-550"
        po = db.query(PurchaseOrder).filter(PurchaseOrder.po_number == po_num).first()
        if not po:
            po = PurchaseOrder(
                po_number=po_num,
                vendor_id=v_hyper.id,
                department="IT and Infrastructure",
                issue_date=date(2026, 4, 2),
                delivery_due_date=date(2026, 4, 16),
                total_amount=8250000.0,
                tax_amount=1485000.0,
                status="received",
            )
            db.add(po)
            db.commit()
            db.refresh(po)

            poi = PurchaseOrderItem(
                po_id=po.id,
                line_number=1,
                sku="SKU-SW-CISCO-C9300",
                description="Cisco Catalyst 9300 48-Port Switch",
                quantity=50.0,
                unit_price=165000.0,
                tax_rate=0.18,
                total_price=8250000.0,
            )
            db.add(poi)
            db.commit()

            grn_num = "GRN-2026-HPS-550"
            grn = GoodsReceiptNote(
                grn_number=grn_num,
                po_id=po.id,
                vendor_id=v_hyper.id,
                received_date=date(2026, 4, 12),
                warehouse_id="WH-BLR-01",
                quality_inspection_status="conditional_pass",
                notes="5 units missing from pallet 3.",
            )
            db.add(grn)
            db.commit()
            db.refresh(grn)

            grni = GoodsReceiptNoteItem(
                grn_id=grn.id,
                po_item_id=poi.id,
                sku="SKU-SW-CISCO-C9300",
                description="Cisco Catalyst 9300 48-Port Switch",
                ordered_quantity=50.0,
                received_quantity=45.0,
                accepted_quantity=45.0,
                rejected_quantity=5.0,
                rejection_reason="Short shipment",
            )
            db.add(grni)
            db.commit()

            prof = get_or_create_vendor_profile(db, v_hyper)
            inv_num = "INV-2026-HPS-8841"
            inv = VendorInvoiceRecord(
                invoice_number=inv_num,
                po_id=po.id,
                vendor_id=v_hyper.id,
                invoice_date=date(2026, 4, 14),
                due_date=date(2026, 5, 14),
                subtotal_amount=8250000.0,
                tax_amount=1485000.0,
                total_amount=9735000.0,
                bank_name=prof.bank_name or "Axis Bank",
                bank_account_number=prof.bank_account_number or "912010045582190",
                bank_account_hash=prof.bank_account_hash,
                ifsc_code=prof.ifsc_code or "UTIB0000123",
                status="held",
            )
            db.add(inv)
            db.commit()
            db.refresh(inv)

            invi = VendorInvoiceItem(
                invoice_id=inv.id,
                line_number=1,
                sku="SKU-SW-CISCO-C9300",
                description="Cisco Catalyst 9300 48-Port Switch",
                quantity=50.0,
                unit_price=165000.0,
                tax_amount=1485000.0,
                total_price=9735000.0,
            )
            db.add(invi)
            db.commit()

            evaluate_transaction_context(db, po, grn, inv)

    # 3. Apex Growth Media - Price Mismatch (Rate hike over PO)
    v_apex = db.query(Vendor).filter(Vendor.name.like("%Apex Growth%")).first()
    if v_apex:
        po_num = "PO-2026-AGM-210"
        po = db.query(PurchaseOrder).filter(PurchaseOrder.po_number == po_num).first()
        if not po:
            po = PurchaseOrder(
                po_number=po_num,
                vendor_id=v_apex.id,
                department="Marketing",
                issue_date=date(2026, 4, 5),
                delivery_due_date=date(2026, 4, 20),
                total_amount=960000.0,
                tax_amount=172800.0,
                status="received",
            )
            db.add(po)
            db.commit()
            db.refresh(po)

            poi = PurchaseOrderItem(
                po_id=po.id,
                line_number=1,
                sku="SKU-MKT-CAMPAIGN",
                description="Performance Marketing Media Optimization",
                quantity=8.0,
                unit_price=120000.0,
                tax_rate=0.18,
                total_price=960000.0,
            )
            db.add(poi)
            db.commit()

            grn_num = "GRN-2026-AGM-210"
            grn = GoodsReceiptNote(
                grn_number=grn_num,
                po_id=po.id,
                vendor_id=v_apex.id,
                received_date=date(2026, 4, 18),
                warehouse_id="WH-SERVICES",
                quality_inspection_status="passed",
                notes="Digital marketing deliverables approved by CMO.",
            )
            db.add(grn)
            db.commit()
            db.refresh(grn)

            grni = GoodsReceiptNoteItem(
                grn_id=grn.id,
                po_item_id=poi.id,
                sku="SKU-MKT-CAMPAIGN",
                description="Performance Marketing Media Optimization",
                ordered_quantity=8.0,
                received_quantity=8.0,
                accepted_quantity=8.0,
                rejected_quantity=0.0,
            )
            db.add(grni)
            db.commit()

            prof = get_or_create_vendor_profile(db, v_apex)
            inv_num = "INV-2026-AGM-9022"
            inv = VendorInvoiceRecord(
                invoice_number=inv_num,
                po_id=po.id,
                vendor_id=v_apex.id,
                invoice_date=date(2026, 4, 20),
                due_date=date(2026, 5, 20),
                subtotal_amount=1320000.0,
                tax_amount=237600.0,
                total_amount=1557600.0,
                bank_name=prof.bank_name or "ICICI Bank",
                bank_account_number=prof.bank_account_number or "000105004481",
                bank_account_hash=prof.bank_account_hash,
                ifsc_code=prof.ifsc_code or "ICIC0000001",
                status="under_review",
            )
            db.add(inv)
            db.commit()
            db.refresh(inv)

            invi = VendorInvoiceItem(
                invoice_id=inv.id,
                line_number=1,
                sku="SKU-MKT-CAMPAIGN",
                description="Performance Marketing Media Optimization",
                quantity=8.0,
                unit_price=165000.0,
                tax_amount=237600.0,
                total_price=1557600.0,
            )
            db.add(invi)
            db.commit()

            evaluate_transaction_context(db, po, grn, inv)

    # 4. Cognitive Infotech - Clean 100% Match (Automated Low Risk Approval)
    v_cog = db.query(Vendor).filter(Vendor.name.like("%Cognitive Infotech%")).first()
    if v_cog:
        po_num = "PO-2026-COG-105"
        po = db.query(PurchaseOrder).filter(PurchaseOrder.po_number == po_num).first()
        if not po:
            po = PurchaseOrder(
                po_number=po_num,
                vendor_id=v_cog.id,
                department="Engineering",
                issue_date=date(2026, 4, 3),
                delivery_due_date=date(2026, 4, 18),
                total_amount=1800000.0,
                tax_amount=324000.0,
                status="received",
            )
            db.add(po)
            db.commit()
            db.refresh(po)

            poi = PurchaseOrderItem(
                po_id=po.id,
                line_number=1,
                sku="SKU-CLOUD-SEATS",
                description="Cognitive AI Enterprise Cloud Seats",
                quantity=50.0,
                unit_price=36000.0,
                tax_rate=0.18,
                total_price=1800000.0,
            )
            db.add(poi)
            db.commit()

            grn_num = "GRN-2026-COG-105"
            grn = GoodsReceiptNote(
                grn_number=grn_num,
                po_id=po.id,
                vendor_id=v_cog.id,
                received_date=date(2026, 4, 5),
                warehouse_id="WH-CLOUD",
                quality_inspection_status="passed",
                notes="API provisioning tokens activated for all 50 seats.",
            )
            db.add(grn)
            db.commit()
            db.refresh(grn)

            grni = GoodsReceiptNoteItem(
                grn_id=grn.id,
                po_item_id=poi.id,
                sku="SKU-CLOUD-SEATS",
                description="Cognitive AI Enterprise Cloud Seats",
                ordered_quantity=50.0,
                received_quantity=50.0,
                accepted_quantity=50.0,
                rejected_quantity=0.0,
            )
            db.add(grni)
            db.commit()

            prof = get_or_create_vendor_profile(db, v_cog)
            inv_num = "INV-2026-COG-3310"
            inv = VendorInvoiceRecord(
                invoice_number=inv_num,
                po_id=po.id,
                vendor_id=v_cog.id,
                invoice_date=date(2026, 4, 6),
                due_date=date(2026, 5, 6),
                subtotal_amount=1800000.0,
                tax_amount=324000.0,
                total_amount=2124000.0,
                bank_name=prof.bank_name or "HDFC Bank",
                bank_account_number=prof.bank_account_number or "5010044812399",
                bank_account_hash=prof.bank_account_hash,
                ifsc_code=prof.ifsc_code or "HDFC0000123",
                status="approved",
            )
            db.add(inv)
            db.commit()
            db.refresh(inv)

            invi = VendorInvoiceItem(
                invoice_id=inv.id,
                line_number=1,
                sku="SKU-CLOUD-SEATS",
                description="Cognitive AI Enterprise Cloud Seats",
                quantity=50.0,
                unit_price=36000.0,
                tax_amount=324000.0,
                total_price=2124000.0,
            )
            db.add(invi)
            db.commit()

            evaluate_transaction_context(db, po, grn, inv)
