"""Brute-force protection: account lockout policy + per-IP rate limiting on login."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.security.lockout import AccountLockoutPolicy
from app.security.rate_limit import limiter
from tests.test_api_rules import env  # noqa: F401  (reuse the API fixture)


def test_policy_locks_after_five_failures_and_expires():
    p = AccountLockoutPolicy(max_attempts=5, lock_minutes=15)
    u = SimpleNamespace(failed_login_attempts=0, locked_until=None)
    now = datetime(2026, 11, 18, 10, 0, tzinfo=timezone.utc)
    assert [p.register_failure(u, now) for _ in range(4)] == [False] * 4
    assert p.attempts_left(u) == 1 and not p.is_locked(u, now)
    assert p.register_failure(u, now) is True
    assert p.is_locked(u, now) and p.minutes_left(u, now) == 15
    assert not p.is_locked(u, now + timedelta(minutes=15, seconds=1))   # lock expires on its own
    p.reset(u)
    assert u.failed_login_attempts == 0 and u.locked_until is None


async def test_account_locks_after_five_wrong_passwords_over_api(env):  # noqa: F811
    from httpx import ASGITransport, AsyncClient
    from app.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        login = lambda pw: c.post("/api/v1/auth/login", json={"email": "pat@example.com", "password": pw})  # noqa: E731
        codes = [(await login("Wrong-pass-1")).status_code for _ in range(4)]
        assert codes == [401] * 4
        fifth = await login("Wrong-pass-1")
        assert fifth.status_code == 423 and "locked" in fifth.json()["detail"]
        # even the right password is refused while locked
        assert (await login("Testpass123")).status_code == 423

        users = (await env["admin"].get("/api/v1/admin/users")).json()
        pat = next(u for u in users if u["email"] == "pat@example.com")
        assert pat["locked_until"]
        assert (await env["doctor"].post(f"/api/v1/admin/users/{pat['id']}/unlock")).status_code == 403
        assert (await env["admin"].post(f"/api/v1/admin/users/{pat['id']}/unlock")).status_code == 200
        assert (await login("Testpass123")).status_code == 200

        notes = (await env["patient"].get("/api/v1/notifications")).json()
        notes = notes if isinstance(notes, list) else notes.get("items", [])
        assert any(n["title"] == "Account locked" for n in notes)


async def test_login_is_rate_limited_per_ip(env):  # noqa: F811
    from httpx import ASGITransport, AsyncClient
    from app.main import app
    limiter.enabled = True
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        codes = [(await c.post("/api/v1/auth/login", json={"email": "nobody@example.com", "password": "x"})).status_code
                 for _ in range(11)]
    assert codes[:10] == [401] * 10
    assert codes[10] == 429
