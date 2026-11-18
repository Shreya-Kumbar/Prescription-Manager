"""Shared test setup."""
import pytest

from app.security.rate_limit import limiter


@pytest.fixture(autouse=True)
def _no_rate_limit_by_default():
    """Most tests log in many times; the rate limiter is tested on its own in test_security_lockout.py."""
    limiter.reset()
    limiter.enabled = False
    yield
    limiter.enabled = False
    limiter.reset()
