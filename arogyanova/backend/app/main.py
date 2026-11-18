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
from app.api.v1.appointments import router as appointments_router
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

from app.security.rate_limit import limiter, rate_limit_handler  # noqa: E402


def _add_missing_columns(sync_conn) -> None:
    """
    Lightweight schema upgrade for existing databases: create_all() makes new tables
    but never adds columns to tables that already exist.
    """
    from sqlalchemy import inspect, text
    cols = {c["name"] for c in inspect(sync_conn).get_columns("prescriptions")}
    if "pharmacy_status" not in cols:
        sync_conn.execute(text("ALTER TABLE prescriptions ADD COLUMN pharmacy_status VARCHAR(20) NOT NULL DEFAULT 'pending'"))
    ucols = {c["name"] for c in inspect(sync_conn).get_columns("users")}
    if "failed_login_attempts" not in ucols:
        sync_conn.execute(text("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0"))
    if "locked_until" not in ucols:
        ts = "TIMESTAMP WITH TIME ZONE" if sync_conn.dialect.name == "postgresql" else "DATETIME"
        sync_conn.execute(text(f"ALTER TABLE users ADD COLUMN locked_until {ts}"))
    if "cancellation_reason" not in cols:
        sync_conn.execute(text("ALTER TABLE prescriptions ADD COLUMN cancellation_reason TEXT"))
    if "replaces_id" not in cols:
        uuid_type = "UUID" if sync_conn.dialect.name == "postgresql" else "CHAR(32)"
        sync_conn.execute(text(f"ALTER TABLE prescriptions ADD COLUMN replaces_id {uuid_type} REFERENCES prescriptions(id)"))
    _allow_receptionist_role(sync_conn)
    _allow_doctor_response(sync_conn)


def _allow_receptionist_role(sync_conn) -> None:
    """Widen the users.valid_role CHECK constraint in databases created before the Receptionist role."""
    from sqlalchemy import text
    dialect = sync_conn.dialect.name
    if dialect == "sqlite":
        row = sync_conn.execute(text("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")).fetchone()
        if not row or "'receptionist'" in row[0]:
            return
        # SQLite cannot alter a CHECK constraint: rebuild the table (data, ids and indexes preserved).
        indexes = [r[0] for r in sync_conn.execute(text(
            "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='users' AND sql IS NOT NULL")).fetchall()]
        new_sql = row[0].replace("'pharmacist', 'administrator')", "'pharmacist', 'administrator', 'receptionist')")
        new_sql = new_sql.replace("CREATE TABLE users", "CREATE TABLE users__new", 1)
        sync_conn.execute(text(new_sql))
        sync_conn.execute(text("INSERT INTO users__new SELECT * FROM users"))
        sync_conn.execute(text("DROP TABLE users"))
        sync_conn.execute(text("ALTER TABLE users__new RENAME TO users"))
        for ddl in indexes:
            sync_conn.execute(text(ddl))
    elif dialect == "postgresql":
        sync_conn.execute(text("ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_role"))
        sync_conn.execute(text(
            "ALTER TABLE users ADD CONSTRAINT valid_role CHECK (role IN "
            "('doctor', 'patient', 'pharmacist', 'administrator', 'receptionist'))"))


def _allow_doctor_response(sync_conn) -> None:
    """Widen pharmacy_actions.valid_pharmacy_action to include the doctor's 'respond' action."""
    from sqlalchemy import text
    dialect = sync_conn.dialect.name
    if dialect == "sqlite":
        row = sync_conn.execute(text("SELECT sql FROM sqlite_master WHERE type='table' AND name='pharmacy_actions'")).fetchone()
        if not row or "'respond'" in row[0]:
            return
        indexes = [r[0] for r in sync_conn.execute(text(
            "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='pharmacy_actions' AND sql IS NOT NULL")).fetchall()]
        new_sql = row[0].replace("'flag', 'dispense')", "'flag', 'dispense', 'respond')")
        new_sql = new_sql.replace("CREATE TABLE pharmacy_actions", "CREATE TABLE pharmacy_actions__new", 1)
        sync_conn.execute(text(new_sql))
        sync_conn.execute(text("INSERT INTO pharmacy_actions__new SELECT * FROM pharmacy_actions"))
        sync_conn.execute(text("DROP TABLE pharmacy_actions"))
        sync_conn.execute(text("ALTER TABLE pharmacy_actions__new RENAME TO pharmacy_actions"))
        for ddl in indexes:
            sync_conn.execute(text(ddl))
    elif dialect == "postgresql":
        sync_conn.execute(text("ALTER TABLE pharmacy_actions DROP CONSTRAINT IF EXISTS valid_pharmacy_action"))
        sync_conn.execute(text(
            "ALTER TABLE pharmacy_actions ADD CONSTRAINT valid_pharmacy_action CHECK (action IN "
            "('verify', 'flag', 'dispense', 'respond'))"))


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
            await conn.run_sync(_add_missing_columns)
        logger.info("Database tables ready")
    except Exception as exc:
        logger.error("Failed to create database tables", error=str(exc))

    try:
        await run_seed()
    except Exception as exc:
        logger.warning("Seed skipped or partially failed", error=str(exc))
    try:
        from app.db.seed import ensure_demo_receptionist
        await ensure_demo_receptionist()
    except Exception as exc:
        logger.warning("Demo receptionist not added", error=str(exc))

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
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

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
@app.exception_handler(ValueError)
async def domain_rule_handler(request: Request, exc: ValueError):
    """
    Domain classes (e.g. Prescription) raise ValueError when a business rule is broken,
    such as editing an ACTIVE prescription or finalizing one with no medicines.
    That is the user's mistake, not a server crash, so answer 400 with the reason.
    """
    return JSONResponse(status_code=400, content={"detail": str(exc)})


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
app.include_router(appointments_router, prefix=API_PREFIX)
