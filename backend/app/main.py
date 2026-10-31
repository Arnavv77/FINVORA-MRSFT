import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pathlib
from dotenv import load_dotenv

_backend_dir = pathlib.Path(__file__).resolve().parent.parent
load_dotenv(_backend_dir / '.env')
load_dotenv(_backend_dir.parent / '.env')
load_dotenv()

from .database import engine, Base
from .routers import (
    dashboard_router,
    transactions_router,
    risks_router,
    forecast_router,
    simulate_router,
    budget_router,
    copilot_router,
    ask_router,
    cafie_router,
)

# ── Create tables (idempotent; use Alembic for production migrations) ─────────
Base.metadata.create_all(bind=engine)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="FINVORA API",
    description="AI-powered Financial Intelligence & Decision Support — hackathon build",
    version="1.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000")
allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
origin_regex = os.getenv("ALLOWED_ORIGIN_REGEX", r"^https://.*(\.vercel\.app|\.netlify\.app)$")

has_wildcard = "*" in allowed_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if has_wildcard else allowed_origins,
    allow_origin_regex=None if has_wildcard else (origin_regex if origin_regex else None),
    allow_credentials=not has_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(dashboard_router)
app.include_router(transactions_router)
app.include_router(risks_router)
app.include_router(forecast_router)
app.include_router(simulate_router)
app.include_router(budget_router)
app.include_router(copilot_router)
app.include_router(ask_router)
app.include_router(cafie_router)
from .cafie.model3.router import router as cafie_model3_router
app.include_router(cafie_model3_router)
from .cafie.model4.router import router as cafie_model4_router
app.include_router(cafie_model4_router)

# ── IDP Multi-Mode Payment Intelligence & Automated Reconciliation ────────────
from .idp.payment_intelligence.models import (
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
from .idp.payment_intelligence.router import router as idp_payment_router
app.include_router(idp_payment_router)

# ── Company Ledger & Manager Approval Workflow ────────────────────────────────
from .company_ledger.models import (
    LedgerCompany,
    LedgerAccount,
    LedgerTransaction,
    LedgerEntryLine,
    LedgerTransactionApproval,
    LedgerAuditLog,
    LedgerTransactionComment,
)
from .company_ledger.router import router as company_ledger_router
app.include_router(company_ledger_router)
Base.metadata.create_all(bind=engine)




# ── Global error handler — no raw stack traces ────────────────────────────────
@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
    )


@app.get("/health")
def health():
    return {"status": "ok", "service": "finvora-api"}
