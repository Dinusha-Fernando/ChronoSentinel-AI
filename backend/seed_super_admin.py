"""
Seed Super Admin — run once to bootstrap the first Super Admin account.

Usage:
    python -m backend.seed_super_admin --email admin@example.com --password "Secret@123" --username superadmin
    
Or with defaults:
    python -m backend.seed_super_admin

WARNING: Run this only once, in a controlled environment.
The script will refuse to create a duplicate Super Admin.
"""
import asyncio
import argparse
import sys
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# Bootstrap settings (reads .env)
from backend.app.core.config import settings
from backend.app.core.database import Base
from backend.app.core.security import hash_password, validate_password_strength
from backend.app.models.user import User, UserRole, UserStatus

# Import all models to register them with Base
import backend.app.models.domain        # noqa
import backend.app.models.snapshot      # noqa
import backend.app.models.analysis      # noqa
import backend.app.models.timeline      # noqa
import backend.app.models.threat_intel  # noqa
import backend.app.models.user          # noqa
import backend.app.models.scan_record   # noqa
import backend.app.models.activity_log  # noqa
import backend.app.models.login_history # noqa
import backend.app.models.notification  # noqa
import backend.app.models.system_settings  # noqa

from backend.app.models.system_settings import SystemSettings


DEFAULT_SETTINGS = [
    {"key": "system_name",         "value": "ChronoSentinel AI",  "category": "general",  "description": "Display name of the system"},
    {"key": "session_timeout_min", "value": "60",                  "category": "security", "description": "Session timeout in minutes"},
    {"key": "max_login_attempts",  "value": "5",                   "category": "security", "description": "Max failed logins before lockout"},
    {"key": "account_lock_min",    "value": "15",                  "category": "security", "description": "Account lock duration in minutes"},
    {"key": "password_min_length", "value": "8",                   "category": "security", "description": "Minimum password length"},
    {"key": "smtp_host",           "value": "",                    "category": "smtp",     "description": "SMTP server host"},
    {"key": "smtp_port",           "value": "587",                 "category": "smtp",     "description": "SMTP server port"},
    {"key": "smtp_from",           "value": "noreply@chronosentinel.ai", "category": "smtp", "description": "From address for emails"},
    {"key": "wayback_cdx_url",     "value": settings.WAYBACK_CDX_URL,  "category": "wayback", "description": "Wayback CDX API URL"},
    {"key": "wayback_snapshot_url","value": settings.WAYBACK_SNAPSHOT_URL, "category": "wayback", "description": "Wayback snapshot base URL"},
]


async def seed(email: str, password: str, username: str, full_name: str) -> None:
    # Validate password
    errors = validate_password_strength(password)
    if errors:
        print("❌ Password does not meet policy requirements:")
        for err in errors:
            print(f"   • {err}")
        sys.exit(1)

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        print("[DB] Creating database tables (if not exist)...")
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as db:
        # Check if any Super Admin already exists
        existing = await db.execute(
            select(User).where(User.role == UserRole.super_admin, User.is_deleted == False)
        )
        if existing.scalar_one_or_none():
            print("[WARN] A Super Admin already exists. Skipping creation.")
        else:
            super_admin = User(
                full_name=full_name,
                username=username,
                email=email,
                hashed_password=hash_password(password),
                role=UserRole.super_admin,
                status=UserStatus.active,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(super_admin)
            await db.flush()
            print(f"[OK] Super Admin created: {username} ({email})")

        # Seed default system settings
        print("[INFO] Seeding default system settings...")
        for s in DEFAULT_SETTINGS:
            existing_setting = await db.execute(
                select(SystemSettings).where(SystemSettings.key == s["key"])
            )
            if not existing_setting.scalar_one_or_none():
                db.add(SystemSettings(
                    key=s["key"],
                    value=s["value"],
                    description=s["description"],
                    category=s["category"],
                    updated_at=datetime.utcnow(),
                ))
        await db.commit()
        print("[OK] Default system settings seeded.")

    await engine.dispose()
    print("\n[SUCCESS] Seed complete! You can now log in at /login")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the first Super Admin for ChronoSentinel AI")
    parser.add_argument("--email",     default="admin@chronosentinel.ai", help="Super Admin email")
    parser.add_argument("--username",  default="superadmin",              help="Super Admin username")
    parser.add_argument("--password",  default="Admin@12345",             help="Super Admin password")
    parser.add_argument("--full-name", default="Super Administrator",     help="Super Admin full name")
    args = parser.parse_args()

    asyncio.run(seed(
        email=args.email,
        password=args.password,
        username=args.username,
        full_name=args.full_name,
    ))


if __name__ == "__main__":
    main()
