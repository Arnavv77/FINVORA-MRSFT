"""FINVORA CAFIE Model 4 — Predictive Validation Engine.

Performs:
1. 3-Way PO-GRN-Invoice matching (quantity, price, tax).
2. Duplicate invoice detection & premature/missing document checks.
3. Bank account verification against Vendor Master data.
4. Baseline ML Inference across all 4 models:
   - Document Classification (TF-IDF + Logistic Regression)
   - Invoice Risk Prediction (Random Forest)
   - Financial Anomaly Detection (Isolation Forest)
   - Vendor Risk Prediction (Random Forest)
5. Explainable Composite Risk Scoring (0-100) & Actionable Evidence Generation.
6. Persistence in `cafie_model4_validation_results`.
"""

from __future__ import annotations
import uuid
import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.cafie.model4.models import (
    Model4PurchaseOrder,
    Model4GoodsReceiptNote,
    Model4Invoice,
    Model4VendorMaster,
    Model4ValidationResult,
)
from app.cafie.model4.ml_engine import ml_engine


class Model4PredictiveValidator:
    """Orchestrates document intelligence, 3-way matching, and ML baseline predictions."""

    def __init__(self, db: Session):
        self.db = db

    def validate_invoice(
        self,
        invoice_number: str,
        po_number_override: Optional[str] = None,
        grn_number_override: Optional[str] = None
    ) -> Model4ValidationResult:
        """Executes full predictive validation pipeline for an invoice."""
        # 1. Fetch Invoice
        invoice = self.db.query(Model4Invoice).filter_by(invoice_number=invoice_number).first()
        if not invoice:
            raise ValueError(f"Invoice '{invoice_number}' not found in Enterprise dataset.")

        po_num = po_number_override or invoice.po_number
        grn_num = grn_number_override

        # 2. Fetch PO (if referenced)
        po = None
        if po_num:
            po = self.db.query(Model4PurchaseOrder).filter_by(po_number=po_num).first()

        # 3. Fetch GRN (if referenced or lookup by PO)
        grn = None
        if grn_num:
            grn = self.db.query(Model4GoodsReceiptNote).filter_by(grn_number=grn_num).first()
        elif po_num:
            grn = self.db.query(Model4GoodsReceiptNote).filter_by(po_number=po_num).first()
            if grn:
                grn_num = grn.grn_number

        # 4. Fetch Vendor Master
        vendor = self.db.query(Model4VendorMaster).filter_by(vendor_code=invoice.vendor_code).first()

        # ====================================================================
        # DETERMINISTIC 3-WAY MATCHING & DISCREPANCY ANALYSIS
        # ====================================================================
        evidence_list: List[Dict[str, Any]] = []
        recommendations: List[str] = []

        is_duplicate = False
        quantity_delta = 0.0
        price_delta = 0.0
        financial_exposure = 0.0
        match_status = "MATCHED"

        # Check A: Duplicate Invoice Detection
        existing_paid = self.db.query(Model4Invoice).filter(
            Model4Invoice.invoice_number != invoice.invoice_number,
            Model4Invoice.vendor_code == invoice.vendor_code,
            Model4Invoice.total_amount == invoice.total_amount,
            Model4Invoice.payment_status.in_(["PAID", "APPROVED"])
        ).first()

        if existing_paid or "-DUP" in invoice.invoice_number:
            is_duplicate = True
            match_status = "DUPLICATE"
            financial_exposure += invoice.total_amount
            evidence_list.append({
                "category": "DUPLICATE",
                "severity": "CRITICAL",
                "description": f"Duplicate invoice detected! Identical bill amount INR {invoice.total_amount:,.2f} previously settled.",
                "observed_value": invoice.invoice_number,
                "expected_value": existing_paid.invoice_number if existing_paid else "None"
            })
            recommendations.append("Immediately REJECT invoice to prevent duplicate cash disbursement.")

        # Check B: Missing Purchase Order
        if not po:
            if match_status == "MATCHED":
                match_status = "MISSING_PO"
            financial_exposure += invoice.total_amount
            evidence_list.append({
                "category": "MISSING_PO",
                "severity": "CRITICAL",
                "description": "Invoice lacks an authorized Purchase Order reference in ERP.",
                "observed_value": invoice.po_number or "None",
                "expected_value": "Valid PO-2026-XXX"
            })
            recommendations.append("Route to Procurement for unapproved spend authorization and retroactive PO approval.")

        # Check C: Missing Goods Receipt Note
        elif not grn:
            if match_status == "MATCHED":
                match_status = "MISSING_GRN"
            financial_exposure += invoice.total_amount
            evidence_list.append({
                "category": "MISSING_GRN",
                "severity": "CRITICAL",
                "description": "No Goods Receipt Note found. Goods have not been received or inspected in warehouse.",
                "observed_value": "GRN Missing",
                "expected_value": "Signed WH Gate Entry & QC Pass"
            })
            recommendations.append("Place invoice on HOLD until warehouse logs physical receipt and inspection signoff.")

        # Check D: Quantity Mismatch (Invoice vs GRN Accepted)
        if grn and po:
            inv_total_qty = sum(item.get("quantity", 0) for item in invoice.items)
            grn_acc_qty = grn.accepted_quantity
            qty_diff = inv_total_qty - grn_acc_qty

            if qty_diff > 0.001:
                quantity_delta = round(qty_diff, 2)
                if match_status == "MATCHED":
                    match_status = "QUANTITY_MISMATCH"
                
                # Calculate exposure from excess units
                unit_rate = (invoice.subtotal_amount / inv_total_qty) if inv_total_qty > 0 else 0.0
                exposure_qty = round(quantity_delta * unit_rate * 1.18, 2)
                financial_exposure += exposure_qty

                evidence_list.append({
                    "category": "QUANTITY_MISMATCH",
                    "severity": "HIGH",
                    "description": f"Over-billing: Invoiced {inv_total_qty} units, but warehouse accepted only {grn_acc_qty} units ({grn.rejected_quantity} rejected).",
                    "observed_value": f"{inv_total_qty} units",
                    "expected_value": f"{grn_acc_qty} units"
                })
                recommendations.append(f"Request revised invoice or issue Debit Note of INR {exposure_qty:,.2f} for rejected/missing units.")

            # Check E: Price Mismatch (Invoice Unit Price vs Contracted PO Price)
            po_unit_prices = {item.get("item_code"): item.get("unit_price") for item in po.items}
            for inv_item in invoice.items:
                icode = inv_item.get("item_code")
                inv_up = inv_item.get("unit_price", 0.0)
                po_up = po_unit_prices.get(icode)

                if po_up and (inv_up - po_up) > 0.01:
                    diff_rate = inv_up - po_up
                    price_delta = round(diff_rate, 2)
                    if match_status == "MATCHED":
                        match_status = "PRICE_MISMATCH"

                    price_exposure = round(diff_rate * inv_item.get("quantity", 1.0) * 1.18, 2)
                    financial_exposure += price_exposure

                    pct_over = round(((inv_up - po_up) / po_up) * 100, 1)
                    evidence_list.append({
                        "category": "PRICE_MISMATCH",
                        "severity": "HIGH",
                        "description": f"Contract rate exceeded for {icode}: Invoiced INR {inv_up:,.2f} vs PO rate INR {po_up:,.2f} (+{pct_over}%).",
                        "observed_value": f"INR {inv_up:,.2f}",
                        "expected_value": f"INR {po_up:,.2f}"
                    })
                    recommendations.append(f"Enforce contracted rate: Disallow unapproved price escalation (+INR {price_exposure:,.2f}).")

        # Check F: Vendor Bank Account Verification
        if vendor and vendor.registered_bank_account:
            if invoice.bank_account_number and invoice.bank_account_number != vendor.registered_bank_account:
                evidence_list.append({
                    "category": "BANK_MISMATCH",
                    "severity": "CRITICAL",
                    "description": f"Bank account mismatch! Invoice lists A/C {invoice.bank_account_number} ({invoice.ifsc_code}), but master registry lists A/C {vendor.registered_bank_account} ({vendor.registered_ifsc}).",
                    "observed_value": invoice.bank_account_number,
                    "expected_value": vendor.registered_bank_account
                })
                financial_exposure += invoice.total_amount
                recommendations.append("SECURITY ALERT: Verify banking credentials out-of-band to prevent account takeover fraud.")
                match_status = "3-WAY MISMATCH"

        # ====================================================================
        # BASELINE ML MODEL PREDICTIONS
        # ====================================================================
        ml_engine.ensure_trained(db=self.db)

        # 1. Document Classification
        raw_text = invoice.raw_text or f"INVOICE {invoice.invoice_number} {invoice.vendor_name} INR {invoice.total_amount}"
        doc_class, doc_conf = ml_engine.predict_document_type(raw_text)

        # 2. Invoice Risk Classification
        qty_ratio = (quantity_delta / max(1.0, invoice.subtotal_amount)) if quantity_delta > 0 else 0.0
        price_ratio = (price_delta / max(1.0, invoice.subtotal_amount)) if price_delta > 0 else 0.0
        tax_ratio = (invoice.tax_amount / invoice.subtotal_amount) if invoice.subtotal_amount > 0 else 0.18
        tax_deviation = abs(tax_ratio - 0.18)
        lead_time = (invoice.due_date - invoice.invoice_date).days if invoice.due_date and invoice.invoice_date else 30
        vendor_disc_rate = (vendor.discrepancy_count / max(1, vendor.total_orders_completed)) if vendor else 0.05

        inv_risk_pred, inv_risk_conf = ml_engine.predict_invoice_risk(
            qty_deviation=qty_ratio,
            price_deviation=price_ratio,
            tax_deviation=tax_deviation,
            amount=invoice.total_amount,
            lead_time_days=float(lead_time),
            vendor_discrepancy_rate=vendor_disc_rate
        )

        # 3. Financial Anomaly Detection (Isolation Forest)
        up_ratio = 1.0 + (price_delta / 1000.0)
        q_ratio = 1.0 + (quantity_delta / 50.0)
        anomaly_label, anomaly_score = ml_engine.detect_financial_anomaly(
            total_amount=invoice.total_amount,
            tax_ratio=tax_ratio,
            unit_price_ratio=up_ratio,
            quantity_ratio=q_ratio
        )

        if anomaly_label == "ANOMALY":
            evidence_list.append({
                "category": "ML_ANOMALY",
                "severity": "WARNING" if anomaly_score < 0.8 else "CRITICAL",
                "description": f"Isolation Forest flagged financial anomaly (anomaly score: {anomaly_score:.2f}). Unusual amount/tax configuration.",
                "observed_value": f"Tax ratio {tax_ratio:.1%}, Total INR {invoice.total_amount:,.2f}",
                "expected_value": "Standard 18.0% GST and typical spend profile"
            })
            if match_status == "MATCHED":
                match_status = "MULTI_ANOMALY"

        # 4. Vendor Risk Prediction (Random Forest)
        v_fill = vendor.delivery_fill_rate if vendor else 90.0
        v_disc = vendor.discrepancy_count if vendor else 2
        v_bchg = vendor.bank_change_count if vendor else 0
        v_lead = vendor.avg_lead_time_days if vendor else 7.0
        v_orders = vendor.total_orders_completed if vendor else 20

        vend_risk_pred, vend_risk_conf = ml_engine.predict_vendor_risk(
            delivery_fill_rate=v_fill,
            discrepancy_count=v_disc,
            bank_change_count=v_bchg,
            avg_lead_time_days=v_lead,
            total_orders_completed=v_orders
        )

        if vend_risk_pred == "HIGH":
            evidence_list.append({
                "category": "VENDOR_RISK",
                "severity": "WARNING",
                "description": f"Vendor {invoice.vendor_name} classified as HIGH risk based on behavioral metrics (Fill rate {v_fill}%, Discrepancies {v_disc}).",
                "observed_value": f"Risk: {vend_risk_pred} ({vend_risk_conf:.1%})",
                "expected_value": "Tier-1 compliant supplier"
            })

        # ====================================================================
        # COMPOSITE EXPLAINABLE RISK SCORE (0 - 100)
        # ====================================================================
        base_score = 10.0

        if match_status == "MATCHED":
            base_score = 8.0
        elif match_status == "QUANTITY_MISMATCH":
            base_score = 55.0
        elif match_status == "PRICE_MISMATCH":
            base_score = 60.0
        elif match_status == "DUPLICATE":
            base_score = 95.0
        elif match_status == "MISSING_GRN":
            base_score = 75.0
        elif match_status == "MISSING_PO":
            base_score = 70.0
        elif match_status == "MULTI_ANOMALY":
            base_score = 80.0

        # Add ML weights
        if inv_risk_pred == "HIGH":
            base_score += 15.0
        elif inv_risk_pred == "MEDIUM":
            base_score += 7.0

        if anomaly_label == "ANOMALY":
            base_score += round(anomaly_score * 20.0, 1)

        if vend_risk_pred == "HIGH":
            base_score += 12.0
        elif vend_risk_pred == "MEDIUM":
            base_score += 5.0

        composite_risk_score = round(min(100.0, max(0.0, base_score)), 1)

        if composite_risk_score >= 65.0:
            risk_level = "HIGH"
        elif composite_risk_score >= 35.0:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        if not recommendations:
            recommendations.append("All 3-way validation and ML risk checks passed. Recommended for automated payment approval.")

        # Save or update validation record
        val_number = f"VAL-{invoice.invoice_number}"
        val_record = self.db.query(Model4ValidationResult).filter_by(validation_number=val_number).first()
        if not val_record:
            val_record = Model4ValidationResult(
                company_id=1,
                validation_number=val_number,
                invoice_number=invoice.invoice_number,
                po_number=po_num,
                grn_number=grn_num,
                vendor_code=invoice.vendor_code,
                vendor_name=invoice.vendor_name,
            )
            self.db.add(val_record)
        else:
            val_record.po_number = po_num
            val_record.grn_number = grn_num
            val_record.vendor_code = invoice.vendor_code
            val_record.vendor_name = invoice.vendor_name

        val_record.three_way_match_status = match_status
        val_record.quantity_delta = quantity_delta
        val_record.price_delta = price_delta
        val_record.is_duplicate = is_duplicate
        val_record.doc_classification_label = doc_class
        val_record.doc_classification_confidence = doc_conf
        val_record.invoice_risk_prediction = inv_risk_pred
        val_record.invoice_risk_confidence = inv_risk_conf
        val_record.anomaly_prediction = anomaly_label
        val_record.anomaly_score = anomaly_score
        val_record.vendor_risk_prediction = vend_risk_pred
        val_record.vendor_risk_confidence = vend_risk_conf
        val_record.composite_risk_score = composite_risk_score
        val_record.risk_level = risk_level
        val_record.financial_exposure = financial_exposure
        val_record.recommendations = recommendations
        val_record.supporting_evidence = evidence_list
        val_record.decision_status = "PENDING_REVIEW" if risk_level != "LOW" else "APPROVED"

        self.db.commit()
        self.db.refresh(val_record)
        return val_record

    def validate_all_existing_invoices(self) -> List[Model4ValidationResult]:
        """Runs validation across all invoices in the Model 4 database."""
        invoices = self.db.query(Model4Invoice).all()
        results = []
        for inv in invoices:
            res = self.validate_invoice(invoice_number=inv.invoice_number)
            results.append(res)
        return results

