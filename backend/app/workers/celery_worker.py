from celery import Celery
from celery.schedules import crontab
from backend.app.core.config import settings

# Create Celery instance
celery_app = Celery(
    "domain_risk_tasks",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND
)

# Optional configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes max per analysis task
)

# Auto-discover tasks in the tasks module
celery_app.autodiscover_tasks(["backend.app.workers"], force=True)

# Define periodic task schedule
celery_app.conf.beat_schedule = {
    "cleanup-old-domains-daily": {
        "task": "tasks.cleanup_old_domains",
        "schedule": crontab(hour=0, minute=0),  # Run daily at midnight UTC
    },
    "refresh-working-proxies-10m": {
        "task": "tasks.update_working_proxies",
        "schedule": 600.0,  # Run every 10 minutes (600 seconds)
    },
}

