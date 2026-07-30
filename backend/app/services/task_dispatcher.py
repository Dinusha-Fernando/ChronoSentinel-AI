import uuid
import asyncio
import logging
from typing import Optional, Dict, Any
from backend.app.core.redis import redis_manager
from backend.app.workers.celery_worker import celery_app
from backend.app.workers.tasks import (
    analyze_domain_task, 
    analyze_multiple_domains_task,
    run_analyze_domain,
    run_analyze_multiple_domains,
)

logger = logging.getLogger(__name__)

async def dispatch_single_domain_analysis(
    domain: str, 
    force_refresh: bool = False, 
    user_id: Optional[int] = None
) -> str:
    """
    Submits a single domain analysis task.
    Supports task deduplication if another user is already scanning the same domain.
    Attempts Celery first; if Redis/Celery is down or unavailable, seamlessly falls back
    to an async background task tracked via in-memory/Redis manager.
    """
    domain_clean = domain.strip().lower().removeprefix("http://").removeprefix("https://").strip("/")

    # Check for active running scan for this domain to avoid duplicate tasks
    if not force_refresh:
        active_task_id = await redis_manager.get(f"active_domain_task:{domain_clean}")
        if active_task_id and isinstance(active_task_id, str):
            active_st = await get_task_status_hybrid(active_task_id)
            if active_st.get("status") in ("PENDING", "STARTED"):
                logger.info(f"Reusing active in-progress scan task {active_task_id} for domain {domain_clean}")
                return active_task_id

    # 1. Try Celery dispatch
    try:
        if not redis_manager.is_fallback:
            task = analyze_domain_task.delay(domain_clean, force_refresh, user_id)
            logger.info(f"Queued single domain analysis task {task.id} via Celery for {domain_clean}")
            await redis_manager.set(f"active_domain_task:{domain_clean}", task.id, expire_seconds=300)
            return task.id
    except Exception as cel_err:
        logger.warning(f"Celery dispatch failed for {domain_clean} ({cel_err}). Switching to async fallback task execution.")

    # 2. Local Async Fallback Task
    task_id = f"fallback_{uuid.uuid4().hex}"
    task_key = f"task_status:{task_id}"
    await redis_manager.set(f"active_domain_task:{domain_clean}", task_id, expire_seconds=300)
    
    initial_payload = {
        "task_id": task_id,
        "status": "PENDING",
        "info": f"Analyzing domain {domain_clean} in fallback mode...",
        "result": None,
        "error": None
    }
    await redis_manager.set(task_key, initial_payload, expire_seconds=3600)

    async def _async_worker():
        try:
            logger.info(f"[Fallback Task] Starting background execution for {task_id} ({domain})")
            # Update status to STARTED
            await redis_manager.set(task_key, {
                "task_id": task_id,
                "status": "STARTED",
                "info": f"Processing {domain}...",
                "result": None,
                "error": None
            }, expire_seconds=3600)

            # Directly await async worker natively inside the event loop
            res = await run_analyze_domain(domain, force_refresh, user_id)

            await redis_manager.set(task_key, {
                "task_id": task_id,
                "status": "SUCCESS",
                "info": "Analysis complete",
                "result": res,
                "error": None
            }, expire_seconds=3600)
            logger.info(f"[Fallback Task] Successfully completed task {task_id} for {domain}")
        except Exception as err:
            logger.error(f"[Fallback Task] Error executing task {task_id} for {domain}: {err}", exc_info=True)
            await redis_manager.set(task_key, {
                "task_id": task_id,
                "status": "FAILURE",
                "info": "Analysis failed",
                "result": None,
                "error": str(err)
            }, expire_seconds=3600)

    asyncio.create_task(_async_worker())
    return task_id


async def dispatch_bulk_domain_analysis(
    domains: list[str], 
    force_refresh: bool = False
) -> str:
    """
    Submits a batch domain analysis task.
    Attempts Celery first; if Redis/Celery is down or unavailable, seamlessly falls back
    to an async background task.
    """
    # 1. Try Celery dispatch
    try:
        if not redis_manager.is_fallback:
            task = analyze_multiple_domains_task.delay(domains, force_refresh)
            logger.info(f"Queued bulk analysis task {task.id} via Celery for {len(domains)} domains")
            return task.id
    except Exception as cel_err:
        logger.warning(f"Celery bulk dispatch failed ({cel_err}). Switching to async fallback task execution.")

    # 2. Local Async Fallback Task
    task_id = f"fallback_{uuid.uuid4().hex}"
    task_key = f"task_status:{task_id}"

    initial_payload = {
        "task_id": task_id,
        "status": "PENDING",
        "info": f"Analyzing {len(domains)} domains in fallback mode...",
        "result": None,
        "error": None
    }
    await redis_manager.set(task_key, initial_payload, expire_seconds=3600)

    async def _async_worker():
        try:
            logger.info(f"[Fallback Bulk Task] Starting execution for {task_id} ({len(domains)} domains)")
            await redis_manager.set(task_key, {
                "task_id": task_id,
                "status": "STARTED",
                "info": f"Processing {len(domains)} domains...",
                "result": None,
                "error": None
            }, expire_seconds=3600)

            # Directly await async worker natively inside the event loop
            res = await run_analyze_multiple_domains(domains, force_refresh)

            await redis_manager.set(task_key, {
                "task_id": task_id,
                "status": "SUCCESS",
                "info": "Bulk analysis complete",
                "result": res,
                "error": None
            }, expire_seconds=3600)
            logger.info(f"[Fallback Bulk Task] Successfully completed bulk task {task_id}")
        except Exception as err:
            logger.error(f"[Fallback Bulk Task] Error executing bulk task {task_id}: {err}", exc_info=True)
            await redis_manager.set(task_key, {
                "task_id": task_id,
                "status": "FAILURE",
                "info": "Bulk analysis failed",
                "result": None,
                "error": str(err)
            }, expire_seconds=3600)

    asyncio.create_task(_async_worker())
    return task_id


async def get_task_status_hybrid(task_id: str) -> Dict[str, Any]:
    """
    Checks task status across hybrid storage (in-memory / Redis cache fallback) 
    and Celery result backend.
    """
    # 1. Check local / cached task status first
    cached_status = await redis_manager.get(f"task_status:{task_id}")
    if cached_status and isinstance(cached_status, dict):
        return cached_status

    # 2. Check Celery AsyncResult safely
    try:
        from celery.result import AsyncResult
        async_result = AsyncResult(task_id, app=celery_app)
        
        status = async_result.status
        response = {
            "task_id": task_id,
            "status": status,
            "info": str(async_result.info) if async_result.info else None,
            "result": None,
            "error": None
        }

        if async_result.ready():
            if async_result.successful():
                response["result"] = async_result.result
            elif async_result.failed():
                response["error"] = str(async_result.result)

        return response
    except Exception as e:
        logger.warning(f"Failed to query Celery result for {task_id}: {e}")
        return {
            "task_id": task_id,
            "status": "PENDING",
            "info": "Task queued or processing",
            "result": None,
            "error": None
        }
