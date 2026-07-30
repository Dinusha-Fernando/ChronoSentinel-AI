from typing import List, Dict, Any
from backend.app.utils.logger import logger
from backend.app.services.wayback.exceptions import WaybackServiceError
from backend.app.services.wayback.validator import validate_target
from backend.app.services.wayback.cache import WaybackCache
from backend.app.services.wayback.provider import ArchiveProvider

class WaybackAccessService:
    def __init__(self, provider: ArchiveProvider, cache: WaybackCache):
        self.provider = provider
        self.cache = cache

    async def search_snapshots(self, domain: str, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """
        Validates target domain, checks cache, queries Wayback CDX, and returns snapshot listings.
        """
        validated_domain = validate_target(domain)

        if not force_refresh:
            cached = await self.cache.get_search(validated_domain)
            if cached is not None:
                logger.info(f"WaybackAccessService: Search cache HIT for {validated_domain}")
                return cached
            logger.info(f"WaybackAccessService: Search cache MISS for {validated_domain}")

        try:
            results = await self.provider.search(validated_domain)
            if results is None:
                results = []
            
            await self.cache.set_search(validated_domain, results)
            return results
        except Exception as e:
            logger.error(f"WaybackAccessService: Error in search_snapshots: {e}")
            if isinstance(e, WaybackServiceError):
                raise
            raise WaybackServiceError(f"Failed to query snapshot indexes for {validated_domain}: {str(e)}")

    async def get_snapshot_content(self, timestamp: str, url: str, force_refresh: bool = False) -> str:
        """
        Validates snapshot URL, checks cache, fetches snapshot HTML content, and returns it.
        """
        validate_target(url)

        if not force_refresh:
            cached = await self.cache.get_snapshot(timestamp, url)
            if cached is not None:
                logger.info(f"WaybackAccessService: Snapshot cache HIT for {url} at {timestamp}")
                return cached
            logger.info(f"WaybackAccessService: Snapshot cache MISS for {url} at {timestamp}")

        try:
            html = await self.provider.get_snapshot(timestamp, url)
            
            await self.cache.set_snapshot(timestamp, url, html)
            return html
        except Exception as e:
            logger.error(f"WaybackAccessService: Error in get_snapshot_content: {e}")
            if isinstance(e, WaybackServiceError):
                raise
            raise WaybackServiceError(f"Failed to retrieve snapshot HTML: {str(e)}")

    async def check_availability(self, url: str, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Checks if a URL has archived snapshots available.
        """
        validate_target(url)

        if not force_refresh:
            cached = await self.cache.get_availability(url)
            if cached is not None:
                logger.info(f"WaybackAccessService: Availability cache HIT for {url}")
                return cached
            logger.info(f"WaybackAccessService: Availability cache MISS for {url}")

        try:
            res = await self.provider.get_availability(url)
            
            await self.cache.set_availability(url, res)
            return res
        except Exception as e:
            logger.error(f"WaybackAccessService: Error in check_availability: {e}")
            if isinstance(e, WaybackServiceError):
                raise
            raise WaybackServiceError(f"Failed to check Wayback availability: {str(e)}")
