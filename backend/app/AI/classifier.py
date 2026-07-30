"""
AI Content Classifier — ChronoSentinel AI Intelligence Engine
=====================================================
Multi-signal content classification engine that analyses cleaned page text and
assigns a primary threat category with a confidence score (0.0–1.0), a short
human-readable summary, and a list of evidence items.

Design goals
------------
* Language-aware  — delegates to the correct keyword set (en / id / nl …).
* Evidence-driven — every detection is backed by concrete keyword evidence.
* Non-destructive — works alongside the existing `analyze_snapshot_content`
  scorer; the pipeline calls both and merges their results.
* Extensible      — add a new category by adding keywords to a JSON keyword
  file; no code changes required.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from backend.app.services.analyzer import (
    LANGUAGE_KEYWORDS,
    get_language,
    CATEGORY_SCORE_CAP,
    keyword_match_count,
    preprocess_domain_name,
)
from backend.app.utils.text_cleaner import (
    extract_meta_tags_content,
    clean_html_content,
    normalize_obfuscated_text,
)
from backend.app.utils.logger import logger


# ─────────────────────────────────────────────────────────────────────────────
# Data Structures
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class EvidenceItem:
    """A single piece of keyword evidence that contributed to classification."""
    category: str
    keyword: str
    weight: int
    match_count: int
    contribution: float          # fractional contribution to category score


@dataclass
class ClassificationResult:
    """Complete output of the classifier for one snapshot."""
    primary_category: str        # top threat category, or "safe"
    confidence: float            # 0.0 – 1.0
    all_scores: Dict[str, float] # {category: normalised_score}
    evidence: List[EvidenceItem] = field(default_factory=list)
    summary: str = ""
    detected_language: str = "en"


# ─────────────────────────────────────────────────────────────────────────────
# Category Metadata  (display name + description template)
# ─────────────────────────────────────────────────────────────────────────────

CATEGORY_META: Dict[str, Dict[str, str]] = {
    "gambling": {
        "label": "Gambling & Online Lottery",
        "icon": "🎰",
        "summary_tpl": "Content contains {count} gambling-related signals "
                        "(e.g. {kws}). Classified as {confidence:.0%} confidence gambling site.",
    },
    "adult": {
        "label": "Adult / Explicit Content",
        "icon": "🔞",
        "summary_tpl": "Explicit adult content detected with {count} keyword signals "
                        "(e.g. {kws}). Confidence: {confidence:.0%}.",
    },
    "phishing_scam": {
        "label": "Phishing / Scam",
        "icon": "🎣",
        "summary_tpl": "Phishing or scam indicators found ({count} signals, e.g. {kws}). "
                        "Confidence: {confidence:.0%}.",
    },
    "malware_hacking": {
        "label": "Malware / Hacking",
        "icon": "💀",
        "summary_tpl": "Malware or hacking-related content detected ({count} signals, "
                        "e.g. {kws}). Confidence: {confidence:.0%}.",
    },
    "illegal_pharmaceuticals": {
        "label": "Illegal Pharmaceuticals",
        "icon": "💊",
        "summary_tpl": "Illegal pharmaceutical keywords detected ({count} signals, "
                        "e.g. {kws}). Confidence: {confidence:.0%}.",
    },
    "safe": {
        "label": "Safe / Benign",
        "icon": "✅",
        "summary_tpl": "No significant threat signals detected. Content appears safe.",
    },
}


SAFE_THRESHOLD = 0.08   # normalised score below which a category is ignored
SAFE_LABEL = "safe"


# ─────────────────────────────────────────────────────────────────────────────
# Core classifier
# ─────────────────────────────────────────────────────────────────────────────

def classify_content(html_content: str, domain: Optional[str] = None) -> ClassificationResult:
    """
    Classifies the content of a single HTML snapshot.

    Parameters
    ----------
    html_content : str
        Raw HTML string (or empty string / None for no content).
    domain : Optional[str]
        Optional domain name to enrich the scanned text.

    Returns
    -------
    ClassificationResult
        Structured classification result ready to be stored and displayed.
    """
    if (not html_content or not html_content.strip()) and not domain:
        return ClassificationResult(
            primary_category=SAFE_LABEL,
            confidence=0.0,
            all_scores={},
            summary="No HTML content retrieved for this snapshot.",
            detected_language="en",
        )

    # 1. Clean and normalise text (meta tags + full body content)
    from backend.app.utils.text_cleaner import clean_html_content
    meta_text = extract_meta_tags_content(html_content)
    body_text = clean_html_content(html_content)
    cleaned = f"{meta_text} {body_text}".lower()
    if domain:
        cleaned = f"{preprocess_domain_name(domain)} {cleaned}"
    scan_text = f"{cleaned} {normalize_obfuscated_text(cleaned)}"

    # 2. Language detection
    lang = get_language(cleaned)
    lang_dict = LANGUAGE_KEYWORDS.get(lang) or LANGUAGE_KEYWORDS.get("en", {})
    positive_kws: Dict[str, Dict] = lang_dict.get("positive_keywords", {})
    negative_kws: Dict[str, Dict] = lang_dict.get("negative_keywords", {})

    # 3. Score each category
    raw_scores: Dict[str, float] = {}
    all_evidence: List[EvidenceItem] = []

    for category, keywords in positive_kws.items():
        cat_score = 0.0
        cat_evidence: List[EvidenceItem] = []

        for keyword, (weight, min_matches) in keywords.items():
            count = keyword_match_count(scan_text, keyword)
            if count >= min_matches:
                contribution = float(weight)
                cat_score += contribution
                cat_evidence.append(EvidenceItem(
                    category=category,
                    keyword=keyword,
                    weight=weight,
                    match_count=count,
                    contribution=contribution,
                ))

        # Apply negative keyword suppression
        for neg_kw, neg_weight in negative_kws.get(category, {}).items():
            if keyword_match_count(scan_text, neg_kw) > 0:
                cat_score -= float(neg_weight)

        cat_score = max(0.0, cat_score)

        # Normalise against the per-category cap to get 0-1
        normalised = min(cat_score / CATEGORY_SCORE_CAP, 1.0) if CATEGORY_SCORE_CAP else 0.0

        if normalised >= SAFE_THRESHOLD:
            raw_scores[category] = normalised
            all_evidence.extend(cat_evidence)

    # 4. Determine primary category
    if not raw_scores:
        primary = SAFE_LABEL
        confidence = 0.0
    else:
        primary = max(raw_scores, key=lambda c: raw_scores[c])
        confidence = round(raw_scores[primary], 4)

    # Sort evidence by contribution descending, keep top 20 per result
    all_evidence.sort(key=lambda e: e.contribution, reverse=True)
    top_evidence = all_evidence[:20]

    # 5. Build human-readable summary
    summary = _build_summary(primary, confidence, top_evidence)

    logger.debug(
        f"[Classifier] lang={lang} primary={primary} "
        f"confidence={confidence:.2%} categories={list(raw_scores.keys())}"
    )

    return ClassificationResult(
        primary_category=primary,
        confidence=confidence,
        all_scores=raw_scores,
        evidence=top_evidence,
        summary=summary,
        detected_language=lang,
    )


def _build_summary(
    primary: str,
    confidence: float,
    evidence: List[EvidenceItem],
) -> str:
    """Generate a short human-readable summary string."""
    meta = CATEGORY_META.get(primary, CATEGORY_META["safe"])
    tpl = meta.get("summary_tpl", "")

    if primary == SAFE_LABEL or not evidence:
        return meta["summary_tpl"]

    # Sample up to 3 unique keyword names for the summary
    kw_samples = list(dict.fromkeys(e.keyword for e in evidence[:6]))[:3]
    kws_str = ", ".join(f'"{k}"' for k in kw_samples)

    try:
        return tpl.format(
            count=len(evidence),
            kws=kws_str,
            confidence=confidence,
        )
    except KeyError:
        return f"{meta['label']} detected with {confidence:.0%} confidence."


# ─────────────────────────────────────────────────────────────────────────────
# Serialisation helpers (for pipeline → DB storage)
# ─────────────────────────────────────────────────────────────────────────────

def result_to_metadata_json(result: ClassificationResult) -> str:
    """Serialise the full ClassificationResult to a JSON string for DB storage."""
    payload = {
        "primary_category": result.primary_category,
        "confidence": result.confidence,
        "all_scores": result.all_scores,
        "detected_language": result.detected_language,
        "evidence": [
            {
                "category": e.category,
                "keyword": e.keyword,
                "weight": e.weight,
                "match_count": e.match_count,
                "contribution": round(e.contribution, 3),
            }
            for e in result.evidence
        ],
    }
    return json.dumps(payload, ensure_ascii=False)


def metadata_json_to_result(json_str: str) -> Optional[ClassificationResult]:
    """Deserialise a stored JSON string back into a ClassificationResult."""
    try:
        d = json.loads(json_str)
        evidence = [
            EvidenceItem(
                category=e["category"],
                keyword=e["keyword"],
                weight=e["weight"],
                match_count=e["match_count"],
                contribution=e["contribution"],
            )
            for e in d.get("evidence", [])
        ]
        return ClassificationResult(
            primary_category=d["primary_category"],
            confidence=d["confidence"],
            all_scores=d.get("all_scores", {}),
            evidence=evidence,
            detected_language=d.get("detected_language", "en"),
        )
    except Exception as exc:
        logger.error(f"[Classifier] Failed to deserialise metadata JSON: {exc}")
        return None
