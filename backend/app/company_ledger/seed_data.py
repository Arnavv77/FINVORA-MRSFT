"""Deterministic Seed Data for Company Ledger & Manager Approval Module.

Demonstration Company:
- ABC Manufacturing Pvt. Ltd. (CMP-ABC-01)
- TechCorp Global Solutions India Pvt. Ltd. (CMP-TCG-02)
"""

from __future__ import annotations
from datetime import datetime, date, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session

from .models import (
    LedgerCompany,
    LedgerAccount,
    LedgerTransaction,
    LedgerEntryLine,
    LedgerTransactionApproval,
    LedgerAuditLog,
    LedgerTransactionComment,
)
from .intelligence_engine import FinvoraLedgerIntelligence


def seed_company_ledger_demo(db: Session) -> LedgerCompany:
    """Safely seeds deterministic demo company, chart of accounts, and realistic transactions."""
    today = date.today()

    # 1. Clean existing demo data safely in proper foreign key order
    demo_company_ids = [c.id for c in db.query(LedgerCompany.id).filter(LedgerCompany.is_demo == True).all()]
    if demo_company_ids:
        # Delete children first
        db.query(LedgerEntryLine).filter(
            LedgerEntryLine.transaction_id.in_(
                db.query(LedgerTransaction.id).filter(LedgerTransaction.company_id.in_(demo_company_ids))
            )
        ).delete(synchronize_session=False)

        db.query(LedgerTransactionApproval).filter(
            LedgerTransactionApproval.transaction_id.in_(
                db.query(LedgerTransaction.id).filter(LedgerTransaction.company_id.in_(demo_company_ids))
            )
        ).delete(synchronize_session=False)

        db.query(LedgerAuditLog).filter(LedgerAuditLog.company_id.in_(demo_company_ids)).delete(synchronize_session=False)
        db.query(LedgerTransactionComment).filter(
            LedgerTransactionComment.transaction_id.in_(
                db.query(LedgerTransaction.id).filter(LedgerTransaction.company_id.in_(demo_company_ids))
            )
        ).delete(synchronize_session=False)

        db.query(LedgerTransaction).filter(LedgerTransaction.company_id.in_(demo_company_ids)).delete(synchronize_session=False)
        db.query(LedgerAccount).filter(LedgerAccount.company_id.in_(demo_company_ids)).delete(synchronize_session=False)
        db.query(LedgerCompany).filter(LedgerCompany.id.in_(demo_company_ids)).delete(synchronize_session=False)
        db.commit()

    # 2. Seed Primary Demo Company: ABC Manufacturing Pvt. Ltd.
    abc_company = LedgerCompany(
        company_code="CMP-ABC-01",
        name="ABC Manufacturing Pvt. Ltd.",
        financial_year="FY 2025-26",
        currency="INR",
        opening_balance=Decimal("2500000.00"),  # ₹25.0 Lakhs opening balance
        current_balance=Decimal("2500000.00"),
        is_demo=True,
        created_at=datetime.utcnow() - timedelta(days=90),
    )
    db.add(abc_company)

    # 3. Seed Secondary Demo Company: TechCorp Global Solutions India Pvt. Ltd.
    techcorp_company = LedgerCompany(
        company_code="CMP-TCG-02",
        name="TechCorp Global Solutions India Pvt. Ltd.",
        financial_year="FY 2025-26",
        currency="INR",
        opening_balance=Decimal("4500000.00"),  # ₹45.0 Lakhs opening balance
        current_balance=Decimal("4500000.00"),
        is_demo=True,
        created_at=datetime.utcnow() - timedelta(days=90),
    )
    db.add(techcorp_company)
    db.commit()
    db.refresh(abc_company)
    db.refresh(techcorp_company)

    # 4. Chart of Accounts for ABC Manufacturing
    accounts_data = [
        ("1010-CASH", "Primary Petty Cash Ledger", "ASSET", Decimal("150000.00"), "DEBIT"),
        ("1020-HDFC-BANK", "HDFC Bank Operating Account", "ASSET", Decimal("2350000.00"), "DEBIT"),
        ("1510-RAW-MATERIALS", "Raw Materials Inventory Stock", "ASSET", Decimal("800000.00"), "DEBIT"),
        ("2010-TRADE-PAYABLES", "Sundry Creditors - Trade Payables", "LIABILITY", Decimal("0.00"), "CREDIT"),
        ("2020-GST-PAYABLE", "GST Input Tax Credit / Liability", "LIABILITY", Decimal("45000.00"), "CREDIT"),
        ("5010-FACTORY-OVERHEAD", "Factory & Operational Expenses", "EXPENSE", Decimal("320000.00"), "DEBIT"),
        ("5020-LOGISTICS-FREIGHT", "Freight & Inward Transportation", "EXPENSE", Decimal("125000.00"), "DEBIT"),
    ]

    account_map = {}
    for code, name, acct_type, bal, norm in accounts_data:
        acct = LedgerAccount(
            company_id=abc_company.id,
            account_code=code,
            account_name=name,
            account_type=acct_type,
            balance=bal,
            normal_balance=norm,
        )
        db.add(acct)
        db.flush()
        account_map[code] = acct

    # ── 5. Seed Transactions for ABC Manufacturing ──────────────────────────

    # Transaction 1 (Required Scenario 1: Clean Match - ₹50,000)
    # Vendor: XYZ Raw Materials, PO: ₹50,000, Invoice: ₹50,000, GRN: ₹50,000, Ref: FIN-1001
    t1 = LedgerTransaction(
        company_id=abc_company.id,
        transaction_number="TXN-2026-001",
        voucher_type="PURCHASE_VOUCHER",
        transaction_date=today - timedelta(days=2),
        reference_no="FIN-1001",
        entity_type="VENDOR",
        entity_name="XYZ Raw Materials Pvt Ltd",
        entity_code="VEND-XYZ-01",
        ledger_account_id=account_map["2010-TRADE-PAYABLES"].id,
        ledger_account_name="Sundry Creditors - Trade Payables",
        description="Supply of High-Tensile Steel Fasteners & Raw Castings for Production Batch #881",
        total_amount=Decimal("50000.00"),
        debit_amount=Decimal("50000.00"),
        credit_amount=Decimal("50000.00"),
        running_balance=Decimal("2500000.00"),
        approval_status="SUBMITTED",
        posting_status="UNPOSTED",
        po_number="PO-2026-8801",
        po_amount=Decimal("50000.00"),
        invoice_number="INV-XYZ-1001",
        invoice_amount=Decimal("50000.00"),
        grn_number="GRN-2026-4401",
        grn_amount=Decimal("50000.00"),
        payment_terms="Net 30 Days via RTGS",
        supporting_documents=[
            {"name": "Tax_Invoice_XYZ_1001.pdf", "type": "INVOICE_PDF", "size": "142 KB"},
            {"name": "PO_Signed_8801.pdf", "type": "PO_DOCUMENT", "size": "88 KB"},
            {"name": "GRN_Warehouse_GatePass_4401.pdf", "type": "GRN_SLIP", "size": "116 KB"},
        ],
        is_demo=True,
        created_at=datetime.utcnow() - timedelta(days=2),
    )
    db.add(t1)
    db.flush()

    # Double entry lines for T1
    db.add(LedgerEntryLine(
        transaction_id=t1.id,
        account_id=account_map["1510-RAW-MATERIALS"].id,
        account_name="Raw Materials Inventory Stock",
        entry_type="DEBIT",
        amount=Decimal("50000.00"),
        narration="Stock Inward - High Tensile Fasteners (PO-2026-8801)",
    ))
    db.add(LedgerEntryLine(
        transaction_id=t1.id,
        account_id=account_map["2010-TRADE-PAYABLES"].id,
        account_name="Sundry Creditors - Trade Payables",
        entry_type="CREDIT",
        amount=Decimal("50000.00"),
        narration="Credit allocated to XYZ Raw Materials (INV-XYZ-1001)",
    ))

    # Audit log for T1 creation
    db.add(LedgerAuditLog(
        company_id=abc_company.id,
        transaction_id=t1.id,
        action="TRANSACTION_SUBMITTED",
        actor="Priya Sharma (Senior Accountant)",
        actor_role="SENIOR_ACCOUNTANT",
        details={"ref": "FIN-1001", "amount": 50000.0, "status": "SUBMITTED"},
        created_at=datetime.utcnow() - timedelta(days=2),
    ))

    # Transaction 2 (Required Scenario 2: Mismatch Discrepancy - PO ₹50k vs Inv ₹55k)
    # Vendor: Delta Steelworks, PO: ₹50,000, Invoice: ₹55,000 (+₹5,000 variance), GRN: ₹50,000, Ref: FIN-1002
    t2 = LedgerTransaction(
        company_id=abc_company.id,
        transaction_number="TXN-2026-002",
        voucher_type="PURCHASE_VOUCHER",
        transaction_date=today - timedelta(days=1),
        reference_no="FIN-1002",
        entity_type="VENDOR",
        entity_name="Delta Steelworks Corp",
        entity_code="VEND-DSL-02",
        ledger_account_id=account_map["2010-TRADE-PAYABLES"].id,
        ledger_account_name="Sundry Creditors - Trade Payables",
        description="Supply of Galvanized Steel Sheets & Cold-Rolled Coils (Discrepancy Flagged)",
        total_amount=Decimal("55000.00"),
        debit_amount=Decimal("55000.00"),
        credit_amount=Decimal("55000.00"),
        running_balance=Decimal("2500000.00"),
        approval_status="UNDER_REVIEW",
        posting_status="UNPOSTED",
        po_number="PO-2026-8802",
        po_amount=Decimal("50000.00"),
        invoice_number="INV-DSL-2002",
        invoice_amount=Decimal("55000.00"),
        grn_number="GRN-2026-4402",
        grn_amount=Decimal("50000.00"),
        payment_terms="Net 45 Days",
        supporting_documents=[
            {"name": "Tax_Invoice_Delta_2002.pdf", "type": "INVOICE_PDF", "size": "158 KB"},
            {"name": "Purchase_Order_8802.pdf", "type": "PO_DOCUMENT", "size": "92 KB"},
            {"name": "Warehouse_GRN_Inspection_4402.pdf", "type": "GRN_SLIP", "size": "120 KB"},
        ],
        is_demo=True,
        created_at=datetime.utcnow() - timedelta(days=1),
    )
    db.add(t2)
    db.flush()

    db.add(LedgerEntryLine(
        transaction_id=t2.id,
        account_id=account_map["1510-RAW-MATERIALS"].id,
        account_name="Raw Materials Inventory Stock",
        entry_type="DEBIT",
        amount=Decimal("55000.00"),
        narration="Inward Galvanized Steel Sheets",
    ))
    db.add(LedgerEntryLine(
        transaction_id=t2.id,
        account_id=account_map["2010-TRADE-PAYABLES"].id,
        account_name="Sundry Creditors - Trade Payables",
        entry_type="CREDIT",
        amount=Decimal("55000.00"),
        narration="Credit to Delta Steelworks Corp (Rate Escalation Pending Review)",
    ))

    db.add(LedgerAuditLog(
        company_id=abc_company.id,
        transaction_id=t2.id,
        action="TRANSACTION_SUBMITTED",
        actor="Priya Sharma (Senior Accountant)",
        actor_role="SENIOR_ACCOUNTANT",
        details={"ref": "FIN-1002", "amount": 55000.0, "status": "UNDER_REVIEW"},
        created_at=datetime.utcnow() - timedelta(days=1),
    ))

    # Transaction 3: Changes Requested Scenario
    # Vendor: Precision Components Ltd, Invoice: ₹1,80,000, Status: CHANGES_REQUESTED
    t3 = LedgerTransaction(
        company_id=abc_company.id,
        transaction_number="TXN-2026-003",
        voucher_type="PURCHASE_VOUCHER",
        transaction_date=today - timedelta(days=4),
        reference_no="FIN-1003",
        entity_type="VENDOR",
        entity_name="Precision Components Ltd",
        entity_code="VEND-PCL-03",
        ledger_account_id=account_map["2010-TRADE-PAYABLES"].id,
        ledger_account_name="Sundry Creditors - Trade Payables",
        description="Hydraulic Cylinder Spares & Valve Assemblies - Line Item #2 Rate Discrepancy",
        total_amount=Decimal("180000.00"),
        debit_amount=Decimal("180000.00"),
        credit_amount=Decimal("180000.00"),
        running_balance=Decimal("2500000.00"),
        approval_status="CHANGES_REQUESTED",
        posting_status="UNPOSTED",
        changes_requested_by="Vikram Aditya (Finance Manager)",
        changes_requested_at=datetime.utcnow() - timedelta(days=2),
        changes_requested_remarks="Line Item #2 unit rate ₹1,800 exceeds approved contract rate ₹1,500. Please obtain revised debit/credit note from vendor before resubmission.",
        manager_remarks="CHANGES REQUESTED: Line Item #2 unit rate ₹1,800 exceeds approved contract rate ₹1,500.",
        po_number="PO-2026-8790",
        po_amount=Decimal("150000.00"),
        invoice_number="INV-PCL-9901",
        invoice_amount=Decimal("180000.00"),
        grn_number="GRN-2026-4389",
        grn_amount=Decimal("150000.00"),
        is_demo=True,
        created_at=datetime.utcnow() - timedelta(days=4),
    )
    db.add(t3)
    db.flush()

    db.add(LedgerEntryLine(
        transaction_id=t3.id,
        account_id=account_map["5010-FACTORY-OVERHEAD"].id,
        account_name="Factory & Operational Expenses",
        entry_type="DEBIT",
        amount=Decimal("180000.00"),
        narration="Hydraulic Cylinder Spares Maintenance",
    ))
    db.add(LedgerEntryLine(
        transaction_id=t3.id,
        account_id=account_map["2010-TRADE-PAYABLES"].id,
        account_name="Sundry Creditors - Trade Payables",
        entry_type="CREDIT",
        amount=Decimal("180000.00"),
        narration="Credit to Precision Components Ltd",
    ))

    db.add(LedgerTransactionApproval(
        transaction_id=t3.id,
        manager_id="MGR-001",
        manager_name="Vikram Aditya",
        decision="REQUEST_CHANGES",
        remarks="Line Item #2 unit rate ₹1,800 exceeds approved contract rate ₹1,500.",
        previous_status="SUBMITTED",
        new_status="CHANGES_REQUESTED",
        created_at=datetime.utcnow() - timedelta(days=2),
    ))

    # Transaction 4: Approved & Posted Transaction (Demonstrates historical balance impact)
    # Vendor: Mahindra Logistics Fleet, ₹85,000, Status: APPROVED & POSTED
    t4 = LedgerTransaction(
        company_id=abc_company.id,
        transaction_number="TXN-2026-004",
        voucher_type="PAYMENT_VOUCHER",
        transaction_date=today - timedelta(days=5),
        reference_no="FIN-1004",
        entity_type="VENDOR",
        entity_name="Mahindra Logistics Fleet Ltd",
        entity_code="VEND-MLF-04",
        ledger_account_id=account_map["1020-HDFC-BANK"].id,
        ledger_account_name="HDFC Bank Operating Account",
        description="Inward Freight Dispatch for Q1 Raw Material Haulage - Approved & Posted",
        total_amount=Decimal("85000.00"),
        debit_amount=Decimal("85000.00"),
        credit_amount=Decimal("0.00"),
        running_balance=Decimal("2415000.00"),
        approval_status="APPROVED",
        posting_status="POSTED",
        approved_by="Vikram Aditya (Finance Manager)",
        approved_at=datetime.utcnow() - timedelta(days=5),
        posted_by="Vikram Aditya (Finance Manager)",
        posted_at=datetime.utcnow() - timedelta(days=5),
        manager_remarks="Verified route GPS transit manifests and approved freight rate card. Payment released via RTGS.",
        po_number="PO-2026-8740",
        po_amount=Decimal("85000.00"),
        invoice_number="INV-MLF-4412",
        invoice_amount=Decimal("85000.00"),
        grn_number="GRN-2026-4350",
        grn_amount=Decimal("85000.00"),
        is_demo=True,
        created_at=datetime.utcnow() - timedelta(days=6),
    )
    db.add(t4)
    db.flush()

    db.add(LedgerEntryLine(
        transaction_id=t4.id,
        account_id=account_map["5020-LOGISTICS-FREIGHT"].id,
        account_name="Freight & Inward Transportation",
        entry_type="DEBIT",
        amount=Decimal("85000.00"),
        narration="Inward Freight Charge",
    ))
    db.add(LedgerEntryLine(
        transaction_id=t4.id,
        account_id=account_map["1020-HDFC-BANK"].id,
        account_name="HDFC Bank Operating Account",
        entry_type="CREDIT",
        amount=Decimal("85000.00"),
        narration="RTGS Payout to Mahindra Logistics Fleet",
    ))

    db.add(LedgerTransactionApproval(
        transaction_id=t4.id,
        manager_id="MGR-001",
        manager_name="Vikram Aditya",
        decision="APPROVE",
        remarks="Verified route GPS transit manifests and approved freight rate card. Approved for posting.",
        previous_status="SUBMITTED",
        new_status="APPROVED",
        created_at=datetime.utcnow() - timedelta(days=5),
    ))

    # Transaction 5: Rejected Transaction Scenario
    # Vendor: Apex Security Systems, ₹42,000, Status: REJECTED
    t5 = LedgerTransaction(
        company_id=abc_company.id,
        transaction_number="TXN-2026-005",
        voucher_type="PURCHASE_VOUCHER",
        transaction_date=today - timedelta(days=7),
        reference_no="FIN-1005",
        entity_type="VENDOR",
        entity_name="Apex Security & Surveillance LLP",
        entity_code="VEND-ASL-05",
        ledger_account_id=account_map["2010-TRADE-PAYABLES"].id,
        ledger_account_name="Sundry Creditors - Trade Payables",
        description="Annual CCTV AMC & Guard Patrol Monitoring Fee - Rejected Duplicate Submission",
        total_amount=Decimal("42000.00"),
        debit_amount=Decimal("42000.00"),
        credit_amount=Decimal("42000.00"),
        running_balance=Decimal("2415000.00"),
        approval_status="REJECTED",
        posting_status="UNPOSTED",
        rejected_by="Vikram Aditya (Finance Manager)",
        rejected_at=datetime.utcnow() - timedelta(days=6),
        rejection_reason="Duplicate claim attempt: Facility security services for Month 2 were already cleared in voucher FIN-0992 on 15th.",
        manager_remarks="REJECTED: Duplicate claim attempt: Facility security services for Month 2 were already cleared in voucher FIN-0992.",
        po_number="PO-2026-8650",
        po_amount=Decimal("42000.00"),
        invoice_number="INV-ASL-3310",
        invoice_amount=Decimal("42000.00"),
        is_demo=True,
        created_at=datetime.utcnow() - timedelta(days=7),
    )
    db.add(t5)
    db.flush()

    db.add(LedgerEntryLine(
        transaction_id=t5.id,
        account_id=account_map["5010-FACTORY-OVERHEAD"].id,
        account_name="Factory & Operational Expenses",
        entry_type="DEBIT",
        amount=Decimal("42000.00"),
        narration="Security Services Overhead",
    ))
    db.add(LedgerEntryLine(
        transaction_id=t5.id,
        account_id=account_map["2010-TRADE-PAYABLES"].id,
        account_name="Sundry Creditors - Trade Payables",
        entry_type="CREDIT",
        amount=Decimal("42000.00"),
        narration="Credit to Apex Security",
    ))

    db.add(LedgerTransactionApproval(
        transaction_id=t5.id,
        manager_id="MGR-001",
        manager_name="Vikram Aditya",
        decision="REJECT",
        remarks="Duplicate claim attempt: Facility security services for Month 2 were already cleared in voucher FIN-0992 on 15th.",
        previous_status="SUBMITTED",
        new_status="REJECTED",
        created_at=datetime.utcnow() - timedelta(days=6),
    ))

    db.commit()

    # 6. Run FINVORA Intelligence on each transaction to compute risk tiers
    for txn in [t1, t2, t3, t4, t5]:
        tier, score, reasons, rec = FinvoraLedgerIntelligence.analyze_transaction(
            db=db,
            company_id=abc_company.id,
            transaction=txn,
        )
        txn.finvora_risk_tier = tier
        txn.finvora_risk_score = score
        txn.finvora_risk_reasons = reasons
        txn.finvora_recommendation = rec

    db.commit()

    # 7. Recalculate company balances
    from .ledger_service import CompanyLedgerService
    CompanyLedgerService.recompute_running_balances(db, abc_company.id)

    db.refresh(abc_company)
    return abc_company
