"""
ArogyaNova — Per-IP rate limiting (SlowAPI, fixed window)

Limits are applied with @limiter.limit(...) on the sensitive auth endpoints.
Exceeding a limit returns HTTP 429 with a Retry-After header.
"""
from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

LOGIN_LIMIT = "10/minute"          # per IP address
REGISTER_LIMIT = "5/minute"
PASSWORD_RESET_LIMIT = "5/minute"


async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many attempts from this device. Please wait a minute and try again."},
        headers={"Retry-After": "60"},
    )
