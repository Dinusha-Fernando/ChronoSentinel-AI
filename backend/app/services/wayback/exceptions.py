class WaybackServiceError(Exception):
    """Base exception for all Wayback Access Service errors."""
    pass

class SSRFValidationError(WaybackServiceError):
    """Raised when a URL/domain fails security or SSRF checks."""
    pass

class ProviderError(WaybackServiceError):
    """Raised when an archive provider fails or is unreachable."""
    pass

class CacheError(WaybackServiceError):
    """Raised when cache operations fail."""
    pass
