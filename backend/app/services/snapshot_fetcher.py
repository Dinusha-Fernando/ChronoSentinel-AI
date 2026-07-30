import asyncio
import re
from typing import Optional, Tuple, Dict
from backend.app.core.config import settings
from backend.app.utils.logger import logger
from backend.app.services.wayback import wayback_service
from backend.app.services.redirect_engine import RedirectEngine, SnapshotExtractor, RedirectEvaluationResult


def build_snapshot_url(timestamp: str, url: str) -> str:
    """Constructs the Wayback Machine archive URL for a snapshot."""
    clean_url = url
    if "web.archive.org/web/" in url:
        parts = url.split("/web/")
        if len(parts) > 1:
            subparts = parts[1].split("/", 1)
            if len(subparts) > 1:
                clean_url = subparts[1]

    return f"{settings.WAYBACK_SNAPSHOT_URL}/{timestamp}/{clean_url}"


def evaluate_5tier_redirect_priority(
    status_code: int | None,
    headers: dict | None,
    html_content: str,
    original_url: str
) -> tuple[bool, str | None, str]:
    """
    Backward-compatible wrapper. Delegates to RedirectEngine for weighted evidence scoring
    and AST/DOM analysis.
    """
    eval_res = RedirectEngine.evaluate_redirect(status_code, headers, html_content, original_url)
    return eval_res.redirect_detected, eval_res.redirect_target, eval_res.redirect_method or "None"


async def fetch_snapshot_html(timestamp: str, original_url: str, domain: str) -> str:
    """
    Fetches raw snapshot HTML content from the Wayback Machine
    and cleans Wayback toolbar artifacts using SnapshotExtractor.
    Never merges target HTML strings into the original snapshot HTML.
    """
    try:
        raw_html = await wayback_service.get_snapshot_content(timestamp, original_url)
        return SnapshotExtractor.clean_wayback_html(raw_html)
    except Exception as e:
        logger.error(f"snapshot_fetcher.fetch_snapshot_html: Failed to fetch snapshot {timestamp} for {original_url}: {e}")
        return ""


async def fetch_live_domain_html(domain: str) -> tuple[str, str | None]:
    """
    Fetches the current homepage HTML for a domain.
    Cleaned independently using SnapshotExtractor.
    """
    domain_clean = domain.strip().lower().removeprefix("http://").removeprefix("https://").strip("/")
    if not domain_clean:
        return "", None

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    from backend.app.core.http_client import http_client
    from backend.app.core.proxy_utils import is_socks_proxy, proxy_label

    proxy_list = settings.get_proxy_rotation_list()
    for proxy in proxy_list:
        label = proxy_label(proxy)
        session = http_client.get_session_for_proxy(proxy)
        for url in (f"https://{domain_clean}/", f"http://{domain_clean}/"):
            try:
                request_kwargs = {
                    "headers": headers,
                    "timeout": 5,
                    "allow_redirects": True
                }
                if proxy and not is_socks_proxy(proxy):
                    request_kwargs["proxy"] = proxy

                async with session.get(url, **request_kwargs) as res:
                    content_type = res.headers.get("content-type", "")
                    if res.status < 400 and ("html" in content_type or not content_type):
                        logger.debug(f"Fetched live homepage for {domain_clean} via {label}")
                        raw_text = await res.text(errors="ignore")
                        final_url = str(res.url)
                        cleaned_html = SnapshotExtractor.clean_wayback_html(raw_text)
                        return cleaned_html, final_url
                    logger.warning(
                        f"Live homepage returned status {res.status} ({content_type}) for {url} via {label}"
                    )
            except asyncio.TimeoutError:
                logger.warning(f"Timeout fetching live homepage for {url} via {label}")
            except Exception as e:
                logger.warning(f"Error fetching live homepage for {url} via {label}: {e}")

        logger.warning(f"Live homepage fetch failed via {label}; trying next proxy for {domain_clean}")

    return "", None
