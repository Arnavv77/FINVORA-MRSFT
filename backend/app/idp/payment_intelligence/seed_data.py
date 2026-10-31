"""Deterministic Fictional Demonstration Data Seeder for FINVORA IDP.

Seeds:
- 1 Fictional Enterprise Company
- 6 Fictional Debtors with aliases and bank profiles
- 12 Fictional Invoices covering exact, partial, multi-split, and identical amount scenarios
- 13 Scenario payloads ready for deterministic demonstration
"""

from __future__ import annotations
from datetime import datetime, timedelta
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from .models import (
    IDPCompany,
    IDPDebtorLedger,
    IDPInvoice,
    IDPPayment,
    IDPReconciliationRecommendation,
    IDPApprovalDecision,
    IDPERPPostingVoucher,
    IDPMemoryFeedback,
    IDPFederatedModel,
)


def seed_payment_intelligence_demo(db: Session) -> Dict[str, Any]:
    """Cleans previous demo payments (without touching unrelated tables) and seeds deterministic data."""
    # 1. Company
    comp = db.query(IDPCompany).filter(IDPCompany.company_code == "FINVORA-ENT-001").first()
    if not comp:
        comp = IDPCompany(
            company_code="FINVORA-ENT-001",
            name="FINVORA Enterprise Systems India Pvt Ltd",
            federated_opt_in=True,
        )
        db.add(comp)
        db.commit()
        db.refresh(comp)

    # Clean existing IDP tables for clean demo run (in reverse foreign key dependency order)
    db.query(IDPFederatedModel).delete()
    db.query(IDPERPPostingVoucher).delete()
    db.query(IDPApprovalDecision).delete()
    db.query(IDPReconciliationRecommendation).delete()
    db.query(IDPPayment).delete()
    db.query(IDPInvoice).delete()
    db.query(IDPMemoryFeedback).delete()
    db.query(IDPDebtorLedger).delete()
    db.commit()

    # 2. Seed Fictional Debtors
    debtors_data = [
        {
            "code": "DEBT-101",
            "name": "TechCorp Solutions Pvt Ltd",
            "aliases": ["TechCorp", "TechCorp India", "TechCorp Tech"],
            "gstin": "27AABCT1234F1Z1",
            "pan": "AABCT1234F",
            "bank_account": "50200012345678",
            "ifsc": "HDFC0001234",
            "vpa": "techcorp@okhdfcbank",
            "default_ledger": "TechCorp Solutions Debtor A/c",
            "current_balance": 750000.0,
        },
        {
            "code": "DEBT-102",
            "name": "Apex Cloud Infrastructure Ltd",
            "aliases": ["Apex Cloud", "Apex Infra", "Apex Systems"],
            "gstin": "29AAACA9988G1Z2",
            "pan": "AAACA9988G",
            "bank_account": "912345678901",
            "ifsc": "ICIC0000999",
            "vpa": "apexcloud@icici",
            "default_ledger": "Apex Cloud Sundry Debtors",
            "current_balance": 2350000.0,
        },
        {
            "code": "DEBT-103",
            "name": "Nova Logistics Network LLP",
            "aliases": ["Nova Logistics", "Nova Transport", "Nova Freight"],
            "gstin": "33AAALN4455H1Z3",
            "pan": "AAALN4455H",
            "bank_account": "112233445566",
            "ifsc": "SBIN0001234",
            "vpa": "novalog@oksbi",
            "default_ledger": "Nova Logistics Receivables A/c",
            "current_balance": 1900000.0,
        },
        {
            "code": "DEBT-104",
            "name": "Zenith Bio-Health Corp",
            "aliases": ["Zenith Bio", "Zenith Health"],
            "gstin": "24AAACZ7788J1Z4",
            "pan": "AAACZ7788J",
            "bank_account": "998877665544",
            "ifsc": "KKBK0000111",
            "vpa": "zenithbio@kotak",
            "default_ledger": "Zenith Bio-Health Ledger",
            "current_balance": 750000.0,  # Exact 7.5L for collision test
        },
        {
            "code": "DEBT-105",
            "name": "Horizon Retail Distributors Ltd",
            "aliases": ["Horizon Retail", "Horizon Stores"],
            "gstin": "19AAACH5566K1Z5",
            "pan": "AAACH5566K",
            "bank_account": "445566778899",
            "ifsc": "UTIB0000222",
            "vpa": "horizon@axisbank",
            "default_ledger": "Horizon Retail Trade Receivables",
            "current_balance": 750000.0,  # Exact 7.5L for collision test
        },
        {
            "code": "DEBT-106",
            "name": "Kalyan Industrial Supplies Pvt Ltd",
            "aliases": ["Kalyan Ind", "Kalyan Supplies"],
            "gstin": "27AAACK1122L1Z6",
            "pan": "AAACK1122L",
            "bank_account": "776655443322",
            "ifsc": "PUNB0000333",
            "vpa": "kalyan@pnb",
            "default_ledger": "Kalyan Industrial Trade A/c",
            "current_balance": 180000.0,
        },
    ]

    debtors_map = {}
    for d in debtors_data:
        debtor_rec = IDPDebtorLedger(
            company_id=comp.id,
            debtor_code=d["code"],
            name=d["name"],
            aliases=d["aliases"],
            gstin=d["gstin"],
            pan=d["pan"],
            bank_account=d["bank_account"],
            ifsc=d["ifsc"],
            vpa=d["vpa"],
            default_ledger=d["default_ledger"],
            opening_balance=d["current_balance"],
            current_balance=d["current_balance"],
        )
        db.add(debtor_rec)
        db.commit()
        db.refresh(debtor_rec)
        debtors_map[d["code"]] = debtor_rec

    # 3. Seed Fictional Invoices
    today = datetime.utcnow()
    invoices_data = [
        # TechCorp Invoices
        {"debtor": "DEBT-101", "inv": "INV-2026-TC-101", "total": 500000.0, "bal": 500000.0},
        {"debtor": "DEBT-101", "inv": "INV-2026-TC-102", "total": 250000.0, "bal": 250000.0},
        # Apex Cloud Invoices
        {"debtor": "DEBT-102", "inv": "INV-2026-APX-201", "total": 1200000.0, "bal": 1200000.0},
        {"debtor": "DEBT-102", "inv": "INV-2026-APX-202", "total": 800000.0, "bal": 800000.0},
        {"debtor": "DEBT-102", "inv": "INV-2026-APX-203", "total": 350000.0, "bal": 350000.0},  # For partial payment test
        # Nova Logistics Invoices:
        # INV-2026-NV-301: 400k (Cleared in Scenario 3)
        # INV-2026-NV-302: 450k + INV-2026-NV-303: 550k = 1M (Cleared in Scenario 7 multi-split)
        # INV-2026-NV-304: 500k (Cleared partially in Scenario 11 & Scenario 12)
        {"debtor": "DEBT-103", "inv": "INV-2026-NV-301", "total": 400000.0, "bal": 400000.0},
        {"debtor": "DEBT-103", "inv": "INV-2026-NV-302", "total": 450000.0, "bal": 450000.0},
        {"debtor": "DEBT-103", "inv": "INV-2026-NV-303", "total": 550000.0, "bal": 550000.0},
        {"debtor": "DEBT-103", "inv": "INV-2026-NV-304", "total": 500000.0, "bal": 500000.0},
        # Zenith Bio vs Horizon Retail Identical Amount Invoices (750k each)
        {"debtor": "DEBT-104", "inv": "INV-2026-ZN-401", "total": 750000.0, "bal": 750000.0},
        {"debtor": "DEBT-105", "inv": "INV-2026-HZ-501", "total": 750000.0, "bal": 750000.0},
        # Kalyan Supplies
        {"debtor": "DEBT-106", "inv": "INV-2026-KL-601", "total": 180000.0, "bal": 180000.0},
    ]

    for inv in invoices_data:
        d_rec = debtors_map[inv["debtor"]]
        inv_rec = IDPInvoice(
            company_id=comp.id,
            debtor_id=d_rec.id,
            invoice_number=inv["inv"],
            invoice_date=today - timedelta(days=15),
            due_date=today + timedelta(days=15),
            total_amount=inv["total"],
            paid_amount=0.0,
            balance_amount=inv["bal"],
            status="UNPAID",
            items_summary=[{"description": "Enterprise FinTech & IT Services", "amount": inv["total"]}],
        )
        db.add(inv_rec)

    db.commit()

    return {
        "status": "success",
        "company": comp.name,
        "debtors_seeded": len(debtors_data),
        "invoices_seeded": len(invoices_data),
        "message": "Deterministic demo environment initialized successfully.",
    }


def get_all_demo_scenarios_payloads() -> List[Dict[str, Any]]:
    """Returns the 13 deterministic scenario payloads."""
    return [
        # Scenario 1: Cheque payment with exact debtor and invoice match
        {
            "scenario_id": 1,
            "title": "Cheque Payment - Exact Debtor & Invoice Match",
            "payment_mode": "CHEQUE",
            "payload": {
                "cheque_number": "778899",
                "cheque_series": "SB-MICR-01",
                "amount": 500000.0,
                "bank": "HDFC Bank Ltd",
                "date": "2026-04-14",
                "payer_details": {
                    "drawer_name": "TechCorp Solutions Pvt Ltd",
                    "account_number": "50200012345678",
                    "memo": "Payment for INV-2026-TC-101",
                },
            },
            "expected_tier": "EXACT_MATCH",
            "expected_debtor": "TechCorp Solutions Pvt Ltd",
            "expected_invoice": "INV-2026-TC-101",
        },
        # Scenario 2: UPI payment identified through UTR and payer information
        {
            "scenario_id": 2,
            "title": "UPI Payment - UTR & Payer VPA Fingerprint",
            "payment_mode": "UPI",
            "payload": {
                "upi_transaction_id": "UPI-2026-992211",
                "utr_rrn": "411223344556",
                "payer_vpa": "apexcloud@icici",
                "narration": "Settlement INV-2026-APX-201",
                "amount": 1200000.0,
                "transaction_date": "2026-04-14",
            },
            "expected_tier": "EXACT_MATCH",
            "expected_debtor": "Apex Cloud Infrastructure Ltd",
            "expected_invoice": "INV-2026-APX-201",
        },
        # Scenario 3: NEFT payment identified through remitter details
        {
            "scenario_id": 3,
            "title": "NEFT Payment - Remitter Name & Narration Reference",
            "payment_mode": "NEFT",
            "payload": {
                "utr": "NEFT-N20260414-8811",
                "remitter_name": "Nova Logistics Network LLP",
                "bank_reference": "CB-MUM-88110",
                "narration": "NEFT INVOICE NV-301 CLEARANCE",
                "amount": 400000.0,
                "date": "2026-04-14",
            },
            "expected_tier": "EXACT_MATCH",
            "expected_debtor": "Nova Logistics Network LLP",
            "expected_invoice": "INV-2026-NV-301",
        },
        # Scenario 4: RTGS payment
        {
            "scenario_id": 4,
            "title": "RTGS Payment - High Value Inter-Bank Settlement",
            "payment_mode": "RTGS",
            "payload": {
                "utr": "RTGS-R20260414-9922",
                "remitter_details": {
                    "name": "TechCorp Solutions Pvt Ltd",
                    "bank": "HDFC Bank",
                    "account": "50200012345678",
                },
                "bank_reference": "RBI-RTGS-99221",
                "amount": 250000.0,
                "date": "2026-04-14",
            },
            "expected_tier": "EXACT_MATCH",
            "expected_debtor": "TechCorp Solutions Pvt Ltd",
            "expected_invoice": "INV-2026-TC-102",
        },
        # Scenario 5: IMPS payment
        {
            "scenario_id": 5,
            "title": "IMPS Payment - Instant Transfer Sender Verification",
            "payment_mode": "IMPS",
            "payload": {
                "transaction_reference": "IMPS-6041412398",
                "sender_details": {
                    "name": "Apex Cloud Infrastructure Ltd",
                    "account": "912345678901",
                    "mobile": "+919876543210",
                },
                "amount": 800000.0,
                "date": "2026-04-14",
            },
            "expected_tier": "EXACT_MATCH",
            "expected_debtor": "Apex Cloud Infrastructure Ltd",
            "expected_invoice": "INV-2026-APX-202",
        },
        # Scenario 6: Partial invoice payment
        {
            "scenario_id": 6,
            "title": "Partial Payment - Less Than Open Invoice Balance",
            "payment_mode": "BANK_TRANSFER",
            "payload": {
                "account_reference": "HDFC-INT-7711",
                "narration": "Part settlement INV-2026-APX-203",
                "payer_details": {
                    "name": "Apex Cloud Infrastructure Ltd",
                    "account": "912345678901",
                    "bank": "ICICI Bank",
                },
                "amount": 150000.0,  # Open invoice is 350,000.0 -> Remaining 200,000.0
                "date": "2026-04-14",
            },
            "expected_tier": "PARTIAL_PAYMENT",
            "expected_debtor": "Apex Cloud Infrastructure Ltd",
            "expected_invoice": "INV-2026-APX-203",
        },
        # Scenario 7: One payment covering multiple invoices
        {
            "scenario_id": 7,
            "title": "Multi-Invoice Split - 1 Payment Clears 2 Invoices",
            "payment_mode": "NEFT",
            "payload": {
                "utr": "NEFT-N20260414-4433",
                "remitter_name": "Nova Logistics Network LLP",
                "bank_reference": "CB-MUM-44330",
                "narration": "Payment for combined fleet logistics INV-NV-302 & 303",
                "amount": 1000000.0,  # 450,000 + 550,000 = 1,000,000 exactly
                "date": "2026-04-14",
            },
            "expected_tier": "MULTI_INVOICE_SPLIT",
            "expected_debtor": "Nova Logistics Network LLP",
        },
        # Scenario 8: Two debtors having identical invoice amounts
        {
            "scenario_id": 8,
            "title": "Identical Amount Collision - Anti-Hallucination Guardrail",
            "payment_mode": "BANK_TRANSFER",
            "payload": {
                "account_reference": "GEN-TRF-0099",
                "narration": "Clearing balance of Rs 750000",
                "payer_details": {
                    "name": "General Commercial Clearing A/c",  # Missing distinguishing debtor alias
                    "account": "000099881122",
                    "bank": "Axis Bank",
                },
                "amount": 750000.0,  # Matches both Zenith Bio (DEBT-104) and Horizon Retail (DEBT-105)
                "date": "2026-04-14",
            },
            "expected_tier": "AMBIGUOUS_DEBTOR",
        },
        # Scenario 9: Duplicate transaction
        {
            "scenario_id": 9,
            "title": "Duplicate Detection - Identical Reference Hazard",
            "payment_mode": "UPI",
            "payload": {
                "upi_transaction_id": "UPI-2026-992211",  # Same as Scenario 2!
                "utr_rrn": "411223344556",
                "payer_vpa": "apexcloud@icici",
                "narration": "Settlement INV-2026-APX-201",
                "amount": 1200000.0,
                "transaction_date": "2026-04-14",
            },
            "expected_tier": "DUPLICATE_SUSPECT",
        },
        # Scenario 10: Unidentified payment
        {
            "scenario_id": 10,
            "title": "Unidentified Payment - Missing Identifiers",
            "payment_mode": "CASH",
            "payload": {
                "receipt_number": "CASH-RCPT-9999",
                "payer_identity": {
                    "name": "Anonymous Counter Deposit",
                    "pan": "UNKNOWN",
                },
                "amount": 315420.0,  # Random amount, no open invoice match
                "date": "2026-04-14",
            },
            "expected_tier": "UNIDENTIFIED",
        },
        # Scenario 11: Human correction of an incorrect recommendation
        {
            "scenario_id": 11,
            "title": "HITL Workflow - Accountant Correction & Memory Feedback",
            "payment_mode": "BANK_TRANSFER",
            "payload": {
                "account_reference": "TRF-K-SUPPLY-OPS",
                "narration": "Payment via K-SUPPLY-OPS partner network",
                "payer_details": {
                    "name": "K-Supply Operations Agency",
                    "account": "887766554433",
                    "bank": "Punjab National Bank",
                },
                "amount": 180000.0,
                "date": "2026-04-14",
            },
            "target_action": "CORRECT_DEBTOR",
            "correct_to_debtor": "DEBT-103",  # Correct to Nova Logistics LLP
        },
        # Scenario 12: Previously corrected payment pattern recognized
        {
            "scenario_id": 12,
            "title": "CAFIE Memory Recognition - Learned Pattern Applied",
            "payment_mode": "BANK_TRANSFER",
            "payload": {
                "account_reference": "TRF-K-SUPPLY-OPS-2",
                "narration": "Subsequent settlement via K-SUPPLY-OPS partner network",
                "payer_details": {
                    "name": "K-Supply Operations Agency",
                    "account": "887766554433",
                    "bank": "Punjab National Bank",
                },
                "amount": 180000.0,
                "date": "2026-04-15",
            },
            "expected_tier": "PARTIAL_PAYMENT",
            "expected_debtor": "Nova Logistics Network LLP",
        },
        # Scenario 13: Federated learning simulation with 3 isolated companies
        {
            "scenario_id": 13,
            "title": "Federated Learning - 3 Isolated Companies Multi-Tenant Simulation",
            "action": "FEDERATED_ROUND",
        },
    ]
