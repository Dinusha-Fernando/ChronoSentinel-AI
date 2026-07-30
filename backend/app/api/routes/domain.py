import asyncio
import time
import re
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, Optional
import json

from backend.app.core.database import get_db
from backend.app.core.dependencies import get_optional_user
from backend.app.schemas.domain_schema import DomainRequest, DomainAnalysisResponse, DomainAnalysisSubmitResponse
from backend.app.schemas.response_schema import BulkAnalysisRequest, BulkAnalysisResponse
from backend.app.services.pipeline import analyze_domain_pipeline
from backend.app.models.domain import Domain
from backend.app.models.scan_record import ScanRecord, ScanSource
from backend.app.models.user import User
from backend.app.workers.tasks import analyze_multiple_domains_task, analyze_domain_task
from backend.app.utils.logger import logger

router = APIRouter()


def _enrich_snapshots_with_ai(result: Any) -> Any:
    """
    Parse each snapshot's `extraction_metadata` JSON string into the
    structured `ai_intelligence` field expected by the API schema.
    Accepts both dict items and Snapshot ORM objects safely.
    """
    if isinstance(result, dict):
        snapshots = result.get("snapshots", [])
    else:
        snapshots = getattr(result, "snapshots", [])

    for snap in snapshots:
        raw_meta = snap.get("extraction_metadata") if isinstance(snap, dict) else getattr(snap, "extraction_metadata", None)
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
            existing_ai = snap.get("ai_intelligence") if isinstance(snap, dict) else getattr(snap, "ai_intelligence", None)
            if not existing_ai:
                if isinstance(snap, dict):
                    snap["ai_intelligence"] = None
                else:
                    setattr(snap, "ai_intelligence", None)
    return result


from fastapi.responses import HTMLResponse, Response

@router.get("/proxy-snapshot", response_class=HTMLResponse)
async def proxy_snapshot(timestamp: str, url: str, redirect_url: Optional[str] = None):
    """
    Proxies Wayback Machine snapshot HTML content through the backend so that users 
    blocked from direct archive.org access can view snapshot iframe previews.
    Automatically follows redirect targets to render destination snapshot content.
    Injects a <base href> tag, anti-breakout script, and redirect notification banner.
    """
    from backend.app.services.wayback import wayback_service
    import urllib.parse

    try:
        target_url = url
        resolved_redirect_url = None
        if redirect_url:
            resolved_redirect_url = urllib.parse.urljoin(url, redirect_url)

        # 1. First check if redirect target or original URL is cached in Redis (0ms response)
        html_content = None
        if resolved_redirect_url and resolved_redirect_url != url:
            try:
                html_content = await wayback_service.cache.get_snapshot(timestamp, resolved_redirect_url)
                if html_content:
                    target_url = resolved_redirect_url
            except Exception:
                pass

        if not html_content:
            try:
                html_content = await wayback_service.cache.get_snapshot(timestamp, url)
            except Exception:
                pass

        # 2. Fetch with fast 2.5s timeout if not pre-cached
        if not html_content:
            try:
                fetch_url = resolved_redirect_url if (resolved_redirect_url and resolved_redirect_url != url) else url
                html_content = await asyncio.wait_for(wayback_service.get_snapshot_content(timestamp=timestamp, url=fetch_url), timeout=2.5)
                if resolved_redirect_url:
                    target_url = resolved_redirect_url
            except Exception as fetch_err:
                logger.warning(f"Proxy snapshot: Fast fetch timeout/failed for {url} at {timestamp}: {fetch_err}")
                # Try original URL fallback if redirect fetch timed out
                if resolved_redirect_url:
                    try:
                        html_content = await asyncio.wait_for(wayback_service.get_snapshot_content(timestamp=timestamp, url=url), timeout=1.5)
                    except Exception:
                        pass

        # 3. If snapshot HTML failed to fetch or timed out, render direct Wayback inline fallback iframe immediately
        if not html_content:
            final_target = resolved_redirect_url or url
            wayback_direct = f"https://web.archive.org/web/{timestamp}id_/{final_target}"
            fallback_html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <base href="{wayback_direct}" target="_blank">
  <style>
    body {{ margin: 0; padding: 0; background: #0b0f19; color: #94a3b8; font-family: sans-serif; overflow: hidden; }}
    iframe {{ width: 100%; height: 100vh; border: none; }}
  </style>
</head>
<body>
  <iframe src="{wayback_direct}" loading="eager" sandbox="allow-same-origin allow-scripts"></iframe>
</body>
</html>"""
            return HTMLResponse(content=fallback_html)

        # 4. Strip meta-refresh auto-redirect tags to prevent automatic browser navigation
        html_content = re.sub(r'<meta\s+http-equiv=["\']?refresh["\']?[^>]*>', '', html_content, flags=re.IGNORECASE)

        # 5. Strip defunct 10-year-old analytics and tracking scripts that hang connection pools
        defunct_trackers_pattern = r'<script[^>]*src=["\']?https?://[^"\'>]*(?:quantserve|socialtwist|addthis|scorecardresearch|chartbeat|googletagservices|outbrain|taboola)[^"\'>]*["\']?[^>]*>\s*</script>'
        html_content = re.sub(defunct_trackers_pattern, '', html_content, flags=re.IGNORECASE)

        # 6. Upgrade insecure http:// image and media URLs to https:// to prevent Mixed Content warnings
        html_content = re.sub(r'src=["\']http://', 'src="https://', html_content, flags=re.IGNORECASE)

        # 7. Build the Wayback base URL for this target snapshot so relative links resolve correctly
        wayback_base = f"https://web.archive.org/web/{timestamp}id_/{target_url}"
        base_tag = f'<base href="{wayback_base}" target="_blank">'

        # 8. Inject anti-breakout security script & global error handler to suppress uncaught errors from dead scripts
        security_script = """<script>
(function() {
    window.onerror = function() { return true; };
    try { Object.defineProperty(window, 'top', { get: function() { return window.self; } }); } catch(e) {}
    try { Object.defineProperty(window, 'parent', { get: function() { return window.self; } }); } catch(e) {}
    window.open = function() { console.warn('ChronoSentinel: Blocked popup window.'); return null; };
})();
</script>"""

        # 9. Optional Redirect Target Banner injection
        redirect_banner = ""
        display_target = redirect_url or (target_url if target_url != url else None)
        if display_target:
            redirect_banner = f"""<div style="background: linear-gradient(90deg, #1e1b4b 0%, #31104b 100%); border: 1px solid rgba(139,92,246,0.4); color: #e2e8f0; padding: 10px 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; display: flex; align-items: center; justify-content: space-between; border-radius: 8px; margin: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.4); z-index: 999999; relative: true;">
    <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
        <span style="background: #f43f5e; color: #ffffff; font-weight: 800; padding: 2px 6px; border-radius: 4px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em;">REDIRECT DESTINATION LOADED</span>
        <span style="color: #cbd5e1; font-weight: 600;">Target:</span>
        <a href="{display_target}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: underline; font-weight: 700; word-break: break-all;">{display_target}</a>
    </div>
</div>"""

        injection = base_tag + security_script

        if "<head>" in html_content.lower():
            idx = html_content.lower().find("<head>")
            insert_pos = idx + len("<head>")
            html_content = html_content[:insert_pos] + injection + html_content[insert_pos:]
        else:
            html_content = injection + html_content

        if redirect_banner:
            if "<body" in html_content.lower():
                body_idx = html_content.lower().find("<body")
                closing_gt = html_content.find(">", body_idx)
                if closing_gt != -1:
                    insert_pos = closing_gt + 1
                    html_content = html_content[:insert_pos] + redirect_banner + html_content[insert_pos:]
            else:
                html_content = redirect_banner + html_content

        headers = {
            "X-Frame-Options": "SAMEORIGIN",
            "Content-Security-Policy": "frame-ancestors 'self';",
        }
        return HTMLResponse(content=html_content, headers=headers)
    except Exception as e:
        logger.error(f"Error proxying snapshot for {url} at {timestamp}: {e}")
        # Return a styled error page instead of a 500 that breaks the iframe
        error_html = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Captured HTTP Error / Snapshot Preview</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #94a3b8;
         display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }}
  .box {{ text-align: center; padding: 2.5rem; border: 1px solid #1e293b; border-radius: 16px; max-width: 460px; background: #0f172a; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }}
  .icon {{ font-size: 2.5rem; margin-bottom: 1rem; }}
  h2 {{ color: #f8fafc; font-size: 1.25rem; font-weight: 600; margin: 0 0 0.5rem 0; }}
  p {{ font-size: 0.9rem; line-height: 1.5; color: #94a3b8; margin: 0 0 1.25rem 0; }}
  .badge {{ display: inline-block; padding: 0.25rem 0.75rem; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; margin-bottom: 1rem; }}
  a {{ display: inline-block; padding: 0.6rem 1.2rem; background: #3b82f6; color: #ffffff; font-weight: 500; font-size: 0.85rem; border-radius: 8px; text-decoration: none; transition: all 0.2s; }}
  a:hover {{ background: #2563eb; }}
  .err-detail {{ font-size: 11px; margin-top: 1.25rem; color: #64748b; word-break: break-all; }}
</style></head>
<body><div class="box">
  <div class="badge">SERVER CAPTURE NOTICE</div>
  <div class="icon">⚠️</div>
  <h2>Captured Server Error / Dead Snapshot</h2>
  <p>This historical capture was recorded while the domain returned an HTTP error (e.g. 503 Service Unavailable / 404) or was unreachable.</p>
  <a href="https://web.archive.org/web/{timestamp}/{url}" target="_blank">Open on Wayback Machine ↗</a>
  <div class="err-detail">{str(e)[:150]}</div>
</div></body></html>"""
        return HTMLResponse(content=error_html, status_code=200)


from backend.app.services.task_dispatcher import (
    dispatch_single_domain_analysis,
    dispatch_bulk_domain_analysis,
)

@router.post("/analyze", response_model=DomainAnalysisSubmitResponse)
async def analyze_domain(
    request: DomainRequest,
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Submits a domain scan job for background analysis.
    Uses Celery when active, or falls back seamlessly to background async task runner.
    Returns the task ID immediately.
    """
    try:
        logger.info(f"Received analysis request for: {request.domain}")
        task_id = await dispatch_single_domain_analysis(
            request.domain, 
            request.force_refresh, 
            current_user.id if current_user else None
        )
        return DomainAnalysisSubmitResponse(
            task_id=task_id,
            message="Analysis successfully queued in the background."
        )
    except Exception as e:
        logger.error(f"Failed to queue domain analysis for {request.domain}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to queue background job: {str(e)}"
        )


@router.post("/bulk-analyze", response_model=BulkAnalysisResponse)
async def bulk_analyze_domains(request: BulkAnalysisRequest):
    """
    Submits a list of domains for background processing.
    Uses Celery when active, or falls back seamlessly to background async task runner.
    Returns a task ID immediately.
    """
    if not request.domains:
        raise HTTPException(status_code=400, detail="Domain list cannot be empty")
        
    try:
        task_id = await dispatch_bulk_domain_analysis(request.domains)
        logger.info(f"Triggered bulk analysis task {task_id} for domains: {request.domains}")
        return BulkAnalysisResponse(
            task_id=task_id,
            message="Bulk analysis successfully queued in the background."
        )
    except Exception as e:
        logger.error(f"Failed to queue bulk analysis: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to queue background job: {str(e)}"
        )

@router.get("/stats")
async def get_domain_stats(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Fetches aggregate statistics regarding analyzed domains, risk levels, and recent records.
    Enriches each domain with user details (or fallback to active inspector).
    """
    try:
        # Query total count and risk level counts
        total_stmt = select(func.count(Domain.id))
        total_res = await db.execute(total_stmt)
        total_count = total_res.scalar() or 0

        # Query counts grouped by risk level
        group_stmt = select(Domain.risk_level, func.count(Domain.id)).group_by(Domain.risk_level)
        group_res = await db.execute(group_stmt)
        breakdown = {row[0]: row[1] for row in group_res.all()}

        # Ensure all risk categories are present in breakdown
        for level in ["SAFE", "MEDIUM", "HIGH", "UNSAFE", "UNKNOWN"]:
            if level not in breakdown:
                breakdown[level] = 0

        # Determine default fallback user info if scan record user is null
        fallback_user_data = None
        if current_user:
            fallback_user_data = {
                "user_id": current_user.id,
                "username": current_user.username,
                "full_name": current_user.full_name,
            }
        else:
            first_user_res = await db.execute(select(User).order_by(User.id.asc()).limit(1))
            first_user = first_user_res.scalar_one_or_none()
            if first_user:
                fallback_user_data = {
                    "user_id": first_user.id,
                    "username": first_user.username,
                    "full_name": first_user.full_name,
                }

        # Fetch every analyzed domain so dashboard widgets reflect the full DB catalog.
        recent_stmt = select(Domain).order_by(Domain.last_analyzed_at.desc())
        recent_res = await db.execute(recent_stmt)
        domain_objs = recent_res.scalars().all()

        domain_names = [d.name for d in domain_objs]
        user_map: dict[str, dict[str, Any]] = {}
        
        if domain_names:
            scan_stmt = (
                select(ScanRecord.domain_name, User.id, User.username, User.full_name)
                .join(User, ScanRecord.user_id == User.id)
                .where(ScanRecord.domain_name.in_(domain_names))
                .order_by(ScanRecord.checked_at.desc())
            )
            scan_res = await db.execute(scan_stmt)
            for d_name, u_id, username, full_name in scan_res.all():
                if d_name not in user_map:  # First record is the latest user check
                    user_map[d_name] = {
                        "user_id": u_id,
                        "username": username,
                        "full_name": full_name,
                    }

        recent_domains = [
            {
                "domain": d.name,
                "risk_score": d.risk_score,
                "risk_level": d.risk_level,
                "last_analyzed_at": d.last_analyzed_at.isoformat(),
                "checked_by": user_map.get(d.name, fallback_user_data)
            }
            for d in domain_objs
        ]

        return {
            "total_analyzed": total_count,
            "risk_breakdown": breakdown,
            "recent_domains": recent_domains
        }
    except Exception as e:
        logger.error(f"Error querying statistics: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to query database statistics"
        )
