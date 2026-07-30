import orjson
import logging
import asyncio
import time
from typing import Optional, Any
import redis.asyncio as aioredis
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

class RedisManager:
    def __init__(self):
        self.redis: Optional[aioredis.Redis] = None
        self._fallback_cache: dict[str, tuple[Any, Optional[float]]] = {}  # key -> (value, expire_at)
        self.is_fallback: bool = False

    def connect(self) -> None:
        """Initializes the connection pool."""
        if not self.redis:
            self.redis = aioredis.from_url(
                settings.REDIS_URL, 
                encoding="utf-8", 
                decode_responses=True
            )
            logger.info("Connected to Redis successfully.")

    async def disconnect(self) -> None:
        """Closes the connection pool."""
        if self.redis:
            await self.redis.close()
            self.redis = None
            logger.info("Closed Redis connection.")

    def _get_fallback(self, key: str) -> Optional[Any]:
        """Gets value from local fallback in-memory cache if not expired."""
        if key in self._fallback_cache:
            val, expire_at = self._fallback_cache[key]
            if expire_at is None or expire_at > time.time():
                return val
            else:
                del self._fallback_cache[key]
        return None

    def _set_fallback(self, key: str, value: Any, expire_seconds: int) -> None:
        """Sets value in local fallback in-memory cache with expiration."""
        expire_at = time.time() + expire_seconds if expire_seconds > 0 else None
        self._fallback_cache[key] = (value, expire_at)

    def _delete_fallback(self, key: str) -> bool:
        """Deletes key from local fallback in-memory cache."""
        if key in self._fallback_cache:
            del self._fallback_cache[key]
            return True
        return False

    async def get(self, key: str) -> Optional[Any]:
        """Gets a deserialized JSON value from cache."""
        if self.is_fallback:
            return self._get_fallback(key)

        if not self.redis:
            self.connect()
        try:
            val = await self.redis.get(key)
            if val:
                return orjson.loads(val)
        except Exception as e:
            logger.warning(f"Redis get error for key {key}, switching to in-memory fallback: {e}")
            self.is_fallback = True
            return self._get_fallback(key)
        return None

    async def set(self, key: str, value: Any, expire_seconds: int = settings.CACHE_EXPIRE_SECONDS) -> bool:
        """Serializes and saves a value to cache with an expiration."""
        if self.is_fallback:
            self._set_fallback(key, value, expire_seconds)
            return True

        if not self.redis:
            self.connect()
        try:
            serialized = orjson.dumps(value).decode("utf-8")
            await self.redis.set(key, serialized, ex=expire_seconds)
            return True
        except Exception as e:
            logger.warning(f"Redis set error for key {key}, switching to in-memory fallback: {e}")
            self.is_fallback = True
            self._set_fallback(key, value, expire_seconds)
            return True

    async def delete(self, key: str) -> bool:
        """Deletes a key from cache."""
        if self.is_fallback:
            return self._delete_fallback(key)

        if not self.redis:
            self.connect()
        try:
            await self.redis.delete(key)
            return True
        except Exception as e:
            logger.warning(f"Redis delete error for key {key}, switching to in-memory fallback: {e}")
            self.is_fallback = True
            return self._delete_fallback(key)

    async def ping(self) -> bool:
        """Pings Redis to check connectivity. If connection fails, falls back to in-memory cache."""
        if not self.redis:
            try:
                self.connect()
            except Exception as e:
                if not self.is_fallback:
                    logger.warning(f"Redis connect failed: {e}. Switching to in-memory fallback.")
                self.is_fallback = True
                return True

        try:
            # Ping the real Redis server with a short timeout to prevent blocking/hanging
            await asyncio.wait_for(self.redis.ping(), timeout=2.0)
            if self.is_fallback:
                logger.info("Redis server is back online. Switching back to Redis from in-memory cache.")
            self.is_fallback = False
            return True
        except Exception as e:
            if not self.is_fallback:
                logger.warning(f"Redis ping error: {e}. Switching to in-memory fallback.")
            self.is_fallback = True
            return True

# Single global instance
redis_manager = RedisManager()
