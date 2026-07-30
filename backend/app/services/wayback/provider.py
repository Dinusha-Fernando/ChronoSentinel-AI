import json
from typing import Protocol, List, Dict, Any, Optional
from backend.app.core.config import settings
from backend.app.utils.logger import logger
from backend.app.services.wayback.client import WaybackHTTPClient

class ArchiveProvider(Protocol):
    async def search(self, domain: str) -> Optional[List[Dict[str, Any]]]:
        """Query snapshot index/metadata for the domain."""
        ...

    async def get_snapshot(self, timestamp: str, url: str) -> str:
        """Fetch raw HTML content of a snapshot."""
        ...

    async def get_availability(self, url: str) -> Dict[str, Any]:
        """Check if an archive snapshot is available for a URL."""
        ...

class WaybackProvider(ArchiveProvider):
    def __init__(self, client: WaybackHTTPClient):
        self.client = client

    async def _query_cdx_raw(self, target_url: str) -> List[List[str]]:
        limit_val = getattr(settings, "WAYBACK_CDX_LIMIT", 1000)
        query_url = f"{settings.WAYBACK_CDX_URL}?url={target_url}&output=json&limit={limit_val}"
        res_text = await self.client.get(query_url, timeout=8)
        if not res_text.strip():
            return []
        try:
            return json.loads(res_text)
        except Exception as e:
            logger.error(f"Error parsing CDX JSON response for {target_url}: {e}")
            from backend.app.services.wayback.exceptions import WaybackServiceError
            raise WaybackServiceError(f"Failed to parse Wayback CDX response: {e}")

    async def search(self, domain: str) -> List[Dict[str, Any]]:
        domain_clean = domain.strip().lower()
        if getattr(settings, "MOCK_WAYBACK", False):
            logger.info(f"WaybackProvider [MOCK]: Generating mock snapshots list for {domain_clean}")
            return [
                {
                    "timestamp": "20190412120000",
                    "original": f"http://{domain_clean}/",
                    "statuscode": "200",
                    "mime": "text/html",
                    "digest": f"mockdigest2019_{domain_clean}"
                },
                {
                    "timestamp": "20210618153000",
                    "original": f"http://{domain_clean}/",
                    "statuscode": "200",
                    "mime": "text/html",
                    "digest": f"mockdigest2021_{domain_clean}"
                },
                {
                    "timestamp": "20230824091500",
                    "original": f"http://{domain_clean}/",
                    "statuscode": "200",
                    "mime": "text/html",
                    "digest": f"mockdigest2023_{domain_clean}"
                }
            ]

        domain_bare = domain_clean.removeprefix("http://").removeprefix("https://").split("/")[0]

        # Query subpath wildcards first to capture all root and subpage historical snapshots
        primary_candidates = [f"{domain_bare}/*"]
        if domain_bare.startswith("www."):
            bare_no_www = domain_bare.removeprefix("www.")
            primary_candidates.extend([f"{bare_no_www}/*", bare_no_www])
        else:
            primary_candidates.extend([f"www.{domain_bare}/*", f"www.{domain_bare}"])
        primary_candidates.append(domain_bare)

        collected_snapshots: Dict[str, Dict[str, Any]] = {}
        
        for candidate_url in primary_candidates:
            try:
                logger.info(f"WaybackProvider: Querying CDX for target pattern: {candidate_url}")
                data = await self._query_cdx_raw(candidate_url)
                if data and len(data) > 1:
                    headers_list = [h.lower() for h in data[0]]
                    for row in data[1:]:
                        snapshot_dict = dict(zip(headers_list, row))
                        ts = snapshot_dict.get("timestamp", "")
                        orig = snapshot_dict.get("original", "")
                        if ts and orig:
                            # Filter out static web asset files (.css, .js, .png, .jpg, .ico, .woff, .json, etc.)
                            orig_clean_path = orig.lower().split("?")[0]
                            if any(orig_clean_path.endswith(ext) for ext in (".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".woff", ".woff2", ".ttf", ".eot", ".xml", ".json", ".less", ".scss", ".map")):
                                continue
                            mime_val = str(snapshot_dict.get("mimetype", snapshot_dict.get("mime", ""))).lower()
                            if mime_val and not any(m in mime_val for m in ("text/html", "text/plain", "warc", "unk", "redirect")) and not mime_val.startswith("text/"):
                                continue

                            key = f"{ts}_{orig}"
                            if key not in collected_snapshots:
                                collected_snapshots[key] = {
                                    "timestamp": ts,
                                    "original": orig,
                                    "statuscode": snapshot_dict.get("statuscode", ""),
                                    "mime": mime_val or "text/html",
                                    "digest": snapshot_dict.get("digest", "")
                                }
                    # Stop querying further candidates if we have accumulated substantial snapshots (>= 20)
                    if len(collected_snapshots) >= 20:
                        break
            except Exception as candidate_err:
                logger.warning(f"WaybackProvider: CDX query for '{candidate_url}' failed: {candidate_err}")
                continue

        # Wildcard subdomain fallback only if primary queries returned zero snapshots
        if not collected_snapshots:
            wildcard_candidates = [f"*.{domain_bare}/*"]
            if domain_bare.startswith("www."):
                bare_no_www = domain_bare.removeprefix("www.")
                wildcard_candidates.append(f"*.{bare_no_www}/*")

            for w_candidate in wildcard_candidates:
                try:
                    logger.info(f"WaybackProvider: Fallback querying CDX wildcard pattern: {w_candidate}")
                    data = await self._query_cdx_raw(w_candidate)
                    if data and len(data) > 1:
                        headers_list = [h.lower() for h in data[0]]
                        for row in data[1:]:
                            snapshot_dict = dict(zip(headers_list, row))
                            ts = snapshot_dict.get("timestamp", "")
                            orig = snapshot_dict.get("original", "")
                            if ts and orig:
                                orig_clean_path = orig.lower().split("?")[0]
                                if any(orig_clean_path.endswith(ext) for ext in (".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".woff", ".woff2", ".ttf", ".eot", ".xml", ".json", ".less", ".scss", ".map")):
                                    continue
                                mime_val = str(snapshot_dict.get("mimetype", snapshot_dict.get("mime", ""))).lower()
                                if mime_val and not any(m in mime_val for m in ("text/html", "text/plain", "warc", "unk", "redirect")) and not mime_val.startswith("text/"):
                                    continue

                                key = f"{ts}_{orig}"
                                if key not in collected_snapshots:
                                    collected_snapshots[key] = {
                                        "timestamp": ts,
                                        "original": orig,
                                        "statuscode": snapshot_dict.get("statuscode", ""),
                                        "mime": mime_val or "text/html",
                                        "digest": snapshot_dict.get("digest", "")
                                    }
                        if len(collected_snapshots) >= 1:
                            break
                except Exception as candidate_err:
                    logger.warning(f"WaybackProvider: Wildcard CDX query for '{w_candidate}' failed: {candidate_err}")
                    continue

        return list(collected_snapshots.values())

    async def get_snapshot(self, timestamp: str, url: str) -> str:
        if getattr(settings, "MOCK_WAYBACK", False):
            url_lower = url.lower()
            logger.info(f"WaybackProvider [MOCK]: Returning mock HTML content for {url} at {timestamp}")
            if "redhat-gitops-patterns" in url_lower:
                return """
                <html>
                  <head>
                    <title>Best Online Casino slots and Roulette</title>
                    <meta name="description" content="online casino live casino welcome bonus slots slots slots casino casino roulette roulette">
                  </head>
                  <body>
                    <h1>Welcome to the Ultimate Casino experience!</h1>
                    <p>Place your bet now on roulette, blackjack, or video slots. Win big cash payouts online casino games!</p>
                  </body>
                </html>
                """
            elif "geld-lenen" in url_lower:
                return """
                <html>
                  <head>
                    <title>Geld Lenen Zonder BKR Toetsing</title>
                    <meta name="description" content="geld lenen bkr toetsing snel lenen lening">
                  </head>
                  <body>
                    <h1>Snel en eenvoudig geld lenen</h1>
                    <p>Wilt u geld lenen zonder BKR toetsing? Vraag vandaag nog een lening aan voor extra financiele ruimte.</p>
                  </body>
                </html>
                """
            elif "shopsocielle" in url_lower:
                return """
                <html>
                  <head>
                    <title>Shop Socielle - Online Fashion Store</title>
                    <meta name="description" content="fashion store shopping cart checkout shopping">
                  </head>
                  <body>
                    <h1>Welcome to Shop Socielle</h1>
                    <p>Add items to your cart, check out the new arrivals, and shop our latest collection.</p>
                  </body>
                </html>
                """
            elif "wikipedia.org" in url_lower:
                return "<html><head><meta name=\"description\" content=\"wikipedia safe clean educational content\"></head><body><h1>Wikipedia The Free Encyclopedia</h1><p>Clean educational content.</p></body></html>"
            else:
                return f"<html><head><meta name=\"description\" content=\"mock clean safe educational site\"></head><body><h1>Mock Homepage for {url}</h1><p>This is a safe and clean educational site.</p></body></html>"

        raw_url = f"https://web.archive.org/web/{timestamp}id_/{url}"
        logger.info(f"WaybackProvider: Fetching snapshot content for {url} at {timestamp}")
        return await self.client.get(raw_url)

    async def get_availability(self, url: str) -> Dict[str, Any]:
        if getattr(settings, "MOCK_WAYBACK", False):
            logger.info(f"WaybackProvider [MOCK]: Checking availability for {url}")
            return {
                "archived_snapshots": {
                    "closest": {
                        "available": True,
                        "url": f"https://web.archive.org/web/20230824091500/{url}",
                        "timestamp": "20230824091500"
                    }
                }
            }

        avail_url = f"https://archive.org/wayback/available?url={url}"
        logger.info(f"WaybackProvider: Checking availability for {url}")
        res_text = await self.client.get(avail_url)
        try:
            return json.loads(res_text)
        except Exception as e:
            logger.error(f"WaybackProvider: Failed to parse availability JSON: {e}")
            return {"archived_snapshots": {}}
