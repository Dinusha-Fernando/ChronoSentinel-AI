from backend.app.services.wayback.exceptions import (
    WaybackServiceError,
    SSRFValidationError,
    ProviderError,
    CacheError,
)
from backend.app.services.wayback.client import WaybackHTTPClient
from backend.app.services.wayback.provider import WaybackProvider
from backend.app.services.wayback.cache import WaybackCache
from backend.app.services.wayback.service import WaybackAccessService

# Initialize concrete components
_client = WaybackHTTPClient()
_provider = WaybackProvider(_client)
_cache = WaybackCache()

# Instantiate the global service instance
wayback_http_client = _client
wayback_service = WaybackAccessService(_provider, _cache)

__all__ = [
    "wayback_http_client",
    "wayback_service",
    "WaybackServiceError",
    "SSRFValidationError",
    "ProviderError",
    "CacheError",
]

