import socket
from urllib.parse import urlparse
import ipaddress
from backend.app.services.wayback.exceptions import SSRFValidationError

# Block common cloud metadata hostnames
FORBIDDEN_HOSTS = {
    "localhost", "loopback", "metadata.google.internal", "instance-data",
    "metadata", "kubernetes.default.svc"
}

def is_ip_private(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
        return (
            ip.is_private or
            ip.is_loopback or
            ip.is_link_local or
            ip.is_multicast or
            ip.is_reserved or
            ip.is_unspecified
        )
    except ValueError:
        return True

def validate_target(url_or_domain: str) -> str:
    """
    Validates a domain name or URL to prevent SSRF and loopback requests.
    Returns a cleaned, validated hostname or raises SSRFValidationError.
    """
    if not url_or_domain:
        raise SSRFValidationError("Input URL or domain cannot be empty.")

    cleaned = url_or_domain.strip().lower()
    
    # Extract hostname / domain
    if "://" in cleaned:
        parsed = urlparse(cleaned)
        # Block non-HTTP protocols
        if parsed.scheme not in ("http", "https"):
            raise SSRFValidationError(f"Protocol '{parsed.scheme}' is not allowed. Only HTTP/HTTPS is supported.")
        hostname = parsed.hostname
    else:
        # Just a raw domain/IP
        hostname = cleaned

    if not hostname:
        raise SSRFValidationError("Could not extract a valid hostname from the input.")

    # Remove port if specified
    if ":" in hostname:
        hostname = hostname.split(":")[0]

    # Block forbidden hostnames directly
    if hostname in FORBIDDEN_HOSTS or any(fh in hostname for fh in (".local", ".lan", ".internal")):
        raise SSRFValidationError(f"Access to hostname '{hostname}' is blocked for security reasons.")

    # DNS Resolution & IP check
    try:
        # Get list of IP addresses resolved by DNS
        addrinfo = socket.getaddrinfo(hostname, None)
        for _, _, _, _, sockaddr in addrinfo:
            ip_str = sockaddr[0]
            if is_ip_private(ip_str):
                raise SSRFValidationError(f"IP address '{ip_str}' resolved from '{hostname}' is in a blocked private or loopback range.")
    except socket.gaierror:
        # Resolve failed, could be an offline address or invalid domain.
        # We allow it to proceed because offline/expired domains can still be queried via Wayback CDX API.
        pass
    except SSRFValidationError:
        raise
    except Exception as e:
        raise SSRFValidationError(f"Error validating hostname '{hostname}': {str(e)}")

    return hostname
