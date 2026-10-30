import os
import re
from datetime import date, timedelta
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from ..models import Account, Transaction, RiskAlert, DepartmentBudget, Invoice, Vendor


def format_inr(amount: float) -> str:
    """Format numeric amount into standard Indian currency format (e.g. ₹6,80,000)."""
    if amount is None:
        return "₹0"
    is_neg = amount < 0
    val_int = int(round(abs(amount)))
    s = str(val_int)
    if len(s) <= 3:
        formatted = s
    else:
        last3 = s[-3:]
        remaining = s[:-3]
        groups = []
        while len(remaining) > 2:
            groups.insert(0, remaining[-2:])
            remaining = remaining[:-2]
        if remaining:
            groups.insert(0, remaining)
        formatted = ",".join(groups) + "," + last3
    prefix = "-₹" if is_neg else "₹"
    return f"{prefix}{formatted}"


def classify_intent(message: str) -> List[str]:
    """Classifies user query into relevant finance and system intents."""
    msg = message.lower()
    intents = []

    # Check for what-if scenarios
    if any(k in msg for k in ["what if", "what-if", "suppose", "if we delay", "hypothetical", "simulate", "simulation", "scenario"]):
        intents.append("what_if")

    # Risks & Alerts
    if any(k in msg for k in ["risk", "alert", "anomal", "flag", "critical", "warning", "exposure", "investigat", "unusual", "duplicate", "spike", "fraud", "review"]):
        intents.append("risks")

    # Cash flow & Forecast
    if any(k in msg for k in ["cash", "forecast", "flow", "buffer", "shortfall", "runway", "balance", "closing", "liquidity", "inflow", "outflow", "projection", "30 day", "60 day", "90 day"]):
        intents.append("cash_flow")

    # Budget & Departments
    if any(k in msg for k in ["budget", "department", "spend", "allocated", "variance", "over budget", "marketing", "engineering", "sales", "operations", "hr", "it"]):
        intents.append("budget")

    # Vendors
    if any(k in msg for k in ["vendor", "supplier", "onboard", "merchant", "procurement", "partner"]):
        intents.append("vendors")

    # Invoices
    if any(k in msg for k in ["invoice", "payable", "ap", "due date", "overdue", "bill", "payout"]):
        intents.append("invoices")

    # App Navigation / How to use
    if any(k in msg for k in ["how to", "how do i", "where is", "help", "feature", "navigate", "page", "approve", "dismiss", "role"]):
        intents.append("how_to_use")

    if not intents:
        intents.append("general")

    return intents


def get_dashboard_summary(db: Session) -> Dict[str, Any]:
    """Retrieve current enterprise dashboard metrics."""
    total_balance = db.query(func.coalesce(func.sum(Account.balance), 0.0)).scalar() or 0.0

    today = date.today()
    month_start = today.replace(day=1)
    month_end = today

    monthly_inflow = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0.0))
        .filter(
            Transaction.direction == "inflow",
            Transaction.date >= month_start,
            Transaction.date <= month_end,
        )
        .scalar()
        or 0.0
    )

    monthly_outflow = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0.0))
        .filter(
            Transaction.direction == "outflow",
            Transaction.date >= month_start,
            Transaction.date <= month_end,
        )
        .scalar()
        or 0.0
    )

    open_risk_count = (
        db.query(func.count(RiskAlert.id)).filter(RiskAlert.status == "open").scalar() or 0
    )

    dept_budgets = db.query(DepartmentBudget).all()
    if dept_budgets:
        ok = sum(1 for b in dept_budgets if b.spent <= b.allocated)
        budget_health_pct = round(ok / len(dept_budgets) * 100, 1)
    else:
        budget_health_pct = 100.0

    return {
        "total_balance": total_balance,
        "monthly_inflow": monthly_inflow,
        "monthly_outflow": monthly_outflow,
        "open_risk_count": open_risk_count,
        "budget_health_pct": budget_health_pct,
    }


def build_grounded_context(db: Session, message: str) -> Tuple[str, List[str]]:
    """
    Constructs a compact, factual grounding context capped at ~3,000 tokens (~12,000 characters).
    Always includes dashboard KPIs. Pulls relevant domain records based on query intent.
    Returns (context_string, sources_list).
    """
    intents = classify_intent(message)
    sources: List[str] = ["Dashboard Summary"]

    dash = get_dashboard_summary(db)
    context_sections = [
        "### Enterprise Financial Summary:",
        f"- Total Liquid Balance: {format_inr(dash['total_balance'])}",
        f"- Current Month Inflow: {format_inr(dash['monthly_inflow'])}",
        f"- Current Month Outflow: {format_inr(dash['monthly_outflow'])}",
        f"- Open Risk Alerts Count: {dash['open_risk_count']}",
        f"- Budget Health: {dash['budget_health_pct']}% of departments within allocated budget",
    ]

    # Special note for What-If scenario questions
    if "what_if" in intents:
        context_sections.append(
            "\n### SCENARIO SIMULATION POLICY:\n"
            "FINVORA assistant is strictly read-only and DOES NOT calculate what-if forecasts or compute simulation numbers. "
            "For what-if questions, summarize the financial mechanism briefly and direct the user to the dedicated 'What-If Simulator' page (/what-if) to run interactive scenarios. Never guess or invent projected figures."
        )
        sources.append("What-If Simulator Policy")

    # Risks & Alerts: Top 8 open alerts sorted by confidence score
    if "risks" in intents or "general" in intents:
        open_alerts = (
            db.query(RiskAlert)
            .options(joinedload(RiskAlert.vendor))
            .filter(RiskAlert.status == "open")
            .order_by(RiskAlert.confidence_score.desc(), RiskAlert.amount.desc())
            .limit(8)
            .all()
        )
        if open_alerts:
            sources.append("Risk Alerts Database (Top Open)")
            context_sections.append("\n### Top Open Risk Alerts (by Confidence Score):")
            for alert in open_alerts:
                vendor_name = alert.vendor.name if alert.vendor else "Unknown Vendor"
                context_sections.append(
                    f"- Alert #{alert.id}: '{alert.title}' | Type: {alert.risk_type} | Severity: {alert.severity} "
                    f"| Vendor: {vendor_name} | Amount: {format_inr(alert.amount)} | Confidence: {alert.confidence_score}% "
                    f"| Status: {alert.status} | Action: {alert.recommended_action or 'Investigate'}"
                )

    # Cash Flow & Forecasting
    if "cash_flow" in intents or "general" in intents:
        sources.append("Treasury & Cash Forecast")
        min_buffer = float(os.getenv("MIN_CASH_BUFFER", "10000000.0"))
        
        # Calculate recent 30-day net velocity
        today = date.today()
        d30_ago = today - timedelta(days=30)
        recent_txs = db.query(Transaction.amount, Transaction.direction).filter(Transaction.date >= d30_ago).all()
        net_30d = sum(t.amount if t.direction == "inflow" else -t.amount for t in recent_txs)
        daily_burn_or_gain = net_30d / 30.0 if recent_txs else 0.0

        current_cash = dash["total_balance"]
        proj_30 = current_cash + (daily_burn_orgain := daily_burn_or_gain * 30)
        proj_60 = current_cash + (daily_burn_or_gain * 60)
        proj_90 = current_cash + (daily_burn_or_gain * 90)

        # Pending liabilities
        due_30 = (
            db.query(func.coalesce(func.sum(Invoice.amount), 0.0))
            .filter(Invoice.status.in_(["pending", "overdue"]), Invoice.due_date <= today + timedelta(days=30))
            .scalar() or 0.0
        )
        due_60 = (
            db.query(func.coalesce(func.sum(Invoice.amount), 0.0))
            .filter(Invoice.status.in_(["pending", "overdue"]), Invoice.due_date <= today + timedelta(days=60))
            .scalar() or 0.0
        )

        context_sections.append("\n### Cash Flow & Forecast Horizons:")
        context_sections.append(f"- Minimum Safe Cash Buffer: {format_inr(min_buffer)}")
        context_sections.append(f"- Current Balance: {format_inr(current_cash)}")
        context_sections.append(f"- 30-Day Projected Closing Cash: ~{format_inr(proj_30)} (Upcoming liabilities: {format_inr(due_30)})")
        context_sections.append(f"- 60-Day Projected Closing Cash: ~{format_inr(proj_60)} (Upcoming liabilities: {format_inr(due_60)})")
        context_sections.append(f"- 90-Day Projected Closing Cash: ~{format_inr(proj_90)}")
        context_sections.append(f"- Forecast Buffer Status: {'SAFE' if proj_30 >= min_buffer else 'WATCH / AT RISK'}")

    # Budget & Department Data
    if "budget" in intents or "general" in intents:
        sources.append("Department Budgets")
        dept_budgets = db.query(DepartmentBudget).all()
        if dept_budgets:
            context_sections.append("\n### Department Budgets Status:")
            for b in dept_budgets:
                flag = "OVER BUDGET" if b.is_unfavorable or b.status == "over_budget" else ("AT RISK" if b.status == "at_risk" else "ON TRACK")
                context_sections.append(
                    f"- {b.department}: Allocated {format_inr(b.allocated)} | Spent {format_inr(b.spent)} "
                    f"| Variance: {format_inr(b.variance_amount)} ({b.variance_percentage:.1f}%) | Status: {flag} | Lead: {b.head_of_department}"
                )

    # Invoices & Vendors
    if "invoices" in intents or "vendors" in intents:
        sources.append("Invoices & Vendors Registry")
        pending_invoices = (
            db.query(Invoice)
            .options(joinedload(Invoice.vendor))
            .filter(Invoice.status.in_(["pending", "overdue"]))
            .order_by(Invoice.due_date.asc())
            .limit(6)
            .all()
        )
        if pending_invoices:
            context_sections.append("\n### Priority Invoices Pending/Overdue:")
            for inv in pending_invoices:
                vname = inv.vendor.name if inv.vendor else "Unknown"
                context_sections.append(
                    f"- Inv #{inv.invoice_number}: Vendor: {vname} | Amount: {format_inr(inv.amount)} "
                    f"| Due Date: {inv.due_date} | Status: {inv.status}"
                )

    # App Navigation / How to use instructions
    if "how_to_use" in intents:
        sources.append("App Feature Index")
        context_sections.append(
            "\n### FINVORA Navigation & Operating Guide:\n"
            "- Overview (/): High-level treasury balance, quick KPI metrics, recent activity.\n"
            "- Financial Data (/financial-data): Invoices, accounts, ledgers from Tally/Zoho/Bank.\n"
            "- Risk & Anomalies (/risk-anomalies): Risk Radar with duplicate invoices, unusual spikes, and hold recommendations.\n"
            "- Cash Flow & Forecasting (/cash-flow): 30/60/90-day cash curve, burn rate, and runway predictions.\n"
            "- Budget Intelligence (/budget-intelligence): Department allocations, variance tracking, and expense categories.\n"
            "- What-If Simulator (/what-if): Interactive sandbox to model payment delays and additional expenses.\n"
            "- Decisions & Approvals (/decisions-approvals): Review, approve, or dismiss flagged transactions and proposals.\n"
            "- Note: As an assistant, I cannot approve, dismiss, pay, or edit records directly. Please use the relevant page above."
        )

    # Assemble and cap context at ~12,000 characters (~3,000 tokens)
    full_context = "\n".join(context_sections)
    if len(full_context) > 12000:
        full_context = full_context[:12000] + "\n...[Context capped for token limit]"

    # Deduplicate sources preserving order
    unique_sources = list(dict.fromkeys(sources))
    return full_context, unique_sources
