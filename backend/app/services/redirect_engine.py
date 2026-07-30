import re
import urllib.parse
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from bs4 import BeautifulSoup
from backend.app.utils.logger import logger

# Regexes for fallback or string cleaning
_RE_META_REFRESH = re.compile(
    r'<meta\s+http-equiv=["\']?refresh["\']?\s+content=["\']?\d*;\s*url=([^"\'\s>]+)["\']?',
    re.IGNORECASE
)

_RE_JS_ASSIGNMENT = re.compile(
    r'(?:window\.location(?:\.href)?|location\.href|location\.replace|location\.assign|top\.location)\s*=\s*["\']([^"\'\s;]+)["\']',
    re.IGNORECASE
)

_WAYBACK_ARTIFACT_KEYWORDS = [
    "__wm", "wombat.js", "playback.bundle.js", "archive.org/web/",
    "web.archive.org", "dis_arm.js", "atc.js"
]

@dataclass
class RedirectEvaluationResult:
    redirect_detected: bool = False
    redirect_target: Optional[str] = None
    redirect_method: Optional[str] = None
    redirect_confidence: int = 0
    redirect_verified: bool = False
    redirect_same_domain: bool = False
    redirect_target_status: Optional[int] = None
    evidence: List[str] = field(default_factory=list)


class URLNormalizer:
    @staticmethod
    def normalize_url(url: str) -> str:
        """Standardizes a URL string by stripping whitespace, trailing slashes, and index files."""
        if not url:
            return ""
        u = url.strip()
        if not u.startswith("http://") and not u.startswith("https://"):
            u = f"http://{u}"
        parsed = urllib.parse.urlparse(u)
        scheme = parsed.scheme.lower()
        netloc = parsed.netloc.lower()

        # Strip standard default ports
        if netloc.endswith(":80"):
            netloc = netloc[:-3]
        elif netloc.endswith(":443"):
            netloc = netloc[:-4]

        path = parsed.path.rstrip("/")
        if path.lower() in ["/index.html", "/index.htm", "/index.php", "/default.aspx"]:
            path = ""

        normalized = f"{scheme}://{netloc}{path}"
        if parsed.query:
            normalized += f"?{parsed.query}"
        return normalized

    @staticmethod
    def extract_root_domain(url_or_domain: str) -> str:
        """Extracts the registered root domain (e.g. sub.example.com -> example.com)."""
        if not url_or_domain:
            return ""
        clean = url_or_domain.strip().lower()
        if clean.startswith("http://") or clean.startswith("https://"):
            parsed = urllib.parse.urlparse(clean)
            host = parsed.netloc.split(":")[0]
        else:
            host = clean.split("/")[0].split(":")[0]

        parts = host.split(".")
        if len(parts) <= 2:
            return host

        # Common 2-part ccTLDs (e.g. .co.uk, .com.au, .gov.uk, .org.uk)
        two_part_tlds = {"co.uk", "org.uk", "gov.uk", "ac.uk", "com.au", "net.au", "co.jp", "com.br", "co.za"}
        last_two = f"{parts[-2]}.{parts[-3]}" if len(parts) >= 3 else ""
        if f"{parts[-2]}.{parts[-1]}" in two_part_tlds or (len(parts) >= 3 and last_two in two_part_tlds):
            return ".".join(parts[-3:])

        return ".".join(parts[-2:])

    @classmethod
    def is_same_root_domain(cls, url1: str, url2: str) -> bool:
        """Checks if two URLs share the exact same root registered domain."""
        d1 = cls.extract_root_domain(url1)
        d2 = cls.extract_root_domain(url2)
        return bool(d1 and d2 and d1 == d2)


class SnapshotExtractor:
    @staticmethod
    def clean_wayback_html(html: str) -> str:
        """Strips Wayback Machine toolbar scripts and injected wrappers using BeautifulSoup."""
        if not html or "<" not in html:
            return html or ""

        try:
            soup = BeautifulSoup(html, "html.parser")
            # Remove Wayback toolbar script tags & comments
            for tag in soup.find_all(["script", "link"]):
                src = tag.get("src", "") or tag.get("href", "")
                if any(kw in str(src) for kw in _WAYBACK_ARTIFACT_KEYWORDS):
                    tag.decompose()

            # Remove wayback toolbar div
            toolbar = soup.find("div", id="wm-ipp-base") or soup.find("div", id="donato")
            if toolbar:
                toolbar.decompose()

            return str(soup)
        except Exception as e:
            logger.warning(f"SnapshotExtractor.clean_wayback_html parsing error: {e}")
            return html


class RedirectEngine:
    @staticmethod
    def extract_meta_refresh(soup: BeautifulSoup) -> Optional[str]:
        """Finds <meta http-equiv="refresh"> tags using BeautifulSoup and parses the target URL."""
        try:
            meta_tags = soup.find_all("meta")
            for meta in meta_tags:
                http_equiv = meta.get("http-equiv", "")
                if http_equiv and str(http_equiv).lower() == "refresh":
                    content = meta.get("content", "")
                    if "url=" in str(content).lower():
                        parts = re.split(r'url=\s*', str(content), flags=re.IGNORECASE)
                        if len(parts) > 1:
                            target = parts[1].strip("'\" ")
                            return target
        except Exception as e:
            logger.debug(f"RedirectEngine.extract_meta_refresh error: {e}")
        return None

    @staticmethod
    def extract_js_redirect(soup: BeautifulSoup) -> Optional[str]:
        """Scans <script> tags for active JS redirect assignments while ignoring passive references."""
        try:
            script_tags = soup.find_all("script")
            for script in script_tags:
                code = script.string or script.get_text() or ""
                if not code:
                    continue
                # Skip wayback wrapper scripts
                if any(kw in code for kw in _WAYBACK_ARTIFACT_KEYWORDS):
                    continue

                for line in code.splitlines():
                    line_str = line.strip()
                    # Ignore commented lines
                    if line_str.startswith("//") or line_str.startswith("/*"):
                        continue
                    # Ignore passive references (if conditions, includes, console log)
                    if any(passive in line_str for passive in ["includes(", "indexOf(", "console.log(", "if (", "if("]):
                        continue

                    match = _RE_JS_ASSIGNMENT.search(line_str)
                    if match:
                        target = match.group(1).strip()
                        if target and not target.startswith("#") and not target.startswith("javascript:"):
                            return target
        except Exception as e:
            logger.debug(f"RedirectEngine.extract_js_redirect error: {e}")
        return None

    @classmethod
    def evaluate_redirect(
        cls,
        status_code: Optional[int],
        headers: Optional[Dict[str, str]],
        html_content: str,
        original_url: str
    ) -> RedirectEvaluationResult:
        """
        Evaluates redirect evidence using weighted scoring algorithm ($0-100%$)
        and AST/DOM analysis via BeautifulSoup.
        """
        res = RedirectEvaluationResult()
        evidence_items = []
        score = 0
        raw_target: Optional[str] = None

        norm_headers = {k.lower(): v for k, v in (headers or {}).items()}
        location_header = norm_headers.get("location")

        # 1. HTTP Status Code Evidence
        if status_code == 301:
            score += 40
            evidence_items.append("✓ HTTP 301 Permanent Redirect (+40)")
            if location_header:
                raw_target = location_header
        elif status_code in (302, 303, 307, 308):
            score += 35
            evidence_items.append(f"✓ HTTP {status_code} Temporary Redirect (+35)")
            if location_header:
                raw_target = location_header

        # 2. Location Header Evidence
        if location_header and location_header.lower() != original_url.lower():
            score += 30
            evidence_items.append(f"✓ HTTP Location Header: {location_header} (+30)")
            if not raw_target:
                raw_target = location_header

        # Parse DOM with BeautifulSoup if HTML is present
        soup = None
        if html_content and "<" in html_content:
            try:
                soup = BeautifulSoup(html_content, "html.parser")
            except Exception:
                soup = None

        # 3. Meta Refresh Evidence
        meta_target = None
        if soup:
            meta_target = cls.extract_meta_refresh(soup)
        else:
            meta_match = _RE_META_REFRESH.search(html_content or "")
            if meta_match:
                meta_target = meta_match.group(1)

        if meta_target:
            score += 25
            evidence_items.append(f"✓ Meta Refresh Tag: {meta_target} (+25)")
            if not raw_target:
                raw_target = meta_target

        # 4. JS Redirect Evidence
        js_target = None
        if soup:
            js_target = cls.extract_js_redirect(soup)
        else:
            js_match = _RE_JS_ASSIGNMENT.search(html_content or "")
            if js_match:
                js_target = js_match.group(1)

        if js_target:
            score += 20
            evidence_items.append(f"✓ JavaScript Location Script: {js_target} (+20)")
            if not raw_target:
                raw_target = js_target

        # 5. HTML Comment / Target Tag Evidence
        if html_content:
            target_comment = re.search(r'<!-- REDIRECT TARGET URL:\s*([^\s]+)\s*-->', html_content)
            if target_comment:
                comment_target = target_comment.group(1)
                score += 5
                evidence_items.append(f"✓ HTML Redirect Comment (+5)")
                if not raw_target:
                    raw_target = comment_target

        # Resolve relative redirect URLs against original URL
        resolved_target = raw_target
        if raw_target and original_url:
            resolved_target = urllib.parse.urljoin(original_url, raw_target)
            resolved_target = URLNormalizer.normalize_url(resolved_target)

        # Apply Penalties
        if resolved_target and original_url:
            if URLNormalizer.is_same_root_domain(original_url, resolved_target):
                score -= 15
                evidence_items.append("⚡ Same Root Domain Canonical Switch (-15)")
                res.redirect_same_domain = True

            if any(kw in resolved_target.lower() for kw in _WAYBACK_ARTIFACT_KEYWORDS):
                score -= 30
                evidence_items.append("⚡ Wayback Machine Toolbar Artifact Penalty (-30)")

        # Clamp confidence score 0..100
        res.redirect_confidence = max(0, min(100, score))
        res.redirect_target = resolved_target
        res.evidence = evidence_items
        res.redirect_detected = bool(resolved_target and res.redirect_confidence >= 50)

        if res.redirect_detected:
            # Build primary redirect method string
            methods = []
            if status_code in (301, 302, 303, 307, 308):
                methods.append(f"HTTP {status_code}")
            if location_header:
                methods.append("Location Header")
            if meta_target:
                methods.append("Meta Refresh")
            if js_target:
                methods.append("JS Script")
            res.redirect_method = " + ".join(methods) or "Heuristic Redirect"

        return res

    @staticmethod
    async def verify_redirect_target(target_url: str) -> tuple[bool, Optional[int]]:
        """Asynchronously verifies if the target redirect URL is reachable and returns HTTP status."""
        if not target_url or not (target_url.startswith("http://") or target_url.startswith("https://")):
            return False, None

        from backend.app.core.http_client import http_client
        session = http_client.get_session_for_proxy(None)
        try:
            async with session.head(target_url, timeout=3, allow_redirects=True, headers={"User-Agent": "Mozilla/5.0"}) as res:
                if res.status < 400:
                    return True, res.status
                return False, res.status
        except Exception:
            try:
                async with session.get(target_url, timeout=3, allow_redirects=True, headers={"User-Agent": "Mozilla/5.0"}) as res:
                    return res.status < 400, res.status
            except Exception as ex:
                logger.debug(f"RedirectEngine.verify_redirect_target failed for {target_url}: {ex}")
                return False, None
