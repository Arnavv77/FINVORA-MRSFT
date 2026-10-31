"""CAFIE Model 3 — Integration Schemas."""

from __future__ import annotations
from enum import Enum
from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class ServiceStatus(str, Enum):
    ONLINE = "ONLINE"
    DEGRADED = "DEGRADED"
    OFFLINE = "OFFLINE"
    MOCK = "MOCK"


class ServiceRegistration(BaseModel):
    service_id: str
    name: str
    version: str = "3.0.0"
    status: ServiceStatus = ServiceStatus.ONLINE
    description: str = ""
    is_mock: bool = False
    endpoint_or_module: str = ""
    last_health_check: Optional[datetime] = None
    latency_ms: float = 0.0
    error_message: Optional[str] = None


class ServiceHealthReport(BaseModel):
    overall_status: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    active_services_count: int = 0
    total_services_count: int = 0
    services: Dict[str, ServiceRegistration] = Field(default_factory=dict)


class EventMessage(BaseModel):
    event_id: str
    event_type: str
    source_service: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

