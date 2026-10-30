from .dashboard import router as dashboard_router
from .transactions import router as transactions_router
from .risks import router as risks_router
from .forecast import router as forecast_router
from .simulate import router as simulate_router
from .budget import router as budget_router
from .copilot import router as copilot_router
from .ask import router as ask_router

__all__ = [
    "dashboard_router",
    "transactions_router",
    "risks_router",
    "forecast_router",
    "simulate_router",
    "budget_router",
    "copilot_router",
    "ask_router",
]

