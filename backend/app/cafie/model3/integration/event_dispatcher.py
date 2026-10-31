"""CAFIE Model 3 — Event Dispatcher.

In-memory event publication and subscription system for decoupled workflow notifications,
audit tracing, and diagnostic alerting.
"""

from __future__ import annotations
import uuid
import logging
from typing import Dict, Any, List, Callable, Optional
from datetime import datetime

from ..schemas.integration_schema import EventMessage

logger = logging.getLogger("finvora.cafie.model3.event_dispatcher")


class EventDispatcher:
    """Pub/Sub event dispatcher for CAFIE Model 3 events."""

    _instance: Optional[EventDispatcher] = None

    def __new__(cls) -> EventDispatcher:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._subscribers: Dict[str, List[Callable[[EventMessage], None]]] = {}
            cls._instance._event_history: List[EventMessage] = []
            cls._instance._max_history: int = 500
        return cls._instance

    def subscribe(self, event_type: str, callback: Callable[[EventMessage], None]) -> None:
        """Subscribes a callback to an event type (or '*' for all events)."""
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(callback)

    def publish(self, event_type: str, source_service: str, payload: Dict[str, Any]) -> EventMessage:
        """Dispatches an event to all matching subscribers and stores it in history."""
        event = EventMessage(
            event_id=f"evt_{uuid.uuid4().hex[:12]}",
            event_type=event_type,
            source_service=source_service,
            payload=payload,
            timestamp=datetime.utcnow(),
        )

        # Store in rolling history
        self._event_history.append(event)
        if len(self._event_history) > self._max_history:
            self._event_history.pop(0)

        # Notify specific subscribers
        if event_type in self._subscribers:
            for cb in self._subscribers[event_type]:
                try:
                    cb(event)
                except Exception as e:
                    logger.error(f"Error executing event subscriber for {event_type}: {e}")

        # Notify wildcard subscribers
        if "*" in self._subscribers:
            for cb in self._subscribers["*"]:
                try:
                    cb(event)
                except Exception as e:
                    logger.error(f"Error executing wildcard subscriber for {event_type}: {e}")

        return event

    def get_history(self, limit: int = 50, event_type: Optional[str] = None) -> List[EventMessage]:
        """Returns recent event history."""
        if event_type:
            filtered = [e for e in self._event_history if e.event_type == event_type]
            return filtered[-limit:]
        return self._event_history[-limit:]

    def clear_history(self) -> None:
        """Clears in-memory history (useful in isolated tests)."""
        self._event_history.clear()


def get_event_dispatcher() -> EventDispatcher:
    """Returns the singleton instance of EventDispatcher."""
    return EventDispatcher()

