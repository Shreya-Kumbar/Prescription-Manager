"""
ArogyaNova — Account lockout (brute-force protection)

OOP: the policy is one small class with named constants, so the rule
("5 wrong passwords → locked for 15 minutes") lives in exactly one place and is unit-testable.

Works together with per-IP rate limiting (app.security.rate_limit):
  * rate limiting slows down one attacker hammering many accounts from one address;
  * lockout protects one account being guessed from many addresses.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    """SQLite returns naive datetimes; treat them as UTC."""
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


@dataclass(frozen=True)
class AccountLockoutPolicy:
    max_attempts: int = 5
    lock_minutes: int = 15

    def minutes_left(self, user, now: Optional[datetime] = None) -> int:
        """0 if the account is usable, otherwise whole minutes until it unlocks."""
        now = now or datetime.now(timezone.utc)
        until = _aware(getattr(user, "locked_until", None))
        if not until or until <= now:
            return 0
        return max(1, int((until - now).total_seconds() // 60) + 1)

    def is_locked(self, user, now: Optional[datetime] = None) -> bool:
        return self.minutes_left(user, now) > 0

    def register_failure(self, user, now: Optional[datetime] = None) -> bool:
        """Count one wrong password. Returns True if this attempt locked the account."""
        now = now or datetime.now(timezone.utc)
        if _aware(getattr(user, "locked_until", None)) and _aware(user.locked_until) <= now:
            user.locked_until = None          # previous lock expired: start counting afresh
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= self.max_attempts:
            user.locked_until = now + timedelta(minutes=self.lock_minutes)
            user.failed_login_attempts = 0
            return True
        return False

    def attempts_left(self, user) -> int:
        return max(0, self.max_attempts - (user.failed_login_attempts or 0))

    @staticmethod
    def reset(user) -> None:
        """Successful login, password reset or admin unlock."""
        user.failed_login_attempts = 0
        user.locked_until = None


LOCKOUT = AccountLockoutPolicy()
