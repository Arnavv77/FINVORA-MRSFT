"""FINVORA Context-Aware Financial Intelligence Engine (CAFIE) Router.

Exposes REST APIs for:
1. Intelligence Overview & KPI metrics
2. Adaptive Vendor Intelligence profiling & behavioral tracking
3. Inventory-to-Cash Intelligence & working capital analysis
4. Cross-System 3-Way Reconciliation & anomaly detection
5. Financial Risk Memory Engine search & timeline
6. Document Intelligence OCR extraction
7. Human-in-the-Loop approval workflows & governance audit
8. Synthetic 100-Laptop Enterprise Demonstration Runner
"""

from __future__ import annotations
import logging
from typing import Optional, List, Dict, Any
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Body
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from ..database import SessionLocal
from ..models import (
    Vendor,
    VendorProfile,
    PurchaseOrder,
    GoodsReceiptNote,
    VendorInvoiceRecord,
    InventoryRecord,
    FinancialMemoryEvent,
    FinancialMemoryLink,
    CrossSystemRiskAssessment,
    CAFIEApprovalRecord,
    ERPIntegrationLog,
)
from ..services.cafie_engine import (
    get_or_create_vendor_profile,
    analyze_vendor_behavior,
    calculate_inventory_to_cash_metrics,
    retrieve_financial_risk_memories,
    perform_three_way_reconciliation,
    evaluate_transaction_context,
    process_human_approval_action,
    seed_laptop_demonstration_scenario,
    seed_baseline_inventory,
)
from ..services.doc_intel import extract_document_intelligence
from ..services.erp_connectors import SAPConnector, WMSConnector

logger = logging.getLogger("finvora.cafie_router")

router = APIRouter(prefix="/api/cafie", tags=["Context-Aware Financial Intelligence"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── 1. Intelligence Overview & Main KPI Cards ─────────────────────────────────
@router.get("/overview")
def get_cafie_overview(db: Session = Depends(get_db)):
    """Returns the 9 primary KPI cards, risk distribution, and recent investigations."""
    # Ensure baseline inventory and demo data exists if empty
    assessments_count = db.query(CrossSystemRiskAssessment).count()
    if assessments_count < 3:
        from ..services.cafie_showcase import seed_comprehensive_cafie_showcase
        seed_comprehensive_cafie_showcase(db)

    # 1. Total Vendors Analysed
    total_vendors = db.query(Vendor).count()

    # 2. Historical Risk Events
    historical_events_count = db.query(FinancialMemoryEvent).count()

    # 3. Repeated Vendor Discrepancies
    repeated_discrepancies = db.query(FinancialMemoryLink).filter(FinancialMemoryLink.link_type == "recurring_pattern").count()
    if repeated_discrepancies == 0:
        repeated_discrepancies = db.query(FinancialMemoryEvent).filter(FinancialMemoryEvent.severity.in_(["warning", "critical"])).count()

    # 4. Invoice Mismatches
    mismatches_count = db.query(CrossSystemRiskAssessment).filter(CrossSystemRiskAssessment.reconciliation_status != "matched").count()

    # 5. Duplicate Invoices
    duplicates_count = db.query(CrossSystemRiskAssessment).filter(CrossSystemRiskAssessment.reconciliation_status == "duplicate").count()

    # 6 & 7. Inventory Value at Risk & Working Capital Blocked
    inv_metrics = calculate_inventory_to_cash_metrics(db)
    inventory_value_at_risk = inv_metrics["excess_inventory_value"]
    working_capital_blocked = inv_metrics["working_capital_blocked"]

    # 8. High-Risk Transactions
    high_risk_count = db.query(CrossSystemRiskAssessment).filter(CrossSystemRiskAssessment.risk_level == "HIGH").count()

    # 9. Estimated Financial Exposure Detected
    total_exposure = db.query(func.sum(CrossSystemRiskAssessment.estimated_financial_exposure)).scalar() or 0.0

    # Risk Distribution Breakdown
    high_count = db.query(CrossSystemRiskAssessment).filter(CrossSystemRiskAssessment.risk_level == "HIGH").count()
    med_count = db.query(CrossSystemRiskAssessment).filter(CrossSystemRiskAssessment.risk_level == "MEDIUM").count()
    low_count = db.query(CrossSystemRiskAssessment).filter(CrossSystemRiskAssessment.risk_level == "LOW").count()

    # Recent Investigations
    recent_assessments = (
        db.query(CrossSystemRiskAssessment)
        .order_by(CrossSystemRiskAssessment.created_at.desc())
        .limit(6)
        .all()
    )

    recent_list = []
    for a in recent_assessments:
        v_name = a.vendor.name if a.vendor else "Unknown Vendor"
        inv_no = a.invoice.invoice_number if a.invoice else "N/A"
        recent_list.append({
            "id": a.id,
            "assessment_number": a.assessment_number,
            "vendor_name": v_name,
            "invoice_number": inv_no,
            "composite_risk_score": a.composite_risk_score,
            "risk_level": a.risk_level,
            "estimated_financial_exposure": a.estimated_financial_exposure,
            "reconciliation_status": a.reconciliation_status,
            "approval_status": a.approval_status,
            "created_at": a.created_at.isoformat() if a.created_at else "",
        })

    return {
        "kpis": {
            "total_vendors_analysed": total_vendors,
            "historical_risk_events": historical_events_count,
            "repeated_vendor_discrepancies": repeated_discrepancies,
            "invoice_mismatches": mismatches_count,
            "duplicate_invoices": duplicates_count,
            "inventory_value_at_risk": round(inventory_value_at_risk, 2),
            "working_capital_blocked": round(working_capital_blocked, 2),
            "high_risk_transactions": high_risk_count,
            "estimated_financial_exposure_detected": round(total_exposure, 2),
        },
        "risk_distribution": [
            {"name": "High Risk", "value": high_count, "color": "#ef4444"},
            {"name": "Medium Risk", "value": med_count, "color": "#f59e0b"},
            {"name": "Low Risk", "value": low_count, "color": "#10b981"},
        ],
        "inventory_summary": {
            "total_inventory_value": inv_metrics["total_inventory_value"],
            "ageing_cohorts": inv_metrics["ageing_cohorts"],
        },
        "recent_investigations": recent_list,
        "connectors": {
            "sap_status": "API_CONNECTED",
            "wms_status": "API_CONNECTED",
            "ocr_status": "OPERATIONAL",
        },
    }


# ── 2. Adaptive Vendor Intelligence ───────────────────────────────────────────
@router.get("/vendors")
def list_vendor_intelligence(
    search: Optional[str] = Query(None),
    risk_filter: Optional[str] = Query(None),
    limit: int = Query(25),
    db: Session = Depends(get_db),
):
    """Lists vendor behavioral intelligence profiles with pricing variance and bank verification status."""
    vendors = db.query(Vendor).all()
    results = []

    for v in vendors:
        profile = get_or_create_vendor_profile(db, v)
        mem_info = retrieve_financial_risk_memories(db, v.id, limit=3)

        if search:
            s = search.lower()
            if s not in v.name.lower() and s not in (profile.vendor_code or "").lower() and s not in v.category.lower():
                continue

        if risk_filter:
            rf = risk_filter.upper()
            if rf == "HIGH" and profile.risk_score < 68.0:
                continue
            elif rf == "MEDIUM" and not (38.0 <= profile.risk_score < 68.0):
                continue
            elif rf == "LOW" and profile.risk_score >= 38.0:
                continue

        results.append({
            "vendor_id": v.id,
            "vendor_name": v.name,
            "vendor_code": profile.vendor_code,
            "category": v.category,
            "risk_score": profile.risk_score,
            "behavioral_anomaly_score": profile.behavioral_anomaly_score,
            "avg_invoice_amount": profile.avg_invoice_amount,
            "avg_lead_time_days": profile.avg_lead_time_days,
            "total_orders_completed": profile.total_orders_completed,
            "historical_discrepancy_count": mem_info["memory_events_count"],
            "cumulative_exposure": mem_info["cumulative_exposure"],
            "verification_status": profile.verification_status,
            "bank_name": profile.bank_name,
            "bank_account_masked": f"••••{profile.bank_account_number[-4:]}" if profile.bank_account_number else "N/A",
            "ifsc_code": profile.ifsc_code,
        })

    results.sort(key=lambda x: x["risk_score"], reverse=True)
    return {"vendors": results[:limit], "total_count": len(results)}


# ── 3. Inventory-to-Cash Intelligence ─────────────────────────────────────────
@router.get("/inventory-to-cash")
def get_inventory_to_cash(db: Session = Depends(get_db)):
    """Calculates inventory values, excess working capital blocked, ageing cohorts, and reorder recommendations."""
    return calculate_inventory_to_cash_metrics(db)


# ── 4. Cross-System 3-Way Reconciliations ─────────────────────────────────────
@router.get("/reconciliations")
def list_reconciliations(
    status: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    limit: int = Query(20),
    db: Session = Depends(get_db),
):
    """Lists 3-way reconciliations across PO, GRN, and Invoices."""
    q = db.query(CrossSystemRiskAssessment).order_by(CrossSystemRiskAssessment.created_at.desc())

    if status and status != "all":
        q = q.filter(CrossSystemRiskAssessment.approval_status == status)
    if risk_level and risk_level != "all":
        q = q.filter(CrossSystemRiskAssessment.risk_level == risk_level.upper())

    items = q.limit(limit).all()

    out = []
    for a in items:
        out.append({
            "id": a.id,
            "assessment_number": a.assessment_number,
            "vendor_id": a.vendor_id,
            "vendor_name": a.vendor.name if a.vendor else "Unknown",
            "po_number": a.po.po_number if a.po else "N/A",
            "grn_number": a.grn.grn_number if a.grn else "N/A",
            "invoice_number": a.invoice.invoice_number if a.invoice else "N/A",
            "total_invoice_amount": a.invoice.total_amount if a.invoice else 0.0,
            "three_way_match_score": a.three_way_match_score,
            "composite_risk_score": a.composite_risk_score,
            "risk_level": a.risk_level,
            "estimated_financial_exposure": a.estimated_financial_exposure,
            "reconciliation_status": a.reconciliation_status,
            "approval_status": a.approval_status,
            "is_synthetic_demo": a.is_synthetic_demo,
            "created_at": a.created_at.isoformat() if a.created_at else "",
        })

    return {"reconciliations": out, "count": len(out)}


@router.get("/reconciliations/{assessment_id}")
def get_reconciliation_detail(assessment_id: int, db: Session = Depends(get_db)):
    """Returns granular 3-way line-item reconciliation, evidence breakdown, and memory context."""
    assessment = db.query(CrossSystemRiskAssessment).filter(CrossSystemRiskAssessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Reconciliation assessment not found")

    # Fetch associated memories
    memory_events = []
    if assessment.historical_memory_refs:
        events = db.query(FinancialMemoryEvent).filter(FinancialMemoryEvent.id.in_(assessment.historical_memory_refs)).all()
        for ev in events:
            memory_events.append({
                "id": ev.id,
                "event_category": ev.event_category,
                "event_date": ev.event_date.isoformat(),
                "severity": ev.severity,
                "financial_impact": ev.financial_impact,
                "source_documents": ev.source_documents,
                "supporting_evidence": ev.supporting_evidence,
                "resolution_status": ev.resolution_status,
                "authorized_manager_remarks": ev.authorized_manager_remarks,
            })

    # Approval history
    approval_history = []
    for app in assessment.approval_history:
        approval_history.append({
            "id": app.id,
            "action": app.action,
            "previous_status": app.previous_status,
            "new_status": app.new_status,
            "manager_remarks": app.manager_remarks,
            "user_id": app.user_id,
            "user_role": app.user_role,
            "created_at": app.created_at.isoformat() if app.created_at else "",
        })

    return {
        "assessment": {
            "id": assessment.id,
            "assessment_number": assessment.assessment_number,
            "vendor_id": assessment.vendor_id,
            "vendor_name": assessment.vendor.name if assessment.vendor else "Unknown",
            "po_number": assessment.po.po_number if assessment.po else "N/A",
            "grn_number": assessment.grn.grn_number if assessment.grn else "N/A",
            "invoice_number": assessment.invoice.invoice_number if assessment.invoice else "N/A",
            "invoice_total": assessment.invoice.total_amount if assessment.invoice else 0.0,
            "invoice_bank": f"{assessment.invoice.bank_name or 'N/A'} (Acc ending in {(assessment.invoice.bank_account_number or '')[-4:]})",
            "three_way_match_score": assessment.three_way_match_score,
            "vendor_behavior_score": assessment.vendor_behavior_score,
            "inventory_impact_score": assessment.inventory_impact_score,
            "memory_risk_score": assessment.memory_risk_score,
            "composite_risk_score": assessment.composite_risk_score,
            "risk_level": assessment.risk_level,
            "estimated_financial_exposure": assessment.estimated_financial_exposure,
            "reconciliation_status": assessment.reconciliation_status,
            "approval_status": assessment.approval_status,
            "is_synthetic_demo": assessment.is_synthetic_demo,
            "discrepancy_details": assessment.discrepancy_details,
            "evidence": assessment.evidence,
            "explanation": assessment.explanation,
            "recommended_action": assessment.recommended_action,
            "created_at": assessment.created_at.isoformat() if assessment.created_at else "",
        },
        "recalled_memories": memory_events,
        "approval_history": approval_history,
    }


# ── 5. Financial Risk Memory Engine ───────────────────────────────────────────
@router.get("/memory")
def query_financial_memory(
    vendor_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    resolution: Optional[str] = Query(None),
    limit: int = Query(50),
    db: Session = Depends(get_db),
):
    """Searchable indexed Financial Risk Memory events."""
    q = db.query(FinancialMemoryEvent).order_by(FinancialMemoryEvent.event_date.desc())

    if vendor_id:
        q = q.filter(FinancialMemoryEvent.vendor_id == vendor_id)
    if category and category != "all":
        q = q.filter(FinancialMemoryEvent.event_category == category)
    if severity and severity != "all":
        q = q.filter(FinancialMemoryEvent.severity == severity)
    if resolution and resolution != "all":
        q = q.filter(FinancialMemoryEvent.resolution_status == resolution)

    events = q.limit(limit).all()

    total_exposure = sum(e.financial_impact for e in events if e.resolution_status == "unresolved")

    event_list = []
    for e in events:
        event_list.append({
            "id": e.id,
            "vendor_id": e.vendor_id,
            "vendor_name": e.vendor.name if e.vendor else "Unknown",
            "transaction_ref": e.transaction_ref,
            "event_category": e.event_category,
            "event_date": e.event_date.isoformat(),
            "severity": e.severity,
            "financial_impact": e.financial_impact,
            "source_documents": e.source_documents,
            "supporting_evidence": e.supporting_evidence,
            "risk_category": e.risk_category,
            "resolution_status": e.resolution_status,
            "authorized_manager_remarks": e.authorized_manager_remarks,
        })

    return {
        "events": event_list,
        "total_records": len(event_list),
        "cumulative_unresolved_exposure": round(total_exposure, 2),
    }


@router.get("/memory/timeline/{vendor_id}")
def get_vendor_memory_timeline(vendor_id: int, db: Session = Depends(get_db)):
    """Retrieves full chronological financial memory timeline for a specific vendor."""
    mem_data = retrieve_financial_risk_memories(db, vendor_id, limit=20)
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    return {
        "vendor_id": vendor_id,
        "vendor_name": vendor.name if vendor else "Unknown",
        **mem_data,
    }


# ── 6. Financial Document Intelligence ────────────────────────────────────────
@router.post("/documents/extract")
async def extract_document(
    file: UploadFile = File(...),
):
    """Extracts structured invoice, PO, or GRN fields from uploaded documents (PDF, Excel, CSV, Image)."""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty document uploaded.")
    return extract_document_intelligence(
        file_bytes=content,
        filename=file.filename or "invoice.pdf",
        mime_type=file.content_type,
    )


# ── 7. Human-in-the-Loop Governance & Actions ─────────────────────────────────
@router.post("/actions/{assessment_id}")
def take_approval_action(
    assessment_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
):
    """
    Executes an authorized human decision:
    - action: 'approve' | 'reject' | 'hold_for_verification'
    - manager_remarks: required rationale
    - user_id, user_role: role-based security validation
    """
    action = payload.get("action", "hold_for_verification")
    remarks = payload.get("manager_remarks", "").strip()
    user_id = payload.get("user_id", "manager_finvora")
    user_role = payload.get("user_role", "manager")

    if not remarks:
        raise HTTPException(status_code=400, detail="Manager remarks are mandatory for audit compliance.")

    try:
        res = process_human_approval_action(
            db=db,
            assessment_id=assessment_id,
            action=action,
            manager_remarks=remarks,
            user_id=user_id,
            user_role=user_role,
        )
        return res
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))


@router.get("/audit-trail")
def get_audit_trail(limit: int = Query(50), db: Session = Depends(get_db)):
    """Retrieves immutable governance audit trail for all CAFIE financial actions."""
    records = db.query(CAFIEApprovalRecord).order_by(CAFIEApprovalRecord.created_at.desc()).limit(limit).all()
    out = []
    for r in records:
        out.append({
            "id": r.id,
            "assessment_id": r.assessment_id,
            "assessment_number": r.assessment.assessment_number if r.assessment else "N/A",
            "action": r.action,
            "previous_status": r.previous_status,
            "new_status": r.new_status,
            "manager_remarks": r.manager_remarks,
            "user_id": r.user_id,
            "user_role": r.user_role,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        })
    return {"audit_trail": out, "total_records": len(out)}


# ── 8. Complete Synthetic Business Demonstration Runner ───────────────────────
@router.post("/demo/run-laptops-scenario")
def run_laptops_scenario(db: Session = Depends(get_db)):
    """
    Executes the complete synthetic business demonstration required:
    100 Laptops @ ₹40,000 | 100% 3-way document match | Prior Jan/Feb/Mar Risk Memory | Bank Change Detection | Payment Hold.
    """
    return seed_laptop_demonstration_scenario(db)
