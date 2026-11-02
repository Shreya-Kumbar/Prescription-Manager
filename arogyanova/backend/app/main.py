"""
ArogyaNova — FastAPI Application Entry Point
"""
from __future__ import annotations

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.v1.auth import router as auth_router
from app.api.v1.prescriptions import router as prescriptions_router
from app.api.v1.routes import (
    admin_router,
    ai_router,
    analytics_router,
    dashboard_router,
    medications_router,
    notifications_router,
    patients_router,
    schedule_router,
)
from app.core.config import settings
from app.db.database import engine
from app.models import *  # noqa: F401,F403 — ensure all models are imported for metadata

logger = structlog.get_logger()

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ------------------------------------------------------------------
    # Auto-initialise on every startup:
    #   1. Create all database tables (idempotent — CREATE TABLE IF NOT EXISTS)
    #   2. Seed demo accounts and sample data (idempotent — skips if users exist)
    #
    # This makes the project zero-config for anyone who clones the repo:
    #   git clone ... -> pip install -r requirements.txt -> python run.py
    # Works immediately without any manual DB setup or migrations.
    # ------------------------------------------------------------------
    from app.models.models import Base  # noqa — ensure models registered
    from app.db.seed import seed as run_seed

    logger.info("ArogyaNova backend starting up", version=settings.VERSION, env=settings.ENVIRONMENT)

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables ready")
    except Exception as exc:
        logger.error("Failed to create database tables", error=str(exc))

    try:
        await run_seed()
    except Exception as exc:
        logger.warning("Seed skipped or partially failed", error=str(exc))

    yield

    await engine.dispose()
    logger.info("ArogyaNova backend shutting down")


app = FastAPI(
    title="ArogyaNova API",
    description="Intelligent Prescription Management System — REST API",
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# Request logging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(
        "request",
        method=request.method,
        path=request.url.path,
        client=request.client.host if request.client else None,
    )
    response = await call_next(request)
    logger.info("response", status=response.status_code, path=request.url.path)
    return response


# Global exception handler — never expose internal details
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("unhandled_exception", error=str(exc), path=request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred. Please try again later."},
    )


# Health check
@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "app": "ArogyaNova", "version": settings.VERSION}


# Register routers
API_PREFIX = "/api/v1"
app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(prescriptions_router, prefix=API_PREFIX)
app.include_router(patients_router, prefix=API_PREFIX)
app.include_router(medications_router, prefix=API_PREFIX)
app.include_router(schedule_router, prefix=API_PREFIX)
app.include_router(notifications_router, prefix=API_PREFIX)
app.include_router(dashboard_router, prefix=API_PREFIX)
app.include_router(analytics_router, prefix=API_PREFIX)
app.include_router(admin_router, prefix=API_PREFIX)
app.include_router(ai_router, prefix=API_PREFIX)
