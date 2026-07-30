import asyncio
import nest_asyncio
import time
import json
from typing import Any
from datetime import datetime, timedelta
from sqlalchemy import delete
from backend.app.workers.celery_worker import celery_app
from backend.app.core.database import AsyncSessionLocal
from backend.app.models.user import User
from backend.app.models.login_history import LoginHistory
from backend.app.models.activity_log import ActivityLog
from backend.app.models.notification import Notification
from backend.app.models.scan_record import ScanRecord, ScanSource
from backend.app.models.domain import Domain
from backend.app.models.snapshot import Snapshot
from backend.app.models.analysis import AnalysisFlag
from backend.app.models.timeline import DomainTimeline
from backend.app.models.threat_intel import ThreatIntelligence
from backend.app.models.system_settings import SystemSettings
from backend.app.services.pipeline import analyze_domain_pipeline
from backend.app.services.cdx_service import fetch_snapshots_with_proxy_rotation
from backend.app.utils.logger import logger

def _run_async(coro):
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    if loop.is_closed():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    if loop.is_running():
        nest_asyncio.apply()

    return loop.run_until_complete(coro)

def _snap_get(snap: Any, key: str, default: Any = None) -> Any:
    if isinstance(snap, dict):
        return snap.get(key, default)
    return getattr(snap, key, default)

def _to_int(val: Any, default: int = 0) -> int:
    if val is None:
        return default
    try:
        s = str(val).strip()
        if s.isdigit():
            return int(s)
    except Exception:
        pass
    return default


def _pick_evidence_snapshot(result: Any) -> dict | None:
    if isinstance(result, dict):
        snapshots = result.get("snapshots") or []
    else:
        snapshots = getattr(result, "snapshots", []) or []

    unsafe = [
        snap for snap in snapshots
        if _snap_get(snap, "evidence_url") and (_to_int(_snap_get(snap, "risk_score", 0)) >= 40 or _snap_get(snap, "flags"))
    ]
    if not unsafe:
        return None

    snap = max(unsafe, key=lambda item: _to_int(_snap_get(item, "risk_score", 0)))
    flags_val = _snap_get(snap, "flags", []) or []
    if not isinstance(flags_val, list):
        flags_val = []

    flags_list = []
    for f in flags_val:
        if isinstance(f, dict):
            flags_list.append(f)
        else:
            flags_list.append({
                "category": getattr(f, "category", None),
                "keyword": getattr(f, "keyword", None),
                "weight": getattr(f, "weight", 0),
                "match_count": getattr(f, "match_count", 1)
            })

    return {
        "timestamp": _snap_get(snap, "timestamp"),
        "original_url": _snap_get(snap, "original_url"),
        "risk_score": _snap_get(snap, "risk_score"),
        "evidence_url": _snap_get(snap, "evidence_url"),
        "flags": flags_list,
    }

def _enrich_snapshots_with_ai(result: Any) -> Any:
    if isinstance(result, dict):
        snapshots = result.get("snapshots", [])
    else:
        snapshots = getattr(result, "snapshots", []) or []

    for snap in snapshots:
        raw_meta = _snap_get(snap, "extraction_metadata")
        if raw_meta and isinstance(raw_meta, str):
            try:
                parsed = json.loads(raw_meta)
                clf = parsed.get("classifier", {})
                ai_dict = {
                    "primary_category": clf.get("primary_category"),
                    "confidence": clf.get("confidence"),
                    "all_scores": clf.get("all_scores"),
                    "detected_language": clf.get("detected_language"),
                    "summary": clf.get("summary"),
                    "detectors": parsed.get("detectors"),
                    "detector_boost": parsed.get("detector_boost"),
                }
                if isinstance(snap, dict):
                    snap["ai_intelligence"] = ai_dict
                else:
                    setattr(snap, "ai_intelligence", ai_dict)
            except Exception:
                if isinstance(snap, dict):
                    snap["ai_intelligence"] = None
                else:
                    setattr(snap, "ai_intelligence", None)
        else:
            existing_ai = _snap_get(snap, "ai_intelligence")
            if not existing_ai:
                if isinstance(snap, dict):
                    snap["ai_intelligence"] = None
                else:
                    setattr(snap, "ai_intelligence", None)
    return result

async def run_analyze_domain(domain: str, force_refresh: bool = False, user_id: int | None = None) -> dict:
    """
    Async implementation of single domain analysis.
    """
    logger.info(f"Initiating analysis for {domain} (User ID: {user_id})")
    start_time = time.monotonic()

    async with AsyncSessionLocal() as db:
        result = await analyze_domain_pipeline(domain, force_refresh, db)
        enriched = _enrich_snapshots_with_ai(result)

        # Record the scan for admin history
        duration_ms = int((time.monotonic() - start_time) * 1000)
        try:
            scan_rec = ScanRecord(
                domain_name=domain,
                user_id=user_id,
                status="completed",
                risk_score=enriched.get("risk_score"),
                risk_level=enriched.get("risk_level"),
                duration_ms=duration_ms,
                source=ScanSource.manual if user_id else ScanSource.anonymous,
                wayback_status="fetched" if enriched.get("snapshots") else "no_data",
            )
            db.add(scan_rec)
            await db.commit()
        except Exception as scan_err:
            logger.warning(f"Failed to record scan history in background task: {scan_err}")
            await db.rollback()

        return enriched


@celery_app.task(name="tasks.analyze_domain")
def analyze_domain_task(domain: str, force_refresh: bool = False, user_id: int | None = None) -> dict:
    """
    Celery task wrapper for single domain analysis.
    """
    return _run_async(run_analyze_domain(domain, force_refresh, user_id))


async def run_analyze_multiple_domains(domains: list[str], force_refresh: bool = False) -> list[dict]:
    """
    Async implementation of batch domain analysis with rate limiting and progress tracking.
    """
    total_count = len(domains)
    logger.info(f"Initiating bulk analysis for {total_count} domains")
    semaphore = asyncio.Semaphore(2)  # Process up to 2 domains concurrently to stay within Wayback rate limits

    async def analyze_one(idx: int, d: str) -> dict:
        d_clean = d.strip().lower().removeprefix("http://").removeprefix("https://").split("/")[0]
        # Stagger domain startup times to prevent simultaneous burst to Wayback CDX API
        if idx > 0:
            await asyncio.sleep(idx * 0.4)

        async with semaphore:
            try:
                async with AsyncSessionLocal() as db:
                    res = await analyze_domain_pipeline(d_clean, force_refresh, db)
                    return {
                        "domain": res["domain"],
                        "status": "success",
                        "risk_score": res["risk_score"],
                        "risk_level": res["risk_level"],
                        "flags": res.get("flags", []),
                        "primary_category": res.get("primary_category", ""),
                        "category_confidence": res.get("category_confidence", {}),
                        "snapshots_checked": res.get("snapshots_checked", 0),
                        "risk_narrative": res.get("risk_narrative", ""),
                        "evidence_snapshot": _pick_evidence_snapshot(res),
                        "proxy_used": res.get("cdx_proxy_used"),
                    }
            except Exception as first_err:
                logger.warning(
                    f"[Batch] First attempt failed for {d}: {first_err}. Retrying with proxy rotation..."
                )
                from backend.app.services import cdx_service as _cdx_mod
                from backend.app.services import pipeline as _pipe_mod

                _original_fetch = _cdx_mod.fetch_snapshots
                rotated_result = None
                proxy_succeeded = None

                try:
                    snapshots_found, proxy_used = await fetch_snapshots_with_proxy_rotation(d)
                    if snapshots_found is not None:
                        async def _patched_fetch(domain, proxy=None):
                            return snapshots_found

                        _cdx_mod.fetch_snapshots = _patched_fetch
                        _pipe_mod.fetch_snapshots = _patched_fetch

                        try:
                            async with AsyncSessionLocal() as db2:
                                rotated_result = await analyze_domain_pipeline(d, force_refresh, db2)
                                proxy_succeeded = proxy_used
                        finally:
                            _cdx_mod.fetch_snapshots = _original_fetch
                            _pipe_mod.fetch_snapshots = _original_fetch
                    else:
                        logger.error(f"[Batch] All proxy rotation attempts failed for {d}.")
                except Exception as rotation_err:
                    _cdx_mod.fetch_snapshots = _original_fetch
                    _pipe_mod.fetch_snapshots = _original_fetch
                    logger.error(f"[Batch] Proxy rotation error for {d}: {rotation_err}")

                if rotated_result:
                    return {
                        "domain": rotated_result["domain"],
                        "status": "success",
                        "risk_score": rotated_result["risk_score"],
                        "risk_level": rotated_result["risk_level"],
                        "flags": rotated_result.get("flags", []),
                        "primary_category": rotated_result.get("primary_category", ""),
                        "category_confidence": rotated_result.get("category_confidence", {}),
                        "snapshots_checked": rotated_result.get("snapshots_checked", 0),
                        "risk_narrative": rotated_result.get("risk_narrative", ""),
                        "evidence_snapshot": _pick_evidence_snapshot(rotated_result),
                        "proxy_used": rotated_result.get("cdx_proxy_used", proxy_succeeded),
                    }

                error_reason = str(first_err)
                if "rate-limit" in error_reason.lower() or "429" in error_reason:
                    clean_reason = "Wayback Machine CDX API is currently rate-limiting queries."
                elif "unreachable" in error_reason.lower() or "timeout" in error_reason.lower():
                    clean_reason = "Wayback Machine CDX API timed out or is temporarily unreachable."
                else:
                    clean_reason = f"Could not fetch domain history or live site: {error_reason}"

                return {
                    "domain": d,
                    "status": "failed",
                    "error": clean_reason,
                    "risk_score": 0,
                    "risk_level": "UNKNOWN",
                    "flags": [],
                    "primary_category": "",
                    "category_confidence": {},
                    "snapshots_checked": 0,
                    "risk_narrative": clean_reason,
                    "evidence_snapshot": None,
                    "proxy_used": None,
                }

    task_results = await asyncio.gather(*[analyze_one(i, d) for i, d in enumerate(domains)], return_exceptions=True)
    results = [res for res in task_results if isinstance(res, dict)]
    return results


@celery_app.task(name="tasks.analyze_multiple_domains")
def analyze_multiple_domains_task(domains: list[str], force_refresh: bool = False) -> list[dict]:
    """
    Celery task wrapper for batch domain analysis.
    """
    return _run_async(run_analyze_multiple_domains(domains, force_refresh))

@celery_app.task(name="tasks.cleanup_old_domains")
def cleanup_old_domains_task() -> int:
    """
    Celery task that deletes domains, activity logs, and login histories older than 30 days.
    """
    logger.info("[Celery Task] Initiating background database cleanup for records older than 30 days")

    async def run_cleanup():
        cutoff_date = datetime.utcnow() - timedelta(days=30)
        async with AsyncSessionLocal() as db:
            # Prune old domains
            stmt = delete(Domain).where(Domain.last_analyzed_at < cutoff_date)
            result = await db.execute(stmt)
            dom_deleted = result.rowcount

            # Prune old activity logs
            act_stmt = delete(ActivityLog).where(ActivityLog.created_at < cutoff_date)
            act_res = await db.execute(act_stmt)
            act_deleted = act_res.rowcount

            # Prune old login history
            lh_stmt = delete(LoginHistory).where(LoginHistory.login_at < cutoff_date)
            lh_res = await db.execute(lh_stmt)
            lh_deleted = lh_res.rowcount

            await db.commit()
            return dom_deleted, act_deleted, lh_deleted

    deleted_info = _run_async(run_cleanup())
    logger.info(f"[Celery Task] Database cleanup complete. Deleted {deleted_info[0]} domains, {deleted_info[1]} activity logs, {deleted_info[2]} login history records.")
    return deleted_info[0]

@celery_app.task(name="tasks.update_working_proxies")
def update_working_proxies_task() -> list[str]:
    """
    Celery task that scrapes and tests free proxies, storing the verified working
    ones in Redis so that actual analysis pipelines can fetch them instantly.
    """
    logger.info("[Celery Task] Scraped proxy auto-refresh and validation task started...")

    async def run_update():
        from backend.app.core.proxy_utils import find_working_proxies
        from backend.app.core.redis import redis_manager

        working = await find_working_proxies()
        await redis_manager.set("scraped_working_proxies", working, expire_seconds=86400)  # cache for 1 day
        logger.info(f"[Celery Task] Scraped working proxy pool updated: {len(working)} verified proxies cached in Redis.")
        return working

    return _run_async(run_update())


