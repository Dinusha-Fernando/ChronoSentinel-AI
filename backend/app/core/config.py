import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env path relative to this file (works from any working directory)
_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"

class Settings(BaseSettings):
    PROJECT_NAME: str = "ChronoSentinel AI"
    API_V1_STR: str = "/api/v1"

    # Database Settings
    DATABASE_URL: str = "postgresql+asyncpg://postgres:Dinusha07postgres@localhost:5432/domain_risk"
    
    # Sync Database URL for Celery or migrations if needed
    SYNC_DATABASE_URL: str = "postgresql://postgres:Dinusha07postgres@localhost:5432/domain_risk"

    # Cache & Queue Settings
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"
    
    # Caching Layer Configuration
    CACHE_EXPIRE_SECONDS: int = 7 * 24 * 60 * 60  # 7 days

    # External API Configuration
    WAYBACK_CDX_URL: str = "https://web.archive.org/cdx/search/cdx"
    WAYBACK_SNAPSHOT_URL: str = "https://web.archive.org/web"
    WAYBACK_CDX_LIMIT: int = 1000
    MAX_SNAPSHOTS_TO_ANALYZE: int = 20  # Cap on unique snapshots to fetch/analyze per domain
    MOCK_WAYBACK: bool = False

    # ── Threat Intelligence API Keys ─────────────────────────────────────
    # Leave empty to gracefully skip that provider (no errors raised).
    VIRUSTOTAL_API_KEY: str = ""
    GOOGLE_SAFE_BROWSING_API_KEY: str = ""
    URLSCAN_API_KEY: str = ""
    ABUSEIPDB_API_KEY: str = ""

    # Proxy settings for bypassing rate limits / blocks
    # Toggle to dynamically scrape free proxies from sslproxies.org on failure
    ENABLE_PROXY_SCRAPER: bool = False
    
    # Single default proxy (used as first attempt)
    HTTP_PROXY: str = ""
    # Comma-separated list of proxy URLs to rotate through on failure.
    # Example: "http://1.2.3.4:8080,http://user:pass@5.6.7.8:3128,socks5://9.10.11.12:1080"
    HTTP_PROXY_LIST: str = ""
    # Comma-separated list of geographical country codes to scrape proxies from (e.g. "US,CA,DE" or "all")
    PROXY_COUNTRIES: str = "all"

    def get_proxy_rotation_list(self) -> list[str]:
        """Returns ordered list of proxies to try: primary first, then rotation list."""
        proxies = []
        if self.HTTP_PROXY:
            proxies.append(self.HTTP_PROXY)
        if self.HTTP_PROXY_LIST:
            for p in self.HTTP_PROXY_LIST.split(","):
                p = p.strip()
                if p and p not in proxies:
                    proxies.append(p)
        # Always include a direct (no-proxy) fallback as last resort
        if None not in proxies:
            proxies.append(None)  # type: ignore[arg-type]
        return proxies

    # User-Agent rotation settings
    USER_AGENT_LIST: list[str] = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/120.0.0.0 Edg/120.0.0.0"
    ]
    USER_AGENTS_FILE: str = str(Path(__file__).resolve().parent.parent.parent / "user_agents.txt")

    def get_user_agents(self) -> list[str]:
        """Loads User-Agents from a config file if present, otherwise returns a default list."""
        if os.path.exists(self.USER_AGENTS_FILE):
            try:
                with open(self.USER_AGENTS_FILE, "r", encoding="utf-8") as f:
                    agents = [line.strip() for line in f if line.strip()]
                    if agents:
                        return agents
            except Exception:
                pass
        return self.USER_AGENT_LIST

    # CORS settings
    ALLOWED_ORIGINS: str = "https://wayback.200m.website,http://wayback.200m.website,http://localhost,http://127.0.0.1,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,*"

    def get_allowed_origins(self) -> list[str]:
        """Returns parsed list of allowed origins, handling comma-separated string or list from env."""
        if isinstance(self.ALLOWED_ORIGINS, str):
            try:
                import json
                parsed = json.loads(self.ALLOWED_ORIGINS)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                pass
            return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]
        return self.ALLOWED_ORIGINS if isinstance(self.ALLOWED_ORIGINS, list) else ["*"]

    # ── Admin Dashboard Auth & Security ──────────────────────────────────
    JWT_SECRET_KEY: str = "changeme-replace-with-openssl-rand-hex-32"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Session & Account Security Policy
    SESSION_TIMEOUT_MINUTES: int = 60
    MAX_LOGIN_ATTEMPTS: int = 5
    ACCOUNT_LOCK_MINUTES: int = 15
    PASSWORD_MIN_LENGTH: int = 1
    PASSWORD_REQUIRE_UPPERCASE: bool = False
    PASSWORD_REQUIRE_DIGIT: bool = False
    PASSWORD_REQUIRE_SPECIAL: bool = False

    # SMTP Email Settings (optional — leave empty to disable email features)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    SMTP_FROM: str = "noreply@chronosentinel.ai"
    SMTP_TLS: bool = True

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()

