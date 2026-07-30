"""
Threat Intelligence Service
============================
Queries external threat intelligence providers concurrently.
All providers gracefully degrade to {"status": "not_configured"} if
the API key is missing or the request fails — no exceptions propagate.

Supported providers:
  - VirusTotal       (VIRUSTOTAL_API_KEY)
  - Google Safe Browsing (GOOGLE_SAFE_BROWSING_API_KEY)
  - URLScan.io       (URLSCAN_API_KEY  — optional, search is public)
  - AbuseIPDB        (ABUSEIPDB_API_KEY)
"""

from __future__ import annotations

import asyncio
import json
import socket
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx

from backend.app.core.config import settings
from backend.app.core.proxy_utils import get_proxy_rotation_list, proxy_label
from backend.app.utils.logger import logger


# ─────────────────────────────────────────────────────────────────────────────
# Shared async HTTP client (created lazily per call to avoid lifecycle issues)
# ─────────────────────────────────────────────────────────────────────────────

_TIMEOUT = httpx.Timeout(4.0, connect=2.0)


async def _request_with_proxy_rotation(
    provider: str,
    method: str,
    url: str,
    **kwargs: Any,
) -> httpx.Response:
    """Run an HTTPX request through configured proxies, then direct fallback."""
    last_exc: Exception | None = None

    proxy_list = await get_proxy_rotation_list()
    for proxy in proxy_list:
        label = proxy_label(proxy)
        client_kwargs: Dict[str, Any] = {"timeout": _TIMEOUT}
        if proxy:
            client_kwargs["proxy"] = proxy

        try:
            async with httpx.AsyncClient(**client_kwargs) as client:
                request = getattr(client, method)
                response = await request(url, **kwargs)
            logger.debug(f"[ThreatIntel] {provider} request succeeded via {label}")
            return response
        except Exception as exc:
            last_exc = exc
            logger.warning(f"[ThreatIntel] {provider} request failed via {label}: {exc}")

    raise last_exc or RuntimeError(f"{provider} request failed for every proxy")

def _make_result(
    provider: str,
    status: str,
    confidence: Optional[float],
    verdict: str,
    raw: Any = None,
) -> Dict[str, Any]:
    return {
        "provider": provider,
        "status": status,          # "safe" | "malicious" | "suspicious" | "unknown" | "not_configured" | "error"
        "confidence": confidence,
        "verdict": verdict,
        "raw_response": json.dumps(raw, ensure_ascii=False) if raw is not None else None,
        "fetched_at": datetime.utcnow().isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# VirusTotal
# ─────────────────────────────────────────────────────────────────────────────

async def _query_virustotal(domain: str) -> Dict[str, Any]:
    key = settings.VIRUSTOTAL_API_KEY
    if not key:
        return _make_result("virustotal", "not_configured", None,
                            "VirusTotal API key not set in .env")
    try:
        headers = {"x-apikey": key, "Accept": "application/json"}
        url = f"https://www.virustotal.com/api/v3/domains/{domain}"
        resp = await _request_with_proxy_rotation("VirusTotal", "get", url, headers=headers)
        if resp.status_code == 404:
            return _make_result("virustotal", "unknown", None, "Domain not found in VirusTotal")
        resp.raise_for_status()
        data = resp.json()
        stats = data.get("data", {}).get("attributes", {}).get("last_analysis_stats", {})
        malicious = stats.get("malicious", 0)
        suspicious = stats.get("suspicious", 0)
        total = sum(stats.values()) or 1
        if malicious > 0:
            status = "malicious"
            confidence = round(malicious / total, 3)
            verdict = f"Flagged by {malicious} of {total} security vendors"
        elif suspicious > 0:
            status = "suspicious"
            confidence = round(suspicious / total, 3)
            verdict = f"Suspicious: flagged by {suspicious} vendors"
        else:
            status = "safe"
            confidence = 0.0
            verdict = f"Clean: 0 of {total} vendors flagged"
        return _make_result("virustotal", status, confidence, verdict, stats)
    except Exception as exc:
        logger.warning(f"[ThreatIntel] VirusTotal error for {domain}: {exc}")
        return _make_result("virustotal", "error", None, str(exc))


# ─────────────────────────────────────────────────────────────────────────────
# Google Safe Browsing
# ─────────────────────────────────────────────────────────────────────────────

async def _query_google_safe_browsing(domain: str) -> Dict[str, Any]:
    key = settings.GOOGLE_SAFE_BROWSING_API_KEY
    if not key:
        return _make_result("google_safe_browsing", "not_configured", None,
                            "Google Safe Browsing API key not set in .env")
    try:
        url = f"https://safebrowsing.googleapis.com/v4/threatMatches:find?key={key}"
        payload = {
            "client": {"clientId": "dhr-intelligence", "clientVersion": "2.0"},
            "threatInfo": {
                "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE",
                                "POTENTIALLY_HARMFUL_APPLICATION"],
                "platformTypes": ["ANY_PLATFORM"],
                "threatEntryTypes": ["URL"],
                "threatEntries": [{"url": f"http://{domain}/"}, {"url": f"https://{domain}/"}],
            },
        }
        resp = await _request_with_proxy_rotation("Google Safe Browsing", "post", url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        matches = data.get("matches", [])
        if matches:
            threats = list({m.get("threatType") for m in matches})
            return _make_result(
                "google_safe_browsing", "malicious", 1.0,
                f"Unsafe: {', '.join(threats)}", matches
            )
        return _make_result("google_safe_browsing", "safe", 0.0,
                            "No threats found by Google Safe Browsing", {})
    except Exception as exc:
        logger.warning(f"[ThreatIntel] Google Safe Browsing error for {domain}: {exc}")
        return _make_result("google_safe_browsing", "error", None, str(exc))


# ─────────────────────────────────────────────────────────────────────────────
# URLScan.io  (search is public; submission requires API key)
# ─────────────────────────────────────────────────────────────────────────────

async def _query_urlscan(domain: str) -> Dict[str, Any]:
    try:
        headers = {"Accept": "application/json"}
        key = settings.URLSCAN_API_KEY
        if key:
            headers["API-Key"] = key
        search_url = f"https://urlscan.io/api/v1/search/?q=domain:{domain}&size=1"
        resp = await _request_with_proxy_rotation("URLScan", "get", search_url, headers=headers)
        if resp.status_code == 429:
            return _make_result("urlscan", "unknown", None, "URLScan rate-limited")
        resp.raise_for_status()
        data = resp.json()
        results = data.get("results", [])
        if not results:
            return _make_result("urlscan", "unknown", None,
                                "No URLScan results found for this domain")
        hit = results[0]
        page = hit.get("page", {})
        verdicts = hit.get("verdicts", {}).get("overall", {})
        is_malicious = verdicts.get("malicious", False)
        score = verdicts.get("score", 0)
        screenshot_url = hit.get("screenshot")
        status = "malicious" if is_malicious else ("suspicious" if score > 50 else "safe")
        confidence = round(score / 100, 3)
        verdict = f"URLScan score: {score}/100"
        raw = {"page": page, "score": score, "screenshot": screenshot_url, "malicious": is_malicious}
        result = _make_result("urlscan", status, confidence, verdict, raw)
        result["screenshot_url"] = screenshot_url  # surface for frontend
        return result
    except Exception as exc:
        logger.warning(f"[ThreatIntel] URLScan error for {domain}: {exc}")
        return _make_result("urlscan", "error", None, str(exc))


# ─────────────────────────────────────────────────────────────────────────────
# AbuseIPDB  (resolves domain → IP first)
# ─────────────────────────────────────────────────────────────────────────────

async def _query_abuseipdb(domain: str) -> Dict[str, Any]:
    key = settings.ABUSEIPDB_API_KEY
    if not key:
        return _make_result("abuseipdb", "not_configured", None,
                            "AbuseIPDB API key not set in .env")
    try:
        # Resolve domain to IP (sync, but fast)
        try:
            ip = socket.gethostbyname(domain)
        except socket.gaierror:
            return _make_result("abuseipdb", "unknown", None,
                                "Could not resolve domain to IP")
        headers = {"Key": key, "Accept": "application/json"}
        url = "https://api.abuseipdb.com/api/v2/check"
        params = {"ipAddress": ip, "maxAgeInDays": 90, "verbose": True}
        resp = await _request_with_proxy_rotation("AbuseIPDB", "get", url, headers=headers, params=params)
        resp.raise_for_status()
        data = resp.json().get("data", {})
        score = data.get("abuseConfidenceScore", 0)
        total_reports = data.get("totalReports", 0)
        if score >= 75:
            status = "malicious"
        elif score >= 25:
            status = "suspicious"
        else:
            status = "safe"
        confidence = round(score / 100, 3)
        verdict = f"AbuseIPDB score: {score}/100 ({total_reports} reports for IP {ip})"
        return _make_result("abuseipdb", status, confidence, verdict,
                            {"ip": ip, "score": score, "reports": total_reports})
    except Exception as exc:
        logger.warning(f"[ThreatIntel] AbuseIPDB error for {domain}: {exc}")
        return _make_result("abuseipdb", "error", None, str(exc))


# ─────────────────────────────────────────────────────────────────────────────
# Public interface
# ─────────────────────────────────────────────────────────────────────────────

async def query_all_providers(domain: str) -> List[Dict[str, Any]]:
    """
    Query all threat intelligence providers concurrently.
    Returns a list of result dicts (one per provider), never raises.
    """
    logger.info(f"[ThreatIntel] Querying all providers for {domain} ...")
    results = await asyncio.gather(
        _query_virustotal(domain),
        _query_google_safe_browsing(domain),
        _query_urlscan(domain),
        _query_abuseipdb(domain),
        return_exceptions=False,
    )
    logger.info(f"[ThreatIntel] Done for {domain}: {[r['status'] for r in results]}")
    return list(results)


def overall_threat_status(results: List[Dict[str, Any]]) -> str:
    """
    Aggregate a single overall status from all provider results.
    Returns 'malicious' > 'suspicious' > 'safe' > 'unknown'.
    """
    statuses = {r.get("status") for r in results}
    if "malicious" in statuses:
        return "malicious"
    if "suspicious" in statuses:
        return "suspicious"
    if "safe" in statuses:
        return "safe"
    return "unknown"


