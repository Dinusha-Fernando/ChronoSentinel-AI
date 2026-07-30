from typing import Optional, Any
from backend.app.core.redis import redis_manager

class WaybackCache:
    """
    Tiered caching implementation for Wayback Access Service.
    Configures specific TTLs (Time-To-Live) for different types of queries:
    - Search metadata: 24 Hours
    - Raw snapshot HTML: 7 Days
    - Availability checks: 24 Hours
    """
    
    TTL_SEARCH = 24 * 60 * 60       # 24 hours
    TTL_SNAPSHOT = 7 * 24 * 60 * 60 # 7 days
    TTL_AVAIL = 24 * 60 * 60        # 24 hours

    def _clean_key(self, key: str) -> str:
        return key.strip().lower()

    async def get_search(self, domain: str) -> Optional[Any]:
        key = f"wayback:search:{self._clean_key(domain)}"
        return await redis_manager.get(key)

    async def set_search(self, domain: str, data: Any) -> bool:
        key = f"wayback:search:{self._clean_key(domain)}"
        return await redis_manager.set(key, data, expire_seconds=self.TTL_SEARCH)

    async def get_snapshot(self, timestamp: str, url: str) -> Optional[str]:
        key = f"wayback:snapshot:{timestamp}:{self._clean_key(url)}"
        return await redis_manager.get(key)

    async def set_snapshot(self, timestamp: str, url: str, html: str) -> bool:
        key = f"wayback:snapshot:{timestamp}:{self._clean_key(url)}"
        return await redis_manager.set(key, html, expire_seconds=self.TTL_SNAPSHOT)

    async def get_availability(self, url: str) -> Optional[Any]:
        key = f"wayback:availability:{self._clean_key(url)}"
        return await redis_manager.get(key)

    async def set_availability(self, url: str, data: Any) -> bool:
        key = f"wayback:availability:{self._clean_key(url)}"
        return await redis_manager.set(key, data, expire_seconds=self.TTL_AVAIL)
