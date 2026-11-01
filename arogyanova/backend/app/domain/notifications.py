"""
ArogyaNova — Notification Channel Abstractions

OOP Principles:
- ABSTRACTION: NotificationChannel defines the sending contract
- POLYMORPHISM: InApp, Email, SMS channels are interchangeable implementations
- DEPENDENCY INVERSION: Services depend on the abstract channel, not concrete ones
"""
from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional


class NotificationPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


@dataclass(frozen=True)
class Notification:
    """
    Immutable value object representing a notification to be delivered.
    """
    notification_id: uuid.UUID
    user_id: uuid.UUID
    title: str
    message: str
    priority: NotificationPriority = NotificationPriority.NORMAL
    action_url: Optional[str] = None
    created_at: datetime = None

    def __post_init__(self):
        if self.created_at is None:
            object.__setattr__(self, 'created_at', datetime.utcnow())


class NotificationChannel(ABC):
    """
    Abstract base class for all notification delivery channels.

    OOP: ABSTRACTION — consumers depend on this interface.
    OOP: OPEN/CLOSED — add new channels without modifying existing ones.
    """

    @abstractmethod
    async def send(self, notification: Notification) -> bool:
        """
        Deliver the notification. Returns True if delivery succeeded.
        """
        ...

    @abstractmethod
    def is_available(self) -> bool:
        """Whether this channel can currently deliver notifications."""
        ...

    @property
    @abstractmethod
    def channel_name(self) -> str:
        """Human-readable name of this delivery channel."""
        ...


class InAppNotificationChannel(NotificationChannel):
    """
    Delivers notifications within the ArogyaNova application.

    OOP: POLYMORPHISM — implements NotificationChannel interface.
    """

    def __init__(self, db_session_factory) -> None:
        self._db_session_factory = db_session_factory

    async def send(self, notification: Notification) -> bool:
        """Persists the notification to the database for in-app display."""
        from app.models.notification import NotificationModel
        try:
            async with self._db_session_factory() as session:
                record = NotificationModel(
                    id=notification.notification_id,
                    user_id=notification.user_id,
                    title=notification.title,
                    message=notification.message,
                    priority=notification.priority.value,
                    action_url=notification.action_url,
                    is_read=False,
                    created_at=notification.created_at,
                )
                session.add(record)
                await session.commit()
            return True
        except Exception:
            return False

    def is_available(self) -> bool:
        return True

    @property
    def channel_name(self) -> str:
        return "in-app"


class EmailNotificationChannel(NotificationChannel):
    """
    Delivers notifications via email.

    OOP: POLYMORPHISM — implements NotificationChannel.
    NOTE: Requires email provider configuration. Currently unavailable by default.
    """

    def __init__(self, smtp_host: Optional[str] = None, smtp_port: int = 587,
                 smtp_user: Optional[str] = None, smtp_password: Optional[str] = None) -> None:
        self._smtp_host = smtp_host
        self._smtp_port = smtp_port
        self._smtp_user = smtp_user
        self._smtp_password = smtp_password

    async def send(self, notification: Notification) -> bool:
        if not self.is_available():
            return False
        # Email sending implementation would go here with an SMTP library
        # Returning False until SMTP is configured
        return False

    def is_available(self) -> bool:
        return bool(self._smtp_host and self._smtp_user)

    @property
    def channel_name(self) -> str:
        return "email"


class SMSNotificationChannel(NotificationChannel):
    """
    Delivers notifications via SMS.

    OOP: POLYMORPHISM — implements NotificationChannel.
    NOTE: Requires SMS provider (e.g., Twilio) configuration.
    """

    def __init__(self, provider_sid: Optional[str] = None, provider_token: Optional[str] = None) -> None:
        self._provider_sid = provider_sid
        self._provider_token = provider_token

    async def send(self, notification: Notification) -> bool:
        if not self.is_available():
            return False
        # SMS provider integration would go here
        return False

    def is_available(self) -> bool:
        return bool(self._provider_sid and self._provider_token)

    @property
    def channel_name(self) -> str:
        return "sms"


class NotificationService:
    """
    Orchestrates notification delivery across multiple channels.

    OOP: COMPOSITION — contains a list of NotificationChannel instances.
    OOP: DEPENDENCY INVERSION — receives abstract channels, not concrete classes.
    """

    def __init__(self, channels: list[NotificationChannel]) -> None:
        self._channels = channels

    async def notify(self, notification: Notification) -> dict[str, bool]:
        """Send through all available channels. Returns delivery results."""
        results: dict[str, bool] = {}
        for channel in self._channels:
            if channel.is_available():
                success = await channel.send(notification)
                results[channel.channel_name] = success
        return results

    def available_channels(self) -> list[str]:
        return [c.channel_name for c in self._channels if c.is_available()]
