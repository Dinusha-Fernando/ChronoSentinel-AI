from fastapi import APIRouter, HTTPException
from celery.result import AsyncResult
from backend.app.workers.celery_worker import celery_app
from backend.app.services.analyzer import RISK_CATEGORIES
from backend.app.utils.logger import logger

router = APIRouter()

from backend.app.services.task_dispatcher import get_task_status_hybrid

@router.get("/task/{task_id}")
async def get_task_status(task_id: str):
    """
    Checks the status of a background analysis job (via Celery or fallback async store).
    """
    try:
        return await get_task_status_hybrid(task_id)
    except Exception as e:
        logger.error(f"Error checking task status for {task_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Could not retrieve task status: {str(e)}"
        )

@router.get("/rules")
async def get_keyword_rules():
    """
    Returns the loaded risk keyword list and weights, grouped by category.
    """
    return RISK_CATEGORIES
