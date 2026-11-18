"""
ArogyaNova Domain Layer — Appointments

OOP Principles:
- ENCAPSULATION: an appointment's status is private and changes only through
  check_in(), complete(), cancel() and mark_no_show(), which enforce the rules.
- STATE PATTERN (table-driven): _VALID_TRANSITIONS lists every legal move.
- VALUE OBJECT: DoctorSchedule is immutable and answers "which slots exist / are free?"
  so the API never re-implements opening hours.

Lifecycle:
    BOOKED ──check_in()──▶ CHECKED_IN ──complete()──▶ COMPLETED
      │  │                     │
      │  └──mark_no_show()──▶ NO_SHOW
      └──cancel(reason)──▶ CANCELLED ◀──cancel(reason)──┘

Times are clinic wall-clock times (naive datetimes in the clinic's local time zone).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from enum import Enum
from typing import Iterable, Optional


class AppointmentStatus(str, Enum):
    BOOKED = "booked"          # slot reserved by the front desk
    CHECKED_IN = "checked_in"  # patient has arrived and is waiting
    COMPLETED = "completed"    # doctor has seen the patient
    CANCELLED = "cancelled"    # called off (reason required)
    NO_SHOW = "no_show"        # patient never arrived


class AppointmentAction(str, Enum):
    CHECK_IN = "check_in"
    COMPLETE = "complete"
    CANCEL = "cancel"
    NO_SHOW = "no_show"


@dataclass(frozen=True)
class DoctorSchedule:
    """
    A doctor's working hours as an immutable value object.
    Default: Monday–Saturday, 09:00–13:00 and 14:00–17:00, 15-minute slots.
    """
    sessions: tuple[tuple[time, time], ...] = ((time(9, 0), time(13, 0)), (time(14, 0), time(17, 0)))
    slot_minutes: int = 15
    working_days: frozenset[int] = field(default_factory=lambda: frozenset({0, 1, 2, 3, 4, 5}))  # Mon=0 … Sat=5

    def works_on(self, day: date) -> bool:
        return day.weekday() in self.working_days

    def slots_on(self, day: date) -> list[datetime]:
        """Every slot start time on that day (empty on a day off)."""
        if not self.works_on(day):
            return []
        step = timedelta(minutes=self.slot_minutes)
        out: list[datetime] = []
        for start, end in self.sessions:
            t, stop = datetime.combine(day, start), datetime.combine(day, end)
            while t + step <= stop:
                out.append(t)
                t += step
        return out

    def is_slot(self, start: datetime) -> bool:
        """True if `start` is exactly the start of one of the doctor's slots."""
        return start.replace(second=0, microsecond=0) in self.slots_on(start.date())

    def free_slots(self, day: date, taken: Iterable[datetime], now: Optional[datetime] = None) -> list[datetime]:
        """Slots on `day` that are neither booked nor already in the past."""
        now = now or datetime.now()
        busy = {t.replace(second=0, microsecond=0) for t in taken}
        return [s for s in self.slots_on(day) if s not in busy and s > now]


class Appointment:
    """One booked visit of a patient to a doctor."""

    _VALID_TRANSITIONS: dict[AppointmentStatus, list[AppointmentStatus]] = {
        AppointmentStatus.BOOKED: [AppointmentStatus.CHECKED_IN, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
        AppointmentStatus.CHECKED_IN: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED],
        AppointmentStatus.COMPLETED: [],
        AppointmentStatus.CANCELLED: [],
        AppointmentStatus.NO_SHOW: [],
    }

    def __init__(self, scheduled_at: datetime, status: AppointmentStatus = AppointmentStatus.BOOKED) -> None:
        self._scheduled_at = scheduled_at
        self._status = AppointmentStatus(status)

    # --- read-only properties ---
    @property
    def status(self) -> AppointmentStatus:
        return self._status

    @property
    def scheduled_at(self) -> datetime:
        return self._scheduled_at

    @property
    def is_active(self) -> bool:
        """Still holds the doctor's slot."""
        return self._status in (AppointmentStatus.BOOKED, AppointmentStatus.CHECKED_IN)

    # --- behaviour ---
    def check_in(self, now: Optional[datetime] = None) -> None:
        now = now or datetime.now()
        if now.date() != self._scheduled_at.date():
            raise ValueError("A patient can only be checked in on the day of the appointment.")
        self._transition_to(AppointmentStatus.CHECKED_IN)

    def complete(self) -> None:
        if self._status != AppointmentStatus.CHECKED_IN:
            raise ValueError("Check the patient in before completing the appointment.")
        self._transition_to(AppointmentStatus.COMPLETED)

    def cancel(self, reason: Optional[str]) -> None:
        if not reason or len(reason.strip()) < 3:
            raise ValueError("Give a reason for cancelling the appointment.")
        self._transition_to(AppointmentStatus.CANCELLED)

    def mark_no_show(self, now: Optional[datetime] = None) -> None:
        now = now or datetime.now()
        if now < self._scheduled_at:
            raise ValueError("You can only mark a no-show after the appointment time has passed.")
        self._transition_to(AppointmentStatus.NO_SHOW)

    def apply(self, action: AppointmentAction, reason: Optional[str] = None, now: Optional[datetime] = None) -> AppointmentStatus:
        """Polymorphic entry point used by the API: one call, behaviour chosen by the action."""
        {
            AppointmentAction.CHECK_IN: lambda: self.check_in(now),
            AppointmentAction.COMPLETE: lambda: self.complete(),
            AppointmentAction.CANCEL: lambda: self.cancel(reason),
            AppointmentAction.NO_SHOW: lambda: self.mark_no_show(now),
        }[AppointmentAction(action)]()
        return self._status

    # --- internals ---
    def _transition_to(self, new_status: AppointmentStatus) -> None:
        if new_status not in self._VALID_TRANSITIONS[self._status]:
            raise ValueError(f"Cannot change an appointment from '{self._status.value}' to '{new_status.value}'.")
        self._status = new_status

    def __repr__(self) -> str:
        return f"<Appointment {self._scheduled_at:%Y-%m-%d %H:%M} {self._status.value}>"
