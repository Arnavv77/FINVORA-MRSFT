"""CAFIE Model 3 — Health Schemas."""

from __future__ import annotations
from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class ComponentHealth(BaseModel):
    name: str
    status: str  # HEALTHY, DEGRADED, UNHEALTHY, MOCKED
    latency_ms: float = 0.0
    details: Dict[str, Any] = Field(default_factory=dict)
    last_checked: datetime = Field(default_factory=datetime.utcnow)


class SystemHealthReport(BaseModel):
    system_status: str  # OPERATIONAL, DEGRADED, MAINTENANCE
    version: str = "3.0.0"
    uptime_seconds: float = 0.0
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    components: List[ComponentHealth] = Field(default_factory=list)

