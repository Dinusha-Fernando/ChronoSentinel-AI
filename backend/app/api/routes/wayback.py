from fastapi import APIRouter, Query, HTTPException, Response
from typing import List
from backend.app.services.wayback import wayback_service, SSRFValidationError, WaybackServiceError
from backend.app.schemas.wayback_schema import WaybackSearchResponse, WaybackAvailabilityResponse
from backend.app.utils.logger import logger

router = APIRouter()

@router.get("/search", response_model=List[WaybackSearchResponse])
async def search_snapshots(
    domain: str = Query(..., description="The target domain to search index entries for"),
    force_refresh: bool = Query(False, description="Force fetching fresh data, bypassing cache")
):
    """
    Search historical snapshot indexes for a domain.
    """
    try:
        results = await wayback_service.search_snapshots(domain, force_refresh)
        return results
    except SSRFValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except WaybackServiceError as e:
        logger.error(f"API Error in search_snapshots: {e}")
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/snapshot")
async def get_snapshot(
    timestamp: str = Query(..., description="Snapshot timestamp"),
    url: str = Query(..., description="Original URL of the snapshot"),
    force_refresh: bool = Query(False, description="Bypass cache and force fetch snapshot content")
):
    """
    Retrieve raw HTML content of a specific snapshot.
    Injects a visual Security Warning banner if redirected to gaming or adult threat networks.
    """
    try:
        html = await wayback_service.get_snapshot_content(timestamp, url, force_refresh)
        
        # Check if the HTML content or target contains gambling/adult redirect signatures
        import re
        has_redirect = bool(re.search(r'(?:window\.location|location\.href|http-equiv=["\']?refresh)', html, re.I))
        has_spam_niche = bool(re.search(r'\b(?:casino|slots?|roulette|baccarat|poker|jackpot|betting|gambling|porn|adult|erotic|sex|bkr\s+toetsing|geld\s+lenen)\b', html, re.I))

        if has_redirect and has_spam_niche:
            warning_banner = (
                '<div style="background: linear-gradient(90deg, #dc2626, #b91c1c); color: white; padding: 14px 20px; '
                'text-align: center; font-family: system-ui, -apple-system, sans-serif; font-weight: 700; font-size: 14px; '
                'letter-spacing: 0.5px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); position: sticky; top: 0; z-index: 9999999; '
                'border-bottom: 2px solid #f87171;">'
                '⚠️ CHRONOSENTINEL SECURITY WARNING: THIS SNAPSHOT REDIRECTS TO AN EXPIRED DOMAIN GAMBLING / ADULT SPAM NETWORK'
                '</div>\n'
            )
            html = warning_banner + html

        return Response(content=html, media_type="text/html")
    except SSRFValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except WaybackServiceError as e:
        logger.error(f"API Error in get_snapshot: {e}")
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/availability", response_model=WaybackAvailabilityResponse)
async def check_availability(
    url: str = Query(..., description="The target URL to check availability"),
    force_refresh: bool = Query(False, description="Bypass cache and check fresh availability")
):
    """
    Check if Wayback has archived snapshots of a target URL.
    """
    try:
        raw_res = await wayback_service.check_availability(url, force_refresh)
        closest = raw_res.get("archived_snapshots", {}).get("closest", {})
        return WaybackAvailabilityResponse(
            url=url,
            available=closest.get("available", False),
            snapshot_url=closest.get("url"),
            timestamp=closest.get("timestamp")
        )
    except SSRFValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except WaybackServiceError as e:
        logger.error(f"API Error in check_availability: {e}")
        raise HTTPException(status_code=502, detail=str(e))
