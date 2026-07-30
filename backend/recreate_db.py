import asyncio
from backend.app.core.database import Base, engine
from backend.app.utils.logger import logger
from sqlalchemy import text
import backend.app.models.domain       # noqa: F401
import backend.app.models.snapshot     # noqa: F401
import backend.app.models.analysis     # noqa: F401
import backend.app.models.timeline     # noqa: F401
import backend.app.models.threat_intel # noqa: F401
import backend.app.models.user         # noqa: F401
import backend.app.models.scan_record  # noqa: F401
import backend.app.models.activity_log # noqa: F401
import backend.app.models.login_history# noqa: F401
import backend.app.models.notification # noqa: F401
import backend.app.models.system_settings# noqa: F401

async def recreate():
    logger.info("Dropping all existing database tables to apply new schema changes...")
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE;"))
        await conn.execute(text("CREATE SCHEMA public;"))
        logger.info("Schema public reset successfully.")
        await conn.run_sync(Base.metadata.create_all)
        logger.info("All database tables created successfully.")

if __name__ == "__main__":
    asyncio.run(recreate())
