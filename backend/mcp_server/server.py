"""FINVORA Model Context Protocol (MCP) Server.

Architecture:
  FINVORA MCP server (read-only tools)
    <- MCP client inside FastAPI backend
    <- Sarvam chat model with function calling as agent's brain.

Transports:
  - Default: stdio (for local subprocess or Render deployment)
  - Optional: streamable-http (--http flag, with bearer token protection)
"""

import sys
import os
import io
import re
import wave
import base64
import logging
import argparse
from datetime import date, timedelta
from typing import Optional, List, Dict, Any

import pathlib
from dotenv import load_dotenv

# Ensure backend root is on sys.path
_current_dir = pathlib.Path(__file__).resolve().parent
_backend_dir = _current_dir.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

# Load environment
load_dotenv(_backend_dir / ".env")
load_dotenv()

from sqlalchemy import func
from sqlalchemy.orm import joinedload
from mcp.server.fastmcp import FastMCP

from app.database import SessionLocal
from app.models import Account, Transaction, RiskAlert, DepartmentBudget, Invoice, Vendor
from app.services.sarvam_client import (
    call_sarvam_stt,
    call_sarvam_tts,
    get_sarvam_api_key,
)

logger = logging.getLogger("finvora.mcp")

# Initialize FastMCP Server named "finvora"
mcp = FastMCP("finvora")


# ── Money Formatter ───────────────────────────────────────────────────────────
def format_inr(amount: Optional[float]) -> str:
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


def clean_text_for_speech(raw: str, max_chars: int = 2500) -> str:
    """Strips markdown and emojis, formats currency, truncates under char limit."""
    if not raw:
        return ""
    text = re.sub(r"https?://\S+", "", raw)
    text = re.sub(r"#{1,6}\s*", "", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"[`~_]", "", text)
    text = re.sub(r"^\s*[•\-\*]\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"[\U00010000-\U0010ffff]", "", text)
    text = text.replace("₹", "Rupees ")
    text = re.sub(r"\s+", " ", text).strip()

    if len(text) > max_chars:
        truncated = text[:max_chars]
        last_punct = max(
            truncated.rfind(". "),
            truncated.rfind("। "),
            truncated.rfind("? "),
            truncated.rfind("! "),
        )
        if last_punct > 100:
            text = truncated[: last_punct + 1].strip()
        else:
            text = truncated.strip()

    return text


# ── Tool 1: get_dashboard_summary ─────────────────────────────────────────────
@mcp.tool()
def get_dashboard_summary() -> Dict[str, Any]:
    """Retrieve high-level financial summary KPIs for the enterprise.

    Returns:
        total_balance: Total liquid balance across all connected bank and operating accounts (formatted in ₹).
        monthly_inflow: Cash inflow recorded for the current month (formatted in ₹).
        monthly_outflow: Cash outflow recorded for the current month (formatted in ₹).
        open_risk_count: Count of active open risk alerts requiring review.
        budget_health_pct: Percentage of enterprise departments operating within allocated budget.
    """
    db = SessionLocal()
    try:
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
            "total_balance": format_inr(total_balance),
            "monthly_inflow": format_inr(monthly_inflow),
            "monthly_outflow": format_inr(monthly_outflow),
            "open_risk_count": open_risk_count,
            "budget_health_pct": f"{budget_health_pct}%",
        }
    finally:
        db.close()


# ── Tool 2: list_risk_alerts ──────────────────────────────────────────────────
@mcp.tool()
def list_risk_alerts(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 10,
) -> Dict[str, Any]:
    """List risk alerts and financial anomalies detected by FINVORA ML heuristics.

    Args:
        status: Filter by alert status ('open', 'under_review', 'held', 'resolved', 'dismissed').
        severity: Filter by severity level ('critical', 'warning', 'info').
        limit: Maximum number of alerts to return (capped at 10).
    """
    safe_limit = max(1, min(limit or 10, 10))
    db = SessionLocal()
    try:
        query = db.query(RiskAlert).options(joinedload(RiskAlert.vendor))

        if status and status.lower() != "all":
            query = query.filter(RiskAlert.status == status.lower().strip())

        if severity and severity.lower() != "all":
            query = query.filter(RiskAlert.severity == severity.lower().strip())

        alerts = (
            query.order_by(RiskAlert.confidence_score.desc(), RiskAlert.amount.desc())
            .limit(safe_limit)
            .all()
        )

        results = []
        for a in alerts:
            vendor_name = a.vendor.name if a.vendor else "Unknown Vendor"
            results.append({
                "alert_id": a.id,
                "title": a.title,
                "risk_type": a.risk_type,
                "severity": a.severity,
                "amount": format_inr(a.amount),
                "confidence_score": f"{a.confidence_score:.1f}%",
                "status": a.status,
                "vendor_name": vendor_name,
                "recommended_action": a.recommended_action or "Investigate",
            })
        return {"alerts": results, "count": len(results)}
    finally:
        db.close()


# ── Tool 3: get_risk_alert ────────────────────────────────────────────────────
@mcp.tool()
def get_risk_alert(alert_id: int) -> Dict[str, Any]:
    """Get full details, evidence, supporting records, and recommended actions for a specific risk alert.

    Args:
        alert_id: The numeric ID of the risk alert to retrieve (e.g. 101, 102).
    """
    db = SessionLocal()
    try:
        alert = (
            db.query(RiskAlert)
            .options(joinedload(RiskAlert.vendor), joinedload(RiskAlert.transaction))
            .filter(RiskAlert.id == alert_id)
            .first()
        )
        if not alert:
            return {"error": f"Risk alert #{alert_id} was not found in FINVORA records."}

        vendor_name = alert.vendor.name if alert.vendor else "Unknown Vendor"
        return {
            "alert_id": alert.id,
            "title": alert.title,
            "risk_type": alert.risk_type,
            "severity": alert.severity,
            "amount": format_inr(alert.amount),
            "estimated_exposure": format_inr(alert.estimated_exposure),
            "status": alert.status,
            "confidence_score": f"{alert.confidence_score:.1f}%",
            "rule_triggered": alert.rule_triggered,
            "vendor_name": vendor_name,
            "recommended_action": alert.recommended_action or "Investigate and verify before releasing payment",
            "evidence": alert.evidence or [],
            "supporting_records": alert.supporting_records or [],
            "detected_at": str(alert.detected_at),
        }
    finally:
        db.close()


# ── Tool 4: get_cash_forecast ─────────────────────────────────────────────────
@mcp.tool()
def get_cash_forecast(horizon_days: int = 30) -> Dict[str, Any]:
    """Get stored baseline treasury cash forecast and liquidity buffer status.

    Note: This returns stored baseline projections and upcoming liabilities.
    It is NOT an ad-hoc simulation.

    Args:
        horizon_days: Forecast horizon in days (must be 30, 60, or 90).
    """
    if horizon_days not in (30, 60, 90):
        horizon_days = 30

    db = SessionLocal()
    try:
        min_buffer = float(os.getenv("MIN_CASH_BUFFER", "10000000.0"))
        current_cash = db.query(func.coalesce(func.sum(Account.balance), 0.0)).scalar() or 0.0

        today = date.today()
        d30_ago = today - timedelta(days=30)
        recent_txs = db.query(Transaction.amount, Transaction.direction).filter(Transaction.date >= d30_ago).all()
        net_30d = sum(t.amount if t.direction == "inflow" else -t.amount for t in recent_txs)
        daily_velocity = net_30d / 30.0 if recent_txs else 0.0

        projected_closing = current_cash + (daily_velocity * horizon_days)

        target_date = today + timedelta(days=horizon_days)
        due_liabilities = (
            db.query(func.coalesce(func.sum(Invoice.amount), 0.0))
            .filter(
                Invoice.status.in_(["pending", "overdue"]),
                Invoice.due_date <= target_date,
            )
            .scalar()
            or 0.0
        )

        buffer_status = "SAFE" if projected_closing >= min_buffer else "WATCH / AT RISK"

        return {
            "horizon_days": horizon_days,
            "current_liquid_balance": format_inr(current_cash),
            "projected_closing_cash": format_inr(projected_closing),
            "minimum_safe_buffer": format_inr(min_buffer),
            "buffer_status": buffer_status,
            "upcoming_liabilities": format_inr(due_liabilities),
            "daily_net_velocity": format_inr(daily_velocity),
        }
    finally:
        db.close()


# ── Tool 5: get_budget_status ─────────────────────────────────────────────────
@mcp.tool()
def get_budget_status(department: Optional[str] = None) -> Dict[str, Any]:
    """Get budget vs actual spend tracking for enterprise departments.

    Args:
        department: Optional department name filter (e.g. 'Marketing', 'Engineering', 'Sales').
    """
    db = SessionLocal()
    try:
        query = db.query(DepartmentBudget)
        if department and department.strip():
            query = query.filter(DepartmentBudget.department.ilike(f"%{department.strip()}%"))

        budgets = query.order_by(DepartmentBudget.variance_amount.desc()).all()
        results = []
        for b in budgets:
            flag = "OVER BUDGET" if b.is_unfavorable or b.status == "over_budget" else ("AT RISK" if b.status == "at_risk" else "ON TRACK")
            results.append({
                "department": b.department,
                "allocated": format_inr(b.allocated),
                "spent": format_inr(b.spent),
                "variance_amount": format_inr(b.variance_amount),
                "variance_percentage": f"{b.variance_percentage:.1f}%",
                "status": flag,
                "is_unfavorable": b.is_unfavorable,
                "head_of_department": b.head_of_department,
            })
        return {"budgets": results, "count": len(results)}
    finally:
        db.close()


# ── Tool 6: explain_app_feature ───────────────────────────────────────────────
@mcp.tool()
def explain_app_feature(topic: str) -> Dict[str, str]:
    """Explain FINVORA pages, features, navigation, and system guidelines.

    Args:
        topic: The feature or page name (e.g. 'overview', 'financial_data', 'risk_anomalies',
               'cash_flow', 'ap_expenses', 'budget_intelligence', 'what_if', 'decisions_approvals').
    """
    t = (topic or "").lower().replace("-", "_").strip()

    help_catalog = {
        "overview": (
            "The Overview page (/) provides an executive cockpit of enterprise treasury health. "
            "It displays current liquid balance, monthly inflow/outflow velocity, top critical anomalies, "
            "and department budget health at a glance."
        ),
        "financial_data": (
            "The Financial Data page (/financial-data) is the unified general ledger and bank record repository. "
            "It consolidates invoices, accounts, and bank feeds from Tally Prime, Zoho Books, and corporate bank portals."
        ),
        "risk_anomalies": (
            "The Risk & Anomalies page (/risk-anomalies) houses the Risk Radar. It utilizes ML heuristics to detect "
            "duplicate vendor invoices, unusual transaction spikes, and vendor anomalies with confidence scores and evidence."
        ),
        "cash_flow": (
            "The Cash Flow & Forecasting page (/cash-flow) tracks liquidity across 30, 60, and 90-day horizons. "
            "It highlights burn velocity and compares projected cash against the statutory minimum buffer threshold."
        ),
        "ap_expenses": (
            "The AP & Expenses page (/ap-expenses) manages the Accounts Payable queue. "
            "It prioritizes pending invoices, flags overdue obligations, and organizes payment batches."
        ),
        "budget_intelligence": (
            "The Budget Intelligence page (/budget-intelligence) monitors departmental allocations vs actual expenditures. "
            "It highlights unfavorable variances, category overspends, and identifies department budget leads."
        ),
        "what_if": (
            "The What-If Simulator (/what-if) is an interactive scenario sandbox where CFOs and finance leaders "
            "can model hypothetical payment delays, revenue drops, or extra expenses to stress-test cash runway."
        ),
        "decisions_approvals": (
            "The Decisions & Approvals page (/decisions-approvals) is FINVORA's governance hub. "
            "Authorized decision-makers can review flagged transactions, enforce payment holds, approve items, or dismiss alerts."
        ),
        "data_connections": (
            "The Data Connections page (/data-connections) configures and monitors API integrations with "
            "Tally Prime, Zoho Books, RazorpayX, and banking APIs."
        ),
        "ask_finvora": (
            "Ask FINVORA is a bilingual conversational and voice AI assistant powered by Sarvam AI and FastMCP. "
            "It is strictly read-only and queries live enterprise data through verified MCP tools."
        ),
    }

    # Best match lookup
    matched_key = None
    for k in help_catalog:
        if k in t or t in k:
            matched_key = k
            break

    if matched_key:
        return {"topic": matched_key, "explanation": help_catalog[matched_key]}

    return {
        "topic": topic,
        "explanation": (
            "FINVORA is an AI-powered financial intelligence platform with pages for Overview (/), "
            "Financial Data (/financial-data), Risk & Anomalies (/risk-anomalies), Cash Flow (/cash-flow), "
            "AP & Expenses (/ap-expenses), Budget Intelligence (/budget-intelligence), What-If Simulator (/what-if), "
            "and Decisions & Approvals (/decisions-approvals)."
        ),
    }


# ── Tool 7: transcribe_speech ─────────────────────────────────────────────────
@mcp.tool()
async def transcribe_speech(
    audio_base64: str,
    mime: str = "audio/webm",
    language_hint: Optional[str] = "auto",
) -> Dict[str, Any]:
    """Transcribe user voice audio to text using Sarvam Saaras model in codemix mode.

    Audio is processed directly in memory via Sarvam REST STT and never stored on disk.
    Accepts base64 encoded audio under 30 seconds.

    Args:
        audio_base64: Base64-encoded audio bytes.
        mime: Audio MIME type (e.g. 'audio/webm', 'audio/wav', 'audio/mp3').
        language_hint: Optional language hint ('auto', 'en-IN', 'hi-IN').
    """
    if not audio_base64:
        return {"error": "Missing audio_base64 data."}

    try:
        audio_bytes = base64.b64decode(audio_base64)
    except Exception as exc:
        return {"error": f"Failed to decode base64 audio: {str(exc)}"}

    if len(audio_bytes) > 10 * 1024 * 1024:
        return {"error": "Audio file size exceeds 10MB limit."}

    # Duration check for WAV headers
    if audio_bytes.startswith(b"RIFF") or "wav" in mime:
        try:
            with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
                frames = wf.getnframes()
                rate = wf.getframerate()
                if rate > 0:
                    dur = frames / float(rate)
                    if dur > 30.5:
                        return {"error": f"Recording duration ({dur:.1f}s) exceeds the 30-second Sarvam limit."}
        except Exception:
            pass

    filename = "voice.webm" if "webm" in mime else "voice.wav"

    try:
        res = await call_sarvam_stt(
            audio_bytes=audio_bytes,
            filename=filename,
            mime_type=mime,
            language_hint=language_hint or "auto",
        )
        return {
            "transcript": res.get("transcript", ""),
            "language_code": res.get("language_code", "en-IN"),
        }
    except Exception as exc:
        logger.warning("Sarvam STT failed in MCP tool: %s", exc)
        return {"error": f"Speech transcription failed: {str(exc)}"}


# ── Tool 8: synthesize_speech ─────────────────────────────────────────────────
@mcp.tool()
async def synthesize_speech(
    text: str,
    language: str = "en-IN",
) -> Dict[str, Any]:
    """Synthesize clean text into spoken audio using Sarvam Bulbul model.

    Text is automatically stripped of markdown, links, and emojis before synthesis.
    Audio is returned as base64 and never written to disk.

    Args:
        text: Text to synthesize into speech (under 2500 characters).
        language: Language code ('en-IN' or 'hi-IN').
    """
    clean_text = clean_text_for_speech(text, max_chars=2500)
    if not clean_text:
        return {"error": "No readable text available for speech synthesis."}

    target_lang = "hi-IN" if language in ("hi-IN", "hi") else "en-IN"

    try:
        res = await call_sarvam_tts(clean_text, language_code=target_lang)
        return {
            "audio_base64": res.get("audio_base64", ""),
            "mime": res.get("mime", "audio/wav"),
        }
    except Exception as exc:
        logger.warning("Sarvam TTS failed in MCP tool: %s", exc)
        return {"error": f"Speech synthesis failed: {str(exc)}"}


# ── Server Runner ─────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="FINVORA FastMCP Server")
    parser.add_argument("--http", action="store_true", help="Run with streamable-http transport instead of stdio")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind for HTTP mode")
    parser.add_argument("--port", type=int, default=8001, help="Port to bind for HTTP mode")
    args = parser.parse_args()

    if args.http:
        import uvicorn
        from starlette.middleware.base import BaseHTTPMiddleware
        from starlette.responses import JSONResponse

        app = mcp.streamable_http_app()

        class BearerAuthMiddleware(BaseHTTPMiddleware):
            async def dispatch(self, request, call_next):
                expected_token = os.environ.get("MCP_SERVER_TOKEN", "").strip()
                if expected_token:
                    auth = request.headers.get("authorization", "")
                    if not auth.startswith("Bearer ") or auth[7:].strip() != expected_token:
                        return JSONResponse({"error": "Unauthorized: Invalid or missing bearer token"}, status_code=401)
                return await call_next(request)

        app.add_middleware(BearerAuthMiddleware)
        print(f"Starting FINVORA MCP server (streamable-http) on http://{args.host}:{args.port}")
        uvicorn.run(app, host=args.host, port=args.port)
    else:
        # Default: stdio
        mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
