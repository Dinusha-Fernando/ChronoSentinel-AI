from typing import List, Dict, Any, Optional
from backend.app.services.wayback import wayback_service
from backend.app.utils.logger import logger
from urllib.parse import urlparse

_USE_DEFAULT_PROXY = object()


def is_valid_snapshot(snap: Dict[str, Any]) -> bool:
    """
    Validates if a CDX snapshot is suitable for analysis.
    Accepts 200 OK, 301, 302, 303, 307, 308 redirects, 206 partial content,
    and HTML or unknown/empty mime types.
    """
    status = str(snap.get("statuscode", "")).strip()
    mime = str(snap.get("mime", "")).strip().lower()

    # Allow HTTP 200, 301, 302, 303, 307, 308, 206, and unk / empty status
    valid_status = status in ("200", "301", "302", "303", "307", "308", "206", "-") or not status

    # Exclude non-web media assets if MIME is explicitly specified
    non_web_mimes = (
        "image/", "video/", "audio/", "text/css",
        "application/javascript", "application/x-javascript", "application/pdf"
    )
    if mime and any(mime.startswith(prefix) for prefix in non_web_mimes):
        return False

    return valid_status


def filter_homepage_snapshots(raw_snapshots: List[Dict[str, Any]], domain_clean: str) -> List[Dict[str, Any]]:
    """
    Filters raw CDX snapshots for homepage and valid HTML/redirect captures.
    Falls back gracefully to prevent false '0 snapshots' results.
    """
    if not raw_snapshots:
        return []

    # 1. First pass: Homepage candidate snapshots matching valid statuses
    snapshots = []
    for snap in raw_snapshots:
        if not is_valid_snapshot(snap):
            continue

        original_url = snap.get("original", "")
        try:
            parsed = urlparse(original_url)
            path = parsed.path.rstrip("/")
            if path and path.lower() not in ["", "/", "/index.html", "/index.htm", "/index.php", "/default.aspx", "/home"]:
                continue
        except Exception:
            pass

        snapshots.append(snap)

    # 2. Second pass: Fallback to all valid web snapshots for domain
    if not snapshots:
        logger.info(f"Homepage-only filter returned 0 results for {domain_clean}. Falling back to all valid web snapshots.")
        for snap in raw_snapshots:
            if is_valid_snapshot(snap):
                snapshots.append(snap)

    # 3. Third pass: If strict validation still returned 0, return raw CDX snapshots as safety fallback
    if not snapshots and raw_snapshots:
        logger.warning(f"All filters returned 0 for {domain_clean}. Returning raw CDX snapshots as fallback.")
        return raw_snapshots

    return snapshots


async def fetch_snapshots(domain: str, proxy: str | None | object = _USE_DEFAULT_PROXY, force_refresh: bool = False) -> Optional[List[Dict[str, Any]]]:
    """
    Backward-compatible wrapper to fetch snapshot metadata routed through WaybackAccessService.
    """
    domain_clean = domain.strip().lower()
    try:
        raw_snapshots = await wayback_service.search_snapshots(domain_clean, force_refresh=force_refresh)
        return filter_homepage_snapshots(raw_snapshots, domain_clean)
    except Exception as e:
        logger.error(f"cdx_service.fetch_snapshots: Error fetching snapshots for {domain_clean}: {e}")
        return None


async def fetch_snapshots_with_proxy_rotation(domain: str, force_refresh: bool = False) -> tuple[Optional[List[Dict[str, Any]]], str | None]:
    """
    Backward-compatible wrapper with internal proxy rotation.
    """
    domain_clean = domain.strip().lower()
    try:
        raw_snapshots = await wayback_service.search_snapshots(domain_clean, force_refresh=force_refresh)
        filtered = filter_homepage_snapshots(raw_snapshots, domain_clean)
        return filtered, "WaybackAccessService"
    except Exception as e:
        logger.error(f"cdx_service.fetch_snapshots_with_proxy_rotation: Error for {domain_clean}: {e}")
        return None, None
