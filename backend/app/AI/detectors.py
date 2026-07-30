"""
Multi-Level Threat Detector Registry — ChronoSentinel AI Engine
==================================================================
Provides a pluggable detector registry. Each detector is a callable
that accepts (html_content, cleaned_text, classification_result)
and returns a dict of supplemental signals. The pipeline can run all
detectors and merge their output into a unified threat intelligence record.

Built-in detectors (all rule-based, no network calls):
  - ExternalLinkDensityDetector   – ratio of outbound links to total links
  - HiddenElementDetector         – detects CSS/style-hidden content
  - FormDetector                  – counts forms (login, payment, etc.)
  - PhoneNumberDetector           – international phone number patterns
  - CryptoWalletDetector          – common crypto wallet address patterns
  - URLObfuscationDetector        – suspicious URL patterns (hex, %-encoding)
  - ContentLengthDetector         – very short or suspiciously long pages
"""

from __future__ import annotations

import re
from typing import Any, Callable, Dict, List

from backend.app.AI.classifier import ClassificationResult
from backend.app.utils.logger import logger


# ─────────────────────────────────────────────────────────────────────────────
# Type alias
# ─────────────────────────────────────────────────────────────────────────────

DetectorFn = Callable[[str, str, ClassificationResult], Dict[str, Any]]


# ─────────────────────────────────────────────────────────────────────────────
# Helper patterns  (compiled once at import time)
# ─────────────────────────────────────────────────────────────────────────────

_RE_HREF = re.compile(r'href=["\']?(https?://[^"\'>\s]+)', re.IGNORECASE)
_RE_EXTERNAL = re.compile(r'https?://(?!(?:web\.archive\.org))[^"\'>\s]+', re.IGNORECASE)
_RE_HIDDEN_CSS = re.compile(
    r'(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0)',
    re.IGNORECASE,
)
_RE_FORM = re.compile(r'<form\b', re.IGNORECASE)
_RE_INPUT_PWD = re.compile(r'type=["\']?password["\']?', re.IGNORECASE)
_RE_PHONE = re.compile(
    r'(?:\+?\d[\d\s\-\(\)]{7,}\d)',
)
_RE_CRYPTO_BTC = re.compile(r'\b(1|3)[a-zA-HJ-NP-Z1-9]{25,34}\b')
_RE_CRYPTO_ETH = re.compile(r'\b0x[0-9a-fA-F]{40}\b')
_RE_URL_OBFUSC = re.compile(r'(%[0-9a-fA-F]{2}){3,}')
_RE_IFRAME = re.compile(r'<iframe\b', re.IGNORECASE)
_RE_REDIRECT_JS = re.compile(
    r'(?:window\.location|document\.location|location\.href)\s*=', re.IGNORECASE
)


# ─────────────────────────────────────────────────────────────────────────────
# Built-in Detectors
# ─────────────────────────────────────────────────────────────────────────────

def external_link_density_detector(
    html: str, text: str, clf: ClassificationResult
) -> Dict[str, Any]:
    """Measures what fraction of links point to external domains."""
    total_hrefs = len(_RE_HREF.findall(html))
    external = len(_RE_EXTERNAL.findall(html))
    ratio = round(external / total_hrefs, 3) if total_hrefs else 0.0
    return {
        "detector": "external_link_density",
        "total_links": total_hrefs,
        "external_links": external,
        "density_ratio": ratio,
        "signal": "medium" if ratio > 0.85 and total_hrefs > 20 else "low",
    }


def hidden_element_detector(
    html: str, text: str, clf: ClassificationResult
) -> Dict[str, Any]:
    """Detects elements hidden via CSS (responsive navigation menus / cloaking)."""
    count = len(_RE_HIDDEN_CSS.findall(html))
    return {
        "detector": "hidden_elements",
        "hidden_count": count,
        "signal": "medium" if count > 15 else "low",
    }


def form_detector(
    html: str, text: str, clf: ClassificationResult
) -> Dict[str, Any]:
    """Counts HTML forms and detects password fields (phishing indicator on non-safe pages)."""
    form_count = len(_RE_FORM.findall(html))
    has_password = bool(_RE_INPUT_PWD.search(html))
    is_suspicious_form = has_password and form_count > 0 and clf.primary_category not in ("safe", "unknown") and clf.confidence >= 0.35
    return {
        "detector": "forms",
        "form_count": form_count,
        "has_password_field": has_password,
        "signal": "high" if is_suspicious_form else ("medium" if form_count > 3 else "low"),
    }


def phone_number_detector(
    html: str, text: str, clf: ClassificationResult
) -> Dict[str, Any]:
    """Finds phone number patterns (common in scam / gambling sites)."""
    phones = _RE_PHONE.findall(text)
    unique = list(set(phones))[:5]
    return {
        "detector": "phone_numbers",
        "count": len(phones),
        "samples": unique,
        "signal": "medium" if len(phones) > 2 else "low",
    }


def crypto_wallet_detector(
    html: str, text: str, clf: ClassificationResult
) -> Dict[str, Any]:
    """Detects cryptocurrency wallet addresses (fraud / scam indicator)."""
    btc = _RE_CRYPTO_BTC.findall(text)
    eth = _RE_CRYPTO_ETH.findall(text)
    total = len(btc) + len(eth)
    samples = (btc + eth)[:3]
    return {
        "detector": "crypto_wallets",
        "btc_addresses": len(btc),
        "eth_addresses": len(eth),
        "samples": samples,
        "signal": "high" if total > 0 else "low",
    }


def url_obfuscation_detector(
    html: str, text: str, clf: ClassificationResult
) -> Dict[str, Any]:
    """Detects heavy URL percent-encoding (common in malware redirectors)."""
    hits = _RE_URL_OBFUSC.findall(html)
    return {
        "detector": "url_obfuscation",
        "obfuscated_url_count": len(hits),
        "signal": "high" if len(hits) > 3 else ("medium" if len(hits) > 0 else "low"),
    }


def content_length_detector(
    html: str, text: str, clf: ClassificationResult
) -> Dict[str, Any]:
    """Flags extremely short or extremely long pages."""
    word_count = len(text.split())
    if word_count < 50:
        signal = "medium"   # very sparse content — possible placeholder/doorway
    elif word_count > 20_000:
        signal = "medium"   # unusually large page
    else:
        signal = "low"
    return {
        "detector": "content_length",
        "word_count": word_count,
        "signal": signal,
    }


_RE_GAMBLING_KEYWORDS = re.compile(
    r'\b(?:casino|slots?|roulette|baccarat|poker|jackpot|betting|gambling|online\s+casino|slot\s+gacor|pragmatic\s+play|judi\s+online|bkr\s+toetsing|geld\s+lenen)\b',
    re.IGNORECASE,
)
_RE_ADULT_KEYWORDS = re.compile(
    r'\b(?:porn|adult|erotic|sex|nude|camgirl|hentai|xx+|breast|strip-poker)\b',
    re.IGNORECASE,
)
_RE_META_REFRESH = re.compile(
    r'<meta\s+http-equiv=["\']?refresh["\']?\s+content=["\']?\d+;\s*url=',
    re.IGNORECASE,
)


def iframe_redirect_detector(
    html: str, text: str, clf: ClassificationResult
) -> Dict[str, Any]:
    """Detects iframes and JS redirects (drive-by download / cloaking)."""
    iframe_count = len(_RE_IFRAME.findall(html))
    js_redirects = len(_RE_REDIRECT_JS.findall(html))
    signal = "high" if (iframe_count > 2 or js_redirects > 1) else (
        "medium" if (iframe_count > 0 or js_redirects > 0) else "low"
    )
    return {
        "detector": "iframe_redirects",
        "iframe_count": iframe_count,
        "js_redirect_count": js_redirects,
        "signal": signal,
    }


def repurposed_domain_redirect_detector(
    html: str, text: str, clf: ClassificationResult, redirect_url: Optional[str] = None
) -> Dict[str, Any]:
    """Detects expired/dead domains repurposed into gaming, casino, or adult redirectors."""
    js_redirects = len(_RE_REDIRECT_JS.findall(html))
    meta_redirects = len(_RE_META_REFRESH.findall(html))
    
    # Combine body text and redirect target URL for keyword scanning
    combined_scan = f"{text} {redirect_url or ''}".lower()
    gambling_hits = len(_RE_GAMBLING_KEYWORDS.findall(combined_scan))
    adult_hits = len(_RE_ADULT_KEYWORDS.findall(combined_scan))

    has_redirect = (js_redirects > 0 or meta_redirects > 0 or bool(redirect_url))
    has_spam_niche = (gambling_hits > 0 or adult_hits > 0)

    is_repurposed_redirect = (has_redirect and has_spam_niche) or (gambling_hits > 3 or adult_hits > 3)

    signal = "high" if is_repurposed_redirect else ("medium" if (has_redirect or has_spam_niche) else "low")

    return {
        "detector": "repurposed_domain_redirect",
        "has_redirect": has_redirect,
        "js_redirects": js_redirects,
        "meta_redirects": meta_redirects,
        "redirect_url": redirect_url,
        "gambling_keyword_hits": gambling_hits,
        "adult_keyword_hits": adult_hits,
        "is_repurposed_redirect": is_repurposed_redirect,
        "target_niche": "gambling" if gambling_hits >= adult_hits and gambling_hits > 0 else ("adult" if adult_hits > 0 else "unknown"),
        "signal": signal,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Registry
# ─────────────────────────────────────────────────────────────────────────────

_REGISTRY: List[DetectorFn] = [
    external_link_density_detector,
    hidden_element_detector,
    form_detector,
    phone_number_detector,
    crypto_wallet_detector,
    url_obfuscation_detector,
    content_length_detector,
    iframe_redirect_detector,
    repurposed_domain_redirect_detector,
]


def run_all_detectors(
    html_content: str,
    cleaned_text: str,
    classification: ClassificationResult,
    redirect_url: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Execute every registered detector and return the list of signal dicts.
    Passes redirect_url to detectors inspecting redirect destinations.
    """
    results: List[Dict[str, Any]] = []
    for detector_fn in _REGISTRY:
        try:
            if detector_fn.__name__ == "repurposed_domain_redirect_detector":
                result = detector_fn(html_content, cleaned_text, classification, redirect_url=redirect_url)
            else:
                result = detector_fn(html_content, cleaned_text, classification)
            results.append(result)
        except Exception as exc:
            logger.warning(
                f"[Detectors] {detector_fn.__name__} raised an error: {exc}"
            )
            results.append({
                "detector": detector_fn.__name__,
                "error": str(exc),
                "signal": "low",
            })
    return results


def high_signal_count(detector_results: List[Dict[str, Any]]) -> int:
    """Return how many detectors fired with a 'high' signal."""
    return sum(1 for d in detector_results if d.get("signal") == "high")
