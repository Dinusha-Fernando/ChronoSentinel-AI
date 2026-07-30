
import asyncio
import re
import datetime
import json
from typing import List, Dict, Any, Optional
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.config import settings
from backend.app.core.redis import redis_manager
from backend.app.models.domain import Domain
from backend.app.models.snapshot import Snapshot
from backend.app.models.analysis import AnalysisFlag
from backend.app.models.timeline import DomainTimeline
from backend.app.models.threat_intel import ThreatIntelligence
from backend.app.services.cdx_service import fetch_snapshots_with_proxy_rotation
from backend.app.services.snapshot_fetcher import fetch_snapshot_html, fetch_live_domain_html
from backend.app.services.analyzer import analyze_snapshot_content, get_language
from backend.app.services.risk_engine import select_snapshots_to_check, compute_overall_risk
from backend.app.services.timeline_service import build_timeline, get_primary_category
from backend.app.services.threat_intel import query_all_providers, overall_threat_status
from backend.app.AI.classifier import classify_content, result_to_metadata_json
from backend.app.AI.detectors import run_all_detectors, high_signal_count
from backend.app.AI.explainer import build_explanation, detect_benign_content_niche
from backend.app.utils.logger import logger

def safe_int(val: Any, default: int = 0) -> int:
    """Safely converts any string or numeric value to integer, ignoring non-digit characters like '-'."""
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return int(val)
    try:
        s = str(val).strip()
        if s.isdigit() or (s.startswith("-") and s[1:].isdigit()):
            return int(s)
        import re as _re
        digits = _re.sub(r"[^\d-]", "", s)
        if digits and digits != "-":
            return int(digits)
    except Exception:
        pass
    return default


def safe_parse_status_code(status_code_val: Any, default: int = 200) -> int:
    """Safely parses status code strings ('200', '302', '-', None, '') to integer."""
    if not status_code_val:
        return default
    try:
        s = str(status_code_val).strip()
        if s.isdigit():
            return int(s)
        import re as _re
        digits = _re.sub(r"\D", "", s)
        if digits:
            return int(digits)
    except Exception:
        pass
    return default


def get_snapshot_key(snap: dict) -> str:
    """Helper to return a uniform lookup key for a snapshot dict across analysis mapping."""
    st_val = str(snap.get("statuscode", "200"))
    if st_val.startswith("4") or st_val.startswith("5"):
        return f"err_{st_val}:{snap.get('timestamp')}"
    digest = snap.get("digest")
    if digest and digest != "-" and str(digest).lower() != "none":
        return digest
    return f"ts_{snap.get('timestamp')}"


def strip_wayback_toolbar(html: str) -> str:
    """Strips Archive.org injected header toolbar (#wm-ipp-base) and comment blocks from snapshot HTML."""
    if not html:
        return ""
    cleaned = re.sub(r'<!--\s*BEGIN WAYBACK TOOLBAR INSERT\s*-->.*?<!--\s*END WAYBACK TOOLBAR INSERT\s*-->', '', html, flags=re.DOTALL | re.IGNORECASE)
    cleaned = re.sub(r'<div[^>]*id=["\']wm-ipp-base["\'][^>]*>.*?</div>\s*</div>\s*</div>', '', cleaned, flags=re.DOTALL | re.IGNORECASE)
    return cleaned


def build_snapshot_evidence_url(timestamp: str, original_url: str, risk_score: int, flags: list, source: str = "archive") -> str | None:
    """Return a visual evidence URL for snapshots that crossed an unsafe threshold."""
    if risk_score < 40 and not flags:
        return None
    if not original_url:
        return None
    if source == "live":
        return original_url
    return f"https://web.archive.org/web/{timestamp}if_/{original_url}"


async def analyze_domain_pipeline(domain: str, force_refresh: bool, db: AsyncSession) -> dict:
    """
    Coordinates the entire domain analysis process.
    1. Checks Redis cache.
    2. Checks PostgreSQL DB (and checks if stale).
    3. Runs CDX search, fetches content, computes risk, and saves.
    """
    domain_clean = domain.strip().lower().removeprefix("http://").removeprefix("https://").split("/")[0]
    cache_key = f"domain_analysis:{domain_clean}"

    # 1. Check Redis Cache
    if not force_refresh:
        cached_result = await redis_manager.get(cache_key)
        if cached_result:
            logger.info(f"Cache HIT for domain: {domain_clean}")
            return cached_result
        logger.info(f"Cache MISS for domain: {domain_clean}")

    # 2. Check PostgreSQL DB
    query = (
        select(Domain)
        .options(
            selectinload(Domain.snapshots).selectinload(Snapshot.flags),
            selectinload(Domain.timeline),
            selectinload(Domain.threat_intel),
        )
        .where(Domain.name == domain_clean)
    )
    result = await db.execute(query)
    db_domain = result.scalar_one_or_none()

    if db_domain and not force_refresh:
        # Check if the analysis is fresh (within 7 days)
        age = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - db_domain.last_analyzed_at
        if age.days < 7:
            logger.info(f"Database HIT (fresh analysis) for domain: {domain_clean}")
            # Format and return from DB
            response_data = format_domain_response(db_domain)
            # Re-populate cache
            await redis_manager.set(cache_key, response_data)
            return response_data
        logger.info(f"Database analysis for {domain_clean} is STALE ({age.days} days old). Re-analyzing.")

    # 3. Fetch snapshots list from CDX, rotating proxies before failing.
    raw_snapshots, cdx_proxy_used = await fetch_snapshots_with_proxy_rotation(domain_clean, force_refresh=force_refresh)
    if cdx_proxy_used:
        logger.info(f"CDX snapshots for {domain_clean} succeeded via proxy: {cdx_proxy_used}")

    if raw_snapshots is None:
        if db_domain:
            logger.warning(f"Wayback Machine CDX API is unreachable for {domain_clean}. Falling back to existing database record.")
            return format_domain_response(db_domain)
        logger.warning(f"Wayback CDX API unreachable for {domain_clean}. Saving default safe record.")
        db_domain = await save_empty_domain(domain_clean, db)
        db_domain.risk_narrative = "Wayback Machine CDX API was temporarily unreachable. Marked as 0 snapshots."
        empty_response = format_domain_response(db_domain)
        await redis_manager.set(cache_key, empty_response)
        return empty_response

    if len(raw_snapshots) == 0:
        # Save a default safe/empty record to database
        logger.info(f"No archive snapshots found for {domain_clean} on Wayback Machine.")
        db_domain = await save_empty_domain(domain_clean, db)
        empty_response = format_domain_response(db_domain)
        await redis_manager.set(cache_key, empty_response)
        return empty_response

    # 4. Chronologically sort snapshots
    sorted_snapshots = select_snapshots_to_check(raw_snapshots)

    # Group snapshots by digest to de-duplicate fetches.
    # For HTTP error snapshots (503, 500, 404, etc.), key by status code + timestamp so error events are preserved.
    digests_map = {}
    for snap in sorted_snapshots:
        digest_val = get_snapshot_key(snap)
        digests_map.setdefault(digest_val, []).append(snap)

    # For each unique digest, select the latest snapshot.
    all_unique_snapshots = []
    for digest_val, snaps_group in digests_map.items():
        all_unique_snapshots.append(snaps_group[-1])

    # Sort chronologically to sample accurately
    all_unique_snapshots.sort(key=lambda s: s["timestamp"])

    # Threat-Aware Smart Sampling Strategy:
    # 1. De-duplicates identical captures via digest.
    # 2. If unique snapshots count > MAX_SNAPSHOTS_TO_ANALYZE, prioritizes high-risk signals:
    #    - All HTTP Redirect snapshots (301, 302, 307, 308) — key indicator of domain hijacking/phishing
    #    - Live homepage capture
    #    - Digest transition points (moments when site content changed)
    # 3. Fills remaining quota with uniform chronological samples across the history.
    max_to_analyze = settings.MAX_SNAPSHOTS_TO_ANALYZE
    if len(all_unique_snapshots) <= max_to_analyze:
        unique_snapshots_to_fetch = all_unique_snapshots
    else:
        prioritized_snaps = {}

        # a) Always include live snapshot
        live_snap = next((s for s in all_unique_snapshots if s.get("source") == "live"), None)
        if live_snap:
            prioritized_snaps[live_snap["timestamp"]] = live_snap

        # b) Always include HTTP redirect snapshots (301/302/307/308)
        for s in all_unique_snapshots:
            st_code = str(s.get("statuscode", ""))
            if st_code in ("301", "302", "303", "307", "308"):
                prioritized_snaps[s["timestamp"]] = s

        # c) Always include first and last historical snapshots
        if all_unique_snapshots:
            prioritized_snaps[all_unique_snapshots[0]["timestamp"]] = all_unique_snapshots[0]
            prioritized_snaps[all_unique_snapshots[-1]["timestamp"]] = all_unique_snapshots[-1]

        # d) Fill remaining capacity with uniform chronological samples
        if len(prioritized_snaps) < max_to_analyze:
            total_unique = len(all_unique_snapshots)
            step = (total_unique - 1) / (max_to_analyze - 1) if max_to_analyze > 1 else 1
            sample_indices = sorted(list(set(int(round(i * step)) for i in range(max_to_analyze))))
            for idx in sample_indices:
                snap_item = all_unique_snapshots[idx]
                prioritized_snaps[snap_item["timestamp"]] = snap_item

        unique_snapshots_to_fetch = list(prioritized_snaps.values())
        unique_snapshots_to_fetch.sort(key=lambda s: s["timestamp"])
        logger.info(
            f"Domain {domain_clean} has {len(all_unique_snapshots)} unique snapshots. "
            f"Threat-aware sampling selected {len(unique_snapshots_to_fetch)} high-priority snapshots (redirects, transitions & uniform timeline samples)."
        )

    # 5. Fetch and analyze snapshot HTML contents sequentially in chronological order
    async def fetch_and_analyze(snap: dict) -> dict:
        timestamp = snap["timestamp"]
        original = snap["original"]
        status = safe_parse_status_code(snap.get("statuscode"), 200)
        mime = snap.get("mime", "text/html")

        # Short-circuit archived HTTP 4xx / 5xx error pages (404 Not Found, 500 Server Error) -> 0 Risk
        if str(status).startswith("4") or str(status).startswith("5"):
            metadata = {
                "status": "error_page",
                "status_code": status,
                "classifier": {
                    "primary_category": "safe",
                    "confidence": 1.0,
                    "all_scores": {},
                    "detected_language": "en",
                    "summary": f"Archived HTTP {status} error page.",
                },
                "detectors": {},
                "evidence_url": None
            }
            return {
                "timestamp": timestamp,
                "original_url": original,
                "status_code": status,
                "redirect_url": None,
                "is_redirect": False,
                "mime_type": mime,
                "risk_score": 0,
                "detected_language": "en",
                "category_scores": {},
                "flags": [],
                "content_category": "safe",
                "category_confidence": 1.0,
                "content_summary": f"Archived HTTP {status} error page (safe).",
                "extraction_metadata": json.dumps(metadata, ensure_ascii=False),
                "evidence_url": None,
                "redirect_detected": False,
                "redirect_method": None,
                "redirect_confidence": 0,
                "redirect_verified": False,
                "redirect_same_domain": False,
                "redirect_target": None,
                "redirect_target_status": None,
                "redirect_target_category": None,
                "redirect_target_risk": 0,
                "original_category": "safe",
                "original_risk": 0,
                "redirect_evidence": [],
            }

        # Fetch HTML content independently
        html_content = snap.get("html_content")
        if html_content is None:
            html_content = await fetch_snapshot_html(timestamp, original, domain_clean)

        # Strip Archive.org injected toolbar header to prevent scanning Wayback internal banner text
        if html_content:
            html_content = strip_wayback_toolbar(html_content)

        # Pre-cache snapshot HTML so UI proxy_snapshot endpoint loads instantly (0ms network delay)
        if html_content:
            try:
                from backend.app.services.wayback import wayback_service
                await wayback_service.cache.set_snapshot(timestamp, original, html_content)
            except Exception as _c_err:
                logger.debug(f"Pre-cache snapshot HTML skipped: {_c_err}")

        # 1. Run RedirectEngine to gather 5-tier weighted evidence
        from backend.app.services.redirect_engine import RedirectEngine
        from backend.app.services.risk_engine import RiskDecisionEngine

        redirect_eval = RedirectEngine.evaluate_redirect(status, None, html_content or "", original)

        # Verify reachability of target URL asynchronously if redirect detected
        target_html: Optional[str] = None
        if redirect_eval.redirect_detected and redirect_eval.redirect_target:
            is_verified, target_status = await RedirectEngine.verify_redirect_target(redirect_eval.redirect_target)
            redirect_eval.redirect_verified = is_verified
            redirect_eval.redirect_target_status = target_status
            if "web.archive.org" in redirect_eval.redirect_target or redirect_eval.redirect_target:
                target_html = await fetch_snapshot_html(timestamp, redirect_eval.redirect_target, domain_clean)
                if target_html:
                    target_html = strip_wayback_toolbar(target_html)
                    try:
                        from backend.app.services.wayback import wayback_service
                        await wayback_service.cache.set_snapshot(timestamp, redirect_eval.redirect_target, target_html)
                    except Exception as _c_err:
                        logger.debug(f"Pre-cache redirect target HTML skipped: {_c_err}")

        # If download failed and no redirect detected, return unavailable (0 Risk)
        if not html_content and not redirect_eval.redirect_detected:
            metadata = {
                "status": "unavailable",
                "reason": "Download failed across all proxy attempts",
                "image_detections": [],
                "classifier": {
                    "primary_category": "safe",
                    "confidence": 0.0,
                    "all_scores": {},
                    "detected_language": "en",
                    "summary": "Snapshot unavailable",
                },
                "detectors": {},
                "detector_boost": 0,
                "evidence_url": None
            }
            return {
                "timestamp": timestamp,
                "original_url": original,
                "status_code": status,
                "redirect_url": redirect_eval.redirect_target,
                "is_redirect": redirect_eval.redirect_detected,
                "mime_type": mime,
                "risk_score": 0,
                "detected_language": "en",
                "category_scores": {},
                "flags": [],
                "content_category": "unavailable",
                "category_confidence": 0.0,
                "content_summary": "Snapshot unavailable or failed to download.",
                "extraction_metadata": json.dumps(metadata, ensure_ascii=False),
                "evidence_url": None,
                "redirect_detected": False,
                "redirect_method": None,
                "redirect_confidence": 0,
                "redirect_verified": False,
                "redirect_same_domain": False,
                "redirect_target": None,
                "redirect_target_status": None,
                "redirect_target_category": None,
                "redirect_target_risk": 0,
                "original_category": "unavailable",
                "original_risk": 0,
                "redirect_evidence": [],
            }

            metadata = {
                "status": "unavailable",
                "reason": "Download failed across all proxy attempts",
                "image_detections": [],
                "classifier": {
                    "primary_category": "safe",
                    "confidence": 0.0,
                    "all_scores": {},
                    "detected_language": "en",
                    "summary": "Snapshot unavailable",
                },
                "detectors": {},
                "detector_boost": 0,
                "evidence_url": None
            }
            return {
                "timestamp": timestamp,
                "original_url": original,
                "status_code": status,
                "redirect_url": redirect_eval.redirect_target,
                "is_redirect": redirect_eval.redirect_detected,
                "mime_type": mime,
                "risk_score": 0,
                "detected_language": "en",
                "category_scores": {},
                "flags": [],
                "content_category": "unavailable",
                "category_confidence": 0.0,
                "content_summary": "Snapshot unavailable or failed to download.",
                "extraction_metadata": json.dumps(metadata, ensure_ascii=False),
                "evidence_url": None,
                "redirect_detected": False,
                "redirect_method": None,
                "redirect_confidence": 0,
                "redirect_verified": False,
                "redirect_same_domain": False,
                "redirect_target": None,
                "redirect_target_status": None,
                "redirect_target_category": None,
                "redirect_target_risk": 0,
                "original_category": "unavailable",
                "original_risk": 0,
                "redirect_evidence": [],
            }

        # 2. Run RiskDecisionEngine for independent classification & Dual Risk Matrix
        dual_risk = RiskDecisionEngine.evaluate_dual_risk(html_content or "", target_html, redirect_eval, domain_clean)

        # Legacy keyword analyzer for flags enrichment
        risk_score, category_scores, flags = analyze_snapshot_content(html_content, domain_clean)

        # AI Classifier on original text
        from backend.app.utils.text_cleaner import clean_html_content
        cleaned_text = clean_html_content(html_content).lower()
        lang = get_language(cleaned_text)

        clf_result = classify_content(html_content, domain_clean)

        # Structural Detectors (inspecting HTML structure and redirect target URL)
        detector_results = run_all_detectors(html_content, cleaned_text, clf_result, redirect_url=redirect_eval.redirect_target)
        high_signals = high_signal_count(detector_results)

        # Final risk score calculation combining Dual Risk Engine + verified redirect threats
        final_risk_score = max(risk_score, dual_risk.final_risk_score)

        if redirect_eval.redirect_detected and dual_risk.redirect_target_category in ("gambling", "adult", "phishing", "phishing_scam", "malware", "malware_hacking"):
            final_risk_score = max(final_risk_score, 85)

        evidence_url = build_snapshot_evidence_url(
            timestamp, original, final_risk_score, flags, snap.get("source", "archive")
        )

        metadata = {
            "status": "success",
            "classifier": {
                "primary_category": dual_risk.primary_category,
                "confidence": dual_risk.category_confidence,
                "all_scores": clf_result.all_scores,
                "detected_language": clf_result.detected_language,
                "summary": dual_risk.risk_narrative or dual_risk.summary,
            },
            "detectors": detector_results,
            "evidence_url": evidence_url,
            "redirect_engine": {
                "confidence": redirect_eval.redirect_confidence,
                "method": redirect_eval.redirect_method,
                "verified": redirect_eval.redirect_verified,
                "same_domain": redirect_eval.redirect_same_domain,
                "target": redirect_eval.redirect_target,
                "evidence": redirect_eval.evidence,
            }
        }
        metadata_json = json.dumps(metadata, ensure_ascii=False)

        return {
            "timestamp": timestamp,
            "original_url": original,
            "status_code": status,
            "redirect_url": redirect_eval.redirect_target,
            "is_redirect": redirect_eval.redirect_detected,
            "mime_type": mime,
            "risk_score": final_risk_score,
            "detected_language": lang,
            "category_scores": category_scores,
            "flags": flags,
            # AI intelligence fields
            "content_category": dual_risk.primary_category,
            "category_confidence": dual_risk.category_confidence,
            "content_summary": dual_risk.risk_narrative or dual_risk.summary,
            "extraction_metadata": metadata_json,
            "evidence_url": evidence_url,
            # Advanced Redirect Engine & Dual Risk fields
            "redirect_detected": redirect_eval.redirect_detected,
            "redirect_method": redirect_eval.redirect_method,
            "redirect_confidence": redirect_eval.redirect_confidence,
            "redirect_verified": redirect_eval.redirect_verified,
            "redirect_same_domain": redirect_eval.redirect_same_domain,
            "redirect_target": redirect_eval.redirect_target,
            "redirect_target_status": redirect_eval.redirect_target_status,
            "redirect_target_category": dual_risk.redirect_target_category,
            "redirect_target_risk": dual_risk.redirect_target_risk,
            "original_category": dual_risk.original_category,
            "original_risk": dual_risk.original_risk,
            "redirect_evidence": redirect_eval.evidence,
        }

    # Fetch HTML contents in parallel batches with strict timeout (Semaphore cap = 10)
    sem = asyncio.Semaphore(10)

    async def fetch_html_only(s: dict) -> dict:
        async with sem:
            t = s["timestamp"]
            orig = s["original"]
            html = s.get("html_content")
            if html is None:
                try:
                    html = await asyncio.wait_for(fetch_snapshot_html(t, orig, domain_clean), timeout=7.0)
                except asyncio.TimeoutError:
                    logger.warning(f"Snapshot HTML fetch timed out (7s) for {orig} at {t}")
                    html = ""
                except Exception as ex:
                    logger.warning(f"Snapshot HTML fetch failed for {orig} at {t}: {ex}")
                    html = ""
            return {**s, "html_content": html}

    logger.info(f"Fetching {len(unique_snapshots_to_fetch)} unique snapshots concurrently for {domain_clean}...")
    fetched_snapshots = await asyncio.gather(*[fetch_html_only(snap) for snap in unique_snapshots_to_fetch])

    # Run AI analysis on unique snapshots concurrently
    logger.info(f"Running AI analysis on {len(fetched_snapshots)} unique snapshots for {domain_clean}...")
    async def analyze_bounded(snap: dict) -> dict:
        async with sem:
            try:
                return await asyncio.wait_for(fetch_and_analyze(snap), timeout=10.0)
            except asyncio.TimeoutError:
                logger.warning(f"Snapshot analysis timed out (10s) for {snap.get('original')} at {snap.get('timestamp')}")
                return {
                    "timestamp": snap.get("timestamp", ""),
                    "original_url": snap.get("original", ""),
                    "status_code": safe_parse_status_code(snap.get("statuscode")),
                    "redirect_url": None,
                    "is_redirect": False,
                    "mime_type": snap.get("mime", "text/html"),
                    "risk_score": 0,
                    "detected_language": "en",
                    "category_scores": {},
                    "flags": [],
                    "content_category": "unavailable",
                    "category_confidence": 0.0,
                    "content_summary": "Snapshot analysis timed out.",
                    "extraction_metadata": json.dumps({"status": "unavailable", "reason": "Timed out"}, ensure_ascii=False),
                    "evidence_url": None,
                    "redirect_detected": False,
                    "redirect_method": None,
                    "redirect_confidence": 0,
                    "redirect_verified": False,
                    "redirect_same_domain": False,
                    "redirect_target": None,
                    "redirect_target_status": None,
                    "redirect_target_category": None,
                    "redirect_target_risk": 0,
                    "original_category": "unavailable",
                    "original_risk": 0,
                    "redirect_evidence": [],
                }

    unique_results = await asyncio.gather(*[analyze_bounded(snap) for snap in fetched_snapshots])

    # Build lookup map from digest/timestamp -> analysis result
    analysis_by_digest = {}
    for res, snap_orig in zip(unique_results, unique_snapshots_to_fetch):
        digest_key = get_snapshot_key(snap_orig)
        analysis_by_digest[digest_key] = res

    # Interpolate results for non-fetched unique snapshots from the closest analyzed snapshot in time
    for snap in all_unique_snapshots:
        digest_key = get_snapshot_key(snap)
        if digest_key not in analysis_by_digest and unique_snapshots_to_fetch:
            closest_snap = min(
                unique_snapshots_to_fetch,
                key=lambda s: abs(safe_int(s.get("timestamp")) - safe_int(snap.get("timestamp")))
            )
            closest_digest = get_snapshot_key(closest_snap)
            closest_res = analysis_by_digest.get(closest_digest)
            if closest_res:
                analysis_by_digest[digest_key] = {
                    **closest_res,
                    "timestamp": snap["timestamp"],
                    "original_url": snap["original"],
                    "status_code": safe_parse_status_code(snap.get("statuscode")),
                    "mime_type": snap.get("mime", "text/html"),
                }

    # Map the unique analysis results back to all snapshots to reconstruct full timeline history
    snapshot_results = []
    for snap in sorted_snapshots:
        digest_key = get_snapshot_key(snap)
        res = analysis_by_digest.get(digest_key)
        if res:
            snapshot_results.append({
                "timestamp": snap["timestamp"],
                "original_url": snap["original"],
                "status_code": safe_parse_status_code(snap.get("statuscode")),
                "redirect_url": res.get("redirect_url"),
                "is_redirect": res.get("is_redirect", False),
                "mime_type": snap.get("mime", "text/html"),
                "risk_score": res["risk_score"],
                "detected_language": res["detected_language"],
                "category_scores": res["category_scores"].copy(),
                "flags": [f.copy() for f in res["flags"]],
                "content_category": res.get("content_category"),
                "category_confidence": res.get("category_confidence"),
                "content_summary": res.get("content_summary"),
                "extraction_metadata": res.get("extraction_metadata"),
                "evidence_url": res.get("evidence_url"),
                # Advanced Redirect & Dual Risk Fields
                "redirect_detected": res.get("redirect_detected", False),
                "redirect_method": res.get("redirect_method"),
                "redirect_confidence": res.get("redirect_confidence", 0),
                "redirect_verified": res.get("redirect_verified", False),
                "redirect_same_domain": res.get("redirect_same_domain", False),
                "redirect_target": res.get("redirect_target"),
                "redirect_target_status": res.get("redirect_target_status"),
                "redirect_target_category": res.get("redirect_target_category"),
                "redirect_target_risk": res.get("redirect_target_risk", 0),
                "original_category": res.get("original_category"),
                "original_risk": res.get("original_risk", 0),
                "redirect_evidence": res.get("redirect_evidence", []),
            })

    # 6. Compute overall risk metrics
    overall_score, overall_level, peak_score, avg_score = compute_overall_risk(list(snapshot_results))

    # Build history summary
    history_summary = []
    for snap in snapshot_results:
        year = snap["timestamp"][:4] if snap["timestamp"] else "?"
        categories = list({f["category"] for f in snap["flags"]})
        history_summary.append({
            "timestamp": snap["timestamp"],
            "year": year,
            "risk_score": snap["risk_score"],
            "categories": categories
        })
    history_summary.sort(key=lambda x: x["timestamp"])

    # Aggregate peak category confidences
    category_confidence = {}
    unique_flags = set()
    for snap in snapshot_results:
        for cat, score in snap["category_scores"].items():
            if score > category_confidence.get(cat, 0):
                category_confidence[cat] = score
        for flag in snap["flags"]:
            unique_flags.add(flag["category"])

    # 6b. Build year-level timeline
    timeline_entries = build_timeline(list(snapshot_results))
    primary_category = get_primary_category(timeline_entries)

    # 6c. AI Explanation
    top_confidence = max(
        (s.get("category_confidence") or 0.0 for s in snapshot_results), default=0.0
    )
    if primary_category == "safe" and (top_confidence == 0.0 or top_confidence is None):
        top_confidence = 1.0

    explanation = build_explanation(
        primary_category=primary_category,
        confidence=top_confidence,
        risk_level=overall_level,
        snapshot_results=list(snapshot_results),
        domain=domain_clean,
    )

    # 6d. Threat Intelligence
    threat_intel_results = await query_all_providers(domain_clean)
    threat_overall = overall_threat_status(threat_intel_results)

    # Blend Threat Intelligence verdict into overall risk score
    if threat_overall == "malicious":
        overall_score = max(overall_score, 85)
        overall_level = "HIGH"
    elif threat_overall == "suspicious":
        overall_score = max(overall_score, 55)
        if overall_level == "SAFE":
            overall_level = "MEDIUM"

    # 7. Persist to PostgreSQL database
    query_existing = select(Domain).options(
        selectinload(Domain.snapshots),
        selectinload(Domain.timeline),
        selectinload(Domain.threat_intel),
    ).where(Domain.name == domain_clean)
    res_existing = await db.execute(query_existing)
    db_domain = res_existing.scalar_one_or_none()

    if db_domain:
        db_domain.risk_score = overall_score
        db_domain.risk_level = overall_level
        now_utc = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
        db_domain.last_analyzed_at = now_utc
        db_domain.primary_category = primary_category
        db_domain.risk_narrative = explanation.narrative
        db_domain.last_threat_intel_at = now_utc
        db_domain.snapshots.clear()
        db_domain.timeline.clear()
        db_domain.threat_intel.clear()
    else:
        db_domain = Domain(
            name=domain_clean,
            risk_score=overall_score,
            risk_level=overall_level,
            last_analyzed_at=datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None),
            primary_category=primary_category,
            risk_narrative=explanation.narrative,
            last_threat_intel_at=datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None),
        )
        db.add(db_domain)
        db_domain.snapshots = []
        db_domain.timeline = []
        db_domain.threat_intel = []

    await db.flush()

    # Snapshots + flags
    for snap_res in snapshot_results:
        import json as _json_mod
        db_snap = Snapshot(
            timestamp=snap_res["timestamp"],
            original_url=snap_res["original_url"],
            status_code=snap_res["status_code"],
            redirect_url=snap_res.get("redirect_url"),
            is_redirect=snap_res.get("is_redirect", False),
            mime_type=snap_res["mime_type"],
            risk_score=snap_res["risk_score"],
            detected_language=snap_res["detected_language"],
            content_category=snap_res.get("content_category"),
            category_confidence=snap_res.get("category_confidence"),
            content_summary=snap_res.get("content_summary"),
            extraction_metadata=snap_res.get("extraction_metadata"),
            redirect_detected=snap_res.get("redirect_detected", False),
            redirect_method=snap_res.get("redirect_method"),
            redirect_confidence=snap_res.get("redirect_confidence", 0),
            redirect_verified=snap_res.get("redirect_verified", False),
            redirect_same_domain=snap_res.get("redirect_same_domain", False),
            redirect_target=snap_res.get("redirect_target"),
            redirect_target_status=snap_res.get("redirect_target_status"),
            redirect_target_category=snap_res.get("redirect_target_category"),
            redirect_target_risk=snap_res.get("redirect_target_risk", 0),
            original_category=snap_res.get("original_category"),
            original_risk=snap_res.get("original_risk", 0),
            redirect_evidence=_json_mod.dumps(snap_res.get("redirect_evidence", [])) if snap_res.get("redirect_evidence") else None,
        )
        db_domain.snapshots.append(db_snap)
        for flag_res in snap_res.get("flags", []):
            db_snap.flags.append(AnalysisFlag(
                category=flag_res.get("category", "safe"),
                keyword=flag_res.get("keyword", flag_res.get("flag", "flagged_behavior")),
                weight=flag_res.get("weight", flag_res.get("score_impact", 10)),
                match_count=flag_res.get("match_count", 1),
                element=flag_res.get("element", "<body>"),
                matched_text=flag_res.get("matched_text", flag_res.get("keyword")),
                snippet=flag_res.get("snippet", flag_res.get("evidence_description")),
                position=flag_res.get("position", 0),
            ))

    # Timeline rows
    for entry in timeline_entries:
        db_domain.timeline.append(DomainTimeline(
            year=entry["year"],
            category=entry["category"],
            risk_score=entry["risk_score"],
            peak_score=entry["peak_score"],
            snapshot_count=entry["snapshot_count"],
            summary=entry["summary"],
        ))

    # Threat intel rows
    for ti in threat_intel_results:
        db_domain.threat_intel.append(ThreatIntelligence(
            provider=ti["provider"],
            status=ti["status"],
            confidence=ti.get("confidence"),
            verdict=ti.get("verdict"),
            raw_response=ti.get("raw_response"),
            fetched_at=datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None),
        ))

    await db.commit()
    logger.info(f"Saved full intelligence results to DB for {domain_clean}")

    # Re-query Domain object to ensure relationships are loaded properly
    stmt = select(Domain).options(selectinload(Domain.snapshots)).where(Domain.name == domain_clean)
    refreshed_result = await db.execute(stmt)
    refreshed_domain = refreshed_result.scalar_one()

    # 8. Build and cache final response
    final_response = {
        "domain": domain_clean,
        "risk_score": overall_score,
        "risk_level": overall_level,
        "peak_score": peak_score,
        "avg_score": avg_score,
        "category_confidence": category_confidence,
        "flags": sorted(list(unique_flags)),
        "snapshots_checked": len(snapshot_results),
        "history_summary": history_summary,
        "snapshots": list(snapshot_results),
        "last_analyzed_at": db_domain.last_analyzed_at.isoformat(),
        "last_updated": db_domain.last_analyzed_at.isoformat(),
        # Intelligence enrichments
        "primary_category": primary_category,
        "risk_narrative": explanation.narrative,
        "evidence_bullets": explanation.evidence_bullets,
        "risk_period": explanation.risk_period,
        "ai_confidence": explanation.confidence,
        "content_niche": explanation.content_niche,
        "timeline": timeline_entries,
        "threat_intel": threat_intel_results,
        "threat_overall": threat_overall,
        "cdx_proxy_used": cdx_proxy_used,
    }

    await redis_manager.set(cache_key, final_response)
    return final_response

def format_domain_response(
    domain: Domain,
    peak_score: int = 0,
    avg_score: int = 0,
    history_summary: list = None,
    category_confidence: dict = None
) -> dict:
    """Formats a DB Domain object into the standard API dictionary."""
    snapshots_list = []
    unique_categories = set()
    history = []
    scores = []
    confidence_by_category = dict(category_confidence or {})

    for s in domain.snapshots:
        flags_list = []
        for f in s.flags:
            flags_list.append({
                "category": f.category,
                "keyword": f.keyword,
                "weight": f.weight,
                "match_count": f.match_count
            })
            unique_categories.add(f.category)

        scores.append(s.risk_score)
        history.append({
            "timestamp": s.timestamp,
            "year": s.timestamp[:4] if s.timestamp else "?",
            "risk_score": s.risk_score,
            "categories": sorted({f.category for f in s.flags}),
        })

        raw_meta = getattr(s, "extraction_metadata", None)
        if raw_meta:
            try:
                parsed_meta = json.loads(raw_meta)
                all_scores = parsed_meta.get("classifier", {}).get("all_scores", {}) or {}
                for category, score in all_scores.items():
                    if score > confidence_by_category.get(category, 0):
                        confidence_by_category[category] = score
            except Exception:
                pass

        evidence_url = None
        if raw_meta:
            try:
                evidence_url = json.loads(raw_meta).get("evidence_url")
            except Exception:
                evidence_url = None
        if not evidence_url:
            evidence_url = build_snapshot_evidence_url(s.timestamp, s.original_url, s.risk_score, flags_list)

        redirect_ev_parsed = None
        if getattr(s, "redirect_evidence", None):
            try:
                redirect_ev_parsed = json.loads(s.redirect_evidence)
            except Exception:
                redirect_ev_parsed = []

        snapshots_list.append({
            "timestamp": s.timestamp,
            "original_url": s.original_url,
            "status_code": s.status_code,
            "redirect_url": getattr(s, "redirect_url", None),
            "is_redirect": getattr(s, "is_redirect", False),
            "mime_type": s.mime_type,
            "risk_score": s.risk_score,
            "detected_language": getattr(s, "detected_language", None) or "en",
            # AI classification fields
            "content_category": getattr(s, "content_category", None),
            "category_confidence": getattr(s, "category_confidence", None),
            "content_summary": getattr(s, "content_summary", None),
            "extraction_metadata": getattr(s, "extraction_metadata", None),
            "evidence_url": evidence_url,
            "flags": flags_list,
            # Advanced Redirect & Dual Risk Telemetry
            "redirect_detected": getattr(s, "redirect_detected", False),
            "redirect_method": getattr(s, "redirect_method", None),
            "redirect_confidence": getattr(s, "redirect_confidence", 0),
            "redirect_verified": getattr(s, "redirect_verified", False),
            "redirect_same_domain": getattr(s, "redirect_same_domain", False),
            "redirect_target": getattr(s, "redirect_target", None),
            "redirect_target_status": getattr(s, "redirect_target_status", None),
            "redirect_target_category": getattr(s, "redirect_target_category", None),
            "redirect_target_risk": getattr(s, "redirect_target_risk", 0),
            "original_category": getattr(s, "original_category", None),
            "original_risk": getattr(s, "original_risk", 0),
            "redirect_evidence": redirect_ev_parsed,
        })

    timeline = [
        {
            "year": entry.year,
            "category": entry.category or "safe",
            "category_label": None,
            "category_icon": None,
            "risk_score": entry.risk_score,
            "peak_score": entry.peak_score,
            "snapshot_count": entry.snapshot_count,
            "summary": entry.summary,
        }
        for entry in sorted(domain.timeline, key=lambda item: item.year)
    ]

    threat_intel = [
        {
            "provider": item.provider,
            "status": item.status,
            "confidence": item.confidence,
            "verdict": item.verdict,
            "raw_response": item.raw_response,
            "fetched_at": item.fetched_at.isoformat() if item.fetched_at else None,
        }
        for item in domain.threat_intel
    ]

    return {
        "domain": domain.name,
        "risk_score": domain.risk_score,
        "risk_level": domain.risk_level,
        "peak_score": peak_score or (max(scores) if scores else 0),
        "avg_score": avg_score or (round(sum(scores) / len(scores)) if scores else 0),
        "category_confidence": confidence_by_category,
        "flags": sorted(list(unique_categories)),
        "snapshots_checked": len(domain.snapshots),
        "history_summary": history_summary or sorted(history, key=lambda x: x["timestamp"]),
        "snapshots": sorted(snapshots_list, key=lambda x: x["timestamp"]),
        "last_analyzed_at": domain.last_analyzed_at.isoformat(),
        "last_updated": domain.last_analyzed_at.isoformat(),
        "primary_category": domain.primary_category,
        "risk_narrative": domain.risk_narrative,
        "evidence_bullets": None,
        "ai_confidence": (1.0 if (domain.primary_category == "safe" or not domain.primary_category) and domain.risk_level == "SAFE" else max(confidence_by_category.values(), default=None)),
        "content_niche": detect_benign_content_niche(domain.name, domain.snapshots) if (domain.primary_category == "safe" or domain.risk_level == "SAFE") else None,
        "timeline": timeline,
        "threat_intel": threat_intel,
        "threat_overall": overall_threat_status(threat_intel) if threat_intel else None,
    }

async def save_empty_domain(domain_name: str, db: AsyncSession) -> Domain:
    """Saves a domain record, analyzing domain name threat keywords if CDX snapshots are unavailable."""
    d_risk, d_cat_scores, d_flags = analyze_snapshot_content("", domain_name)
    if d_risk > 0:
        assigned_score = d_risk
        assigned_level = "HIGH" if d_risk >= 60 else ("MEDIUM" if d_risk >= 30 else "SAFE")
        assigned_cat = max(d_cat_scores, key=lambda k: d_cat_scores[k]) if d_cat_scores else "suspicious"
        assigned_narrative = f"Domain name contains high-risk threat keywords ({', '.join(f['keyword'] for f in d_flags[:3])})."
    else:
        assigned_score = 0
        assigned_level = "UNKNOWN"
        assigned_cat = "unknown"
        assigned_narrative = "Insufficient data. No historical archive snapshots exist, or all captures were inaccessible."

    query = (
        select(Domain)
        .options(
            selectinload(Domain.snapshots),
            selectinload(Domain.timeline),
            selectinload(Domain.threat_intel)
        )
        .where(Domain.name == domain_name)
    )
    result = await db.execute(query)
    db_domain = result.scalar_one_or_none()

    now_utc = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    if db_domain:
        db_domain.risk_score = assigned_score
        db_domain.risk_level = assigned_level
        db_domain.primary_category = assigned_cat
        db_domain.risk_narrative = assigned_narrative
        db_domain.last_analyzed_at = now_utc
        db_domain.snapshots.clear()
        db_domain.timeline.clear()
        db_domain.threat_intel.clear()
    else:
        db_domain = Domain(
            name=domain_name,
            risk_score=assigned_score,
            risk_level=assigned_level,
            primary_category=assigned_cat,
            risk_narrative=assigned_narrative,
            last_analyzed_at=now_utc,
            snapshots=[],
            timeline=[],
            threat_intel=[]
        )
        db.add(db_domain)

    await db.commit()
    return db_domain




