import logging
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.core.database import Base, engine, get_db
from backend.app.core.redis import redis_manager
from backend.app.api.routes import domain, analysis, wayback
from backend.app.api.routes import auth, users, admin as admin_routes
from backend.app.schemas.response_schema import SystemStatusResponse
from backend.app.utils.logger import logger
from prometheus_fastapi_instrumentator import Instrumentator

# ── Import all models so SQLAlchemy registers them with Base.metadata ──────
import backend.app.models.domain        # noqa: F401
import backend.app.models.snapshot      # noqa: F401
import backend.app.models.analysis      # noqa: F401
import backend.app.models.timeline      # noqa: F401
import backend.app.models.threat_intel  # noqa: F401
# Admin Dashboard models
import backend.app.models.user          # noqa: F401
import backend.app.models.scan_record   # noqa: F401
import backend.app.models.activity_log  # noqa: F401
import backend.app.models.login_history # noqa: F401
import backend.app.models.notification  # noqa: F401
import backend.app.models.system_settings  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    logger.info("Starting ChronoSentinel AI FastAPI application...")
    
    # 1. Initialize Database Tables
    try:
        async with engine.begin() as conn:
            # Drop tables if they exist to start fresh, or keep them persistent.
            logger.info("Initializing PostgreSQL database schemas...")
            await conn.run_sync(Base.metadata.create_all)
            
            # Apply schema upgrades safely for evidence details and activity logs
            await conn.execute(text("ALTER TABLE analysis_flags ADD COLUMN IF NOT EXISTS element VARCHAR NULL"))
            await conn.execute(text("ALTER TABLE analysis_flags ADD COLUMN IF NOT EXISTS matched_text VARCHAR NULL"))
            await conn.execute(text("ALTER TABLE analysis_flags ADD COLUMN IF NOT EXISTS snippet VARCHAR NULL"))
            await conn.execute(text("ALTER TABLE analysis_flags ADD COLUMN IF NOT EXISTS position INTEGER NULL"))

            # Activity Logs & Active User tracking upgrades
            await conn.execute(text("ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS category VARCHAR(64) NULL"))
            await conn.execute(text("ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS severity VARCHAR(32) DEFAULT 'INFO'"))
            await conn.execute(text("ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS execution_time_ms INTEGER NULL"))
            await conn.execute(text("ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS endpoint VARCHAR(256) NULL"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP NULL"))

            # Snapshot Redirect Tracking Upgrades
            await conn.execute(text("ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS redirect_url VARCHAR NULL"))
            await conn.execute(text("ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS is_redirect BOOLEAN DEFAULT FALSE"))
            await conn.execute(text("ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS redirect_detected BOOLEAN DEFAULT FALSE"))
            await conn.execute(text("ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS redirect_method VARCHAR NULL"))
            await conn.execute(text("ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS redirect_confidence INTEGER DEFAULT 0"))
            await conn.execute(text("ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS redirect_verified BOOLEAN DEFAULT FALSE"))
            await conn.execute(text("ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS redirect_same_domain BOOLEAN DEFAULT FALSE"))
            await conn.execute(text("ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS redirect_target VARCHAR NULL"))
            await conn.execute(text("ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS redirect_target_status INTEGER NULL"))
            await conn.execute(text("ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS redirect_target_category VARCHAR NULL"))
            await conn.execute(text("ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS redirect_target_risk INTEGER DEFAULT 0"))
            await conn.execute(text("ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS original_category VARCHAR NULL"))
            await conn.execute(text("ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS original_risk INTEGER DEFAULT 0"))
            await conn.execute(text("ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS redirect_evidence TEXT NULL"))
            
            logger.info("Database tables initialized and migrated successfully.")
    except Exception as e:
        logger.critical(f"Database initialization failed: {e}")
        # Don't raise, try to continue, but log heavily

    # 2. Initialize Redis Connection
    try:
        redis_manager.connect()
        ping_ok = await redis_manager.ping()
        if ping_ok:
            if getattr(redis_manager, "is_fallback", False):
                logger.warning("Redis cache connection failed on startup, using in-memory fallback cache.")
            else:
                logger.info("Redis cache connection verified successfully.")
        else:
            logger.warning("Redis cache ping failed on startup.")
    except Exception as e:
        logger.error(f"Redis cache connection failed: {e}")

    # 3. Pre-warm proxy pool in the background (non-blocking)
    # This discovers working proxies before the first analysis request arrives,
    # so the rotation system has a warm cache ready to use immediately.
    if getattr(settings, "ENABLE_PROXY_SCRAPER", False):
        async def _prewarm_proxies():
            try:
                from backend.app.core.proxy_utils import find_working_proxies
                from backend.app.core.redis import redis_manager
                logger.info("[Proxy] Pre-warming proxy pool in background...")
                working = await find_working_proxies()
                await redis_manager.set("scraped_working_proxies", working, expire_seconds=86400)
                logger.info(f"[Proxy] Pre-warm complete: {len(working)} working proxies cached in Redis.")
            except Exception as exc:
                logger.warning(f"[Proxy] Pre-warm failed (non-fatal): {exc}")
        import asyncio as _asyncio
        _asyncio.create_task(_prewarm_proxies())

    logger.info("Application startup complete.")
    yield

    # Shutdown actions
    logger.info("Shutting down ChronoSentinel AI FastAPI application...")
    from backend.app.core.http_client import http_client
    await http_client.close_session()
    await redis_manager.disconnect()
    await engine.dispose()
    logger.info("Application resources released.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="ChronoSentinel AI — API gateway for analyzing historical domain content and scoring risk profiles.",
    version="1.0.0",
    lifespan=lifespan
)

# Production-grade CORS configuration — allows company network & public origins seamlessly
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Existing domain analysis routes ───────────────────────────────────────
app.include_router(domain.router, prefix=f"{settings.API_V1_STR}/domains", tags=["domains"])
app.include_router(analysis.router, prefix=f"{settings.API_V1_STR}/analysis", tags=["analysis"])
app.include_router(wayback.router, prefix=f"{settings.API_V1_STR}/wayback", tags=["wayback"])

# ── Admin Dashboard routes ─────────────────────────────────────────────────
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
app.include_router(admin_routes.router, prefix=f"{settings.API_V1_STR}/admin", tags=["admin"])

# Instrument FastAPI for Prometheus metrics
Instrumentator().instrument(app).expose(app)

# ── Global Exception Handlers: always return JSON, never plain text ──────────

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Return all HTTP errors (4xx/5xx) as clean JSON."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail or "An error occurred."},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return Pydantic/request validation errors as clean JSON."""
    errors = []
    for error in exc.errors():
        loc = " → ".join(str(l) for l in error.get("loc", []) if l != "body")
        msg = error.get("msg", "Invalid value")
        errors.append(f"{loc}: {msg}" if loc else msg)
    return JSONResponse(
        status_code=422,
        content={"detail": "; ".join(errors) or "Request validation failed."},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch-all for any unhandled server exceptions — always returns JSON, never plain text."""
    logger.error(
        f"[500] Unhandled exception on {request.method} {request.url.path}:\n"
        + traceback.format_exc()
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please try again later."},
    )



@app.get("/health", response_model=SystemStatusResponse, tags=["system"])
@app.get(f"{settings.API_V1_STR}/health", response_model=SystemStatusResponse, tags=["system"])
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Checks the connectivity status of PostgreSQL and Redis.
    """
    postgres_status = "healthy"
    redis_status = "healthy"

    # Test Postgres
    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"Health check failed for Postgres: {e}")
        postgres_status = f"unhealthy: {str(e)}"

    # Test Redis
    try:
        ping_ok = await redis_manager.ping()
        if not ping_ok:
            redis_status = "unhealthy: ping returned False"
        elif getattr(redis_manager, "is_fallback", False):
            redis_status = "healthy (in-memory fallback)"
    except Exception as e:
        logger.error(f"Health check failed for Redis: {e}")
        redis_status = f"unhealthy: {str(e)}"

    overall_status = "healthy" if (postgres_status == "healthy" and redis_status.startswith("healthy")) else "degraded"

    return SystemStatusResponse(
        status=overall_status,
        postgres=postgres_status,
        redis=redis_status
    )


# ── Serve React Frontend static files directly from FastAPI ─────────────────
import os
from fastapi.responses import FileResponse

frontend_dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.exists(frontend_dist_dir):
    @app.get("/{catchall:path}", include_in_schema=False)
    async def serve_spa(catchall: str):
        # Prevent intercepting API routes, Health, Docs, Redoc, Metrics
        if catchall.startswith(("api", "health", "docs", "redoc", "openapi.json", "metrics")):
            from fastapi import HTTPException
            raise HTTPException(status_code=404)
        
        # Check if the requested file exists (e.g. assets, favicon, etc.)
        file_path = os.path.join(frontend_dist_dir, catchall)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
            
        # Fallback to index.html for Single Page Application (SPA) routing
        index_file = os.path.join(frontend_dist_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
            
        from fastapi import HTTPException
        raise HTTPException(status_code=404)

