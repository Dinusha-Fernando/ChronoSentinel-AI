"""
Explainable AI — Risk Narrative Generator
==========================================
Produces human-readable, evidence-backed explanations for why a domain
received its risk score. Uses deterministic template logic (no LLM required),
so it works offline and never blocks.

The output is designed to satisfy "manager-level" readability:

  "This domain historically hosted gambling content between 2014 and 2019.
   Evidence: sports betting, casino bonuses, live roulette detected across
   14 snapshots. Structural analysis flagged 2 hidden element layers and a
   crypto wallet address. Confidence: 94%."
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any

from backend.app.AI.classifier import CATEGORY_META, SAFE_LABEL


# ─────────────────────────────────────────────────────────────────────────────
# Data structures
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ExplainedRisk:
    narrative: str                      # Full English explanation paragraph
    evidence_bullets: List[str]         # Bullet-point evidence list
    primary_category: str               # e.g. "gambling" or "safe"
    risk_period: str                    # e.g. "2014–2019" or "2022"
    confidence: float                   # 0.0–1.0 (from classifier)
    detector_highlights: List[str]      # High-signal structural findings
    risk_level: str                     # SAFE / MEDIUM / HIGH
    content_niche: Optional[Dict[str, str]] = None  # Benign niche details for safe sites


BENIGN_NICHE_PATTERNS = [
    {
        "title": "Gift Ordering & Specialty Present Shop",
        "desc": "Online e-commerce platform offering gift ordering, specialty presents, and custom merchandise.",
        "icon": "🎁",
        "keywords": ["present", "presents", "gift", "gifts", "boutique", "shop", "order", "store", "cart", "craft", "flower", "lamour"]
    },
    {
        "title": "University & Academic Economy Portal",
        "desc": "Academic research and educational web portal specializing in economics, university faculty studies, and student resources.",
        "icon": "🎓",
        "keywords": ["economia", "ucn", "university", "academic", "faculty", "student", "research", "degree", "edu", "college"]
    },
    {
        "title": "Economics, Finance & Commercial Business Hub",
        "desc": "Information hub covering economics, financial analysis, commercial markets, and business affairs.",
        "icon": "📈",
        "keywords": ["economy", "economic", "finance", "business", "banking", "market", "invest", "accounting", "trade", "corp"]
    },
    {
        "title": "News, Media & Editorial Portal",
        "desc": "Digital journalism and news publication portal providing articles, current events, and media updates.",
        "icon": "📰",
        "keywords": ["news", "press", "journal", "magazine", "blog", "article", "publication", "media", "portal", "post", "times"]
    },
    {
        "title": "Software Development & Tech Platform",
        "desc": "Technology platform providing software solutions, digital services, developer tools, and web infrastructure.",
        "icon": "💻",
        "keywords": ["dev", "code", "tech", "software", "git", "digital", "app", "cloud", "system", "data", "api", "hub", "github", "stack"]
    },
    {
        "title": "Online Encyclopedia & Educational Reference",
        "desc": "Educational reference portal providing public encyclopedic articles, knowledge archives, and documentation.",
        "icon": "📚",
        "keywords": ["wiki", "pedia", "encyclopedia", "dictionary", "library", "reference", "archive", "knowledge"]
    },
    {
        "title": "Dermatology & Aesthetic Clinic",
        "desc": "Aesthetic medicine, skincare, cosmetic dermatology, facial rejuvenation, and wellness treatment clinic.",
        "icon": "✨",
        "keywords": ["dermatology", "aesthetic", "injectable", "botox", "filler", "skincare", "laser", "hair", "contouring", "facial", "liposuction", "rejuvenation", "clinic", "dermatologist", "appointment", "wellness", "aesthetic clinic", "cosmetic surgery", "medspa"]
    },
    {
        "title": "Healthcare & Medical Services Portal",
        "desc": "Healthcare and medical services information portal for clinic details, patient care, and wellness resources.",
        "icon": "🏥",
        "keywords": ["health", "clinic", "medical", "hospital", "care", "doctor", "wellness", "therapy", "medicine", "dental"]
    },
    {
        "title": "Travel, Tourism & Hospitality Guide",
        "desc": "Travel and tourism guide providing vacation bookings, hotel accommodations, and destination information.",
        "icon": "✈️",
        "keywords": ["travel", "tour", "hotel", "resort", "vacation", "flight", "trip", "destination", "guide", "booking"]
    },
    {
        "title": "Culinary, Food & Dining Service",
        "desc": "Culinary website featuring restaurant menus, food ordering, recipes, and dining information.",
        "icon": "🍽️",
        "keywords": ["restaurant", "cafe", "food", "dining", "kitchen", "recipe", "bakery", "coffee", "pizza", "bistro"]
    },
    {
        "title": "Corporate & Professional Services",
        "desc": "Business corporate website providing professional services, enterprise solutions, and client consulting.",
        "icon": "🏢",
        "keywords": ["services", "consulting", "solutions", "group", "agency", "firm", "company", "global", "partner"]
    }
]


def detect_benign_content_niche(domain: str, snapshot_results: Optional[List[Dict[str, Any]]] = None) -> Dict[str, str]:
    """
    Analyzes domain name and snapshot metadata to identify specific benign content niche.
    Returns dict: {"title": ..., "desc": ..., "icon": ...}
    """
    domain_clean = domain.lower() if domain else ""
    for tld in [".com", ".net", ".org", ".info", ".xyz", ".biz", ".co", ".io", ".cl", ".uk"]:
        if domain_clean.endswith(tld):
            domain_clean = domain_clean[:-len(tld)]

    combined_text = domain_clean.replace("-", " ").replace(".", " ")
    if snapshot_results:
        for snap in snapshot_results[:3]:
            meta_json = snap.get("extraction_metadata") if isinstance(snap, dict) else getattr(snap, "extraction_metadata", None)
            if meta_json:
                try:
                    meta = json.loads(meta_json) if isinstance(meta_json, str) else meta_json
                    title = (meta.get("title", "") or "") if isinstance(meta, dict) else ""
                    combined_text += f" {str(title).lower()}"
                except Exception:
                    pass

    best_match = None
    best_score = 0
    for pattern in BENIGN_NICHE_PATTERNS:
        match_count = sum(1 for kw in pattern["keywords"] if kw in combined_text)
        if match_count > best_score:
            best_score = match_count
            best_match = pattern

    if best_match:
        return {
            "title": best_match["title"],
            "desc": best_match["desc"],
            "icon": best_match["icon"]
        }

    formatted_name = domain_clean.replace("-", " ").replace(".", " ").title()
    return {
        "title": f"{formatted_name} Web Portal",
        "desc": "Legitimate web portal providing general digital services, brand content, and informational resources.",
        "icon": "🌐"
    }


# ─────────────────────────────────────────────────────────────────────────────
# Category narrative templates
# ─────────────────────────────────────────────────────────────────────────────

_NARRATIVES: Dict[str, str] = {
    "gambling": (
        "This domain {period_clause} hosted gambling and sports-betting content. "
        "Keyword analysis identified {kw_count} gambling-related signals including "
        "{kw_samples}. {detector_clause} "
        "Historical risk confidence: {confidence:.0%}."
    ),
    "adult": (
        "This domain {period_clause} contained explicit adult entertainment content. "
        "Analysis detected {kw_count} adult-content indicators including {kw_samples}. "
        "{detector_clause} "
        "Confidence: {confidence:.0%}."
    ),
    "phishing_scam": (
        "This domain {period_clause} exhibited phishing and scam-related behaviour. "
        "{kw_count} fraud-related signals were detected including {kw_samples}. "
        "{detector_clause} "
        "Confidence: {confidence:.0%}."
    ),
    "malware_hacking": (
        "This domain {period_clause} was associated with malware distribution or "
        "hacking activity. {kw_count} threat indicators found including {kw_samples}. "
        "{detector_clause} "
        "Confidence: {confidence:.0%}."
    ),
    "illegal_pharmaceuticals": (
        "This domain {period_clause} was linked to illegal pharmaceutical sales. "
        "Detected {kw_count} pharmaceutical-related signals including {kw_samples}. "
        "{detector_clause} "
        "Confidence: {confidence:.0%}."
    ),
    SAFE_LABEL: (
        "No significant threat signals were detected across {snap_count} historical "
        "snapshot{plural}. Content analysis returned safe category signatures "
        "with no flagged keywords or structural anomalies."
    ),
}

_DETECTOR_TEMPLATES: Dict[str, str] = {
    "hidden_elements":        "hidden CSS elements (possible cloaking)",
    "crypto_wallets":         "cryptocurrency wallet addresses",
    "forms":                  "password-collection forms (phishing indicator)",
    "iframe_redirects":       "iframe injections and JavaScript redirects",
    "repurposed_domain_redirect": "repurposed domain redirect injections (gaming/adult network)",
    "url_obfuscation":        "heavily obfuscated URLs",
    "external_link_density":  "high external link density",
    "phone_numbers":          "multiple phone number patterns",
    "content_length":         "anomalous page size",
}


# ─────────────────────────────────────────────────────────────────────────────
# Core explainer
# ─────────────────────────────────────────────────────────────────────────────

def build_explanation(
    primary_category: str,
    confidence: float,
    risk_level: str,
    snapshot_results: List[Dict[str, Any]],
    domain: str = "",
) -> ExplainedRisk:
    """
    Build a full risk explanation from the pipeline's snapshot results.
    """
    snap_count = len(snapshot_results)

    # ── Collect evidence from all snapshots ───────────────────────────────
    all_keywords: Dict[str, int] = {}   # keyword → total match count
    high_detector_signals: Dict[str, int] = {}  # detector_name → count of highs
    risky_years: List[str] = []

    for snap in snapshot_results:
        year = (snap.get("timestamp") or "")[:4]

        # Keyword evidence
        for flag in snap.get("flags", []):
            kw = flag.get("keyword", "")
            all_keywords[kw] = all_keywords.get(kw, 0) + flag.get("match_count", 1)

        # Structural detector evidence (from extraction_metadata JSON)
        meta_json = snap.get("extraction_metadata")
        if meta_json:
            try:
                meta = json.loads(meta_json) if isinstance(meta_json, str) else meta_json
                for det in meta.get("detectors", []):
                    if det.get("signal") == "high":
                        dname = det.get("detector", "")
                        high_detector_signals[dname] = high_detector_signals.get(dname, 0) + 1
            except Exception:
                pass

        # Track risky years
        if snap.get("risk_score", 0) > 30 and year:
            risky_years.append(year)

    # ── Compute risk period ───────────────────────────────────────────────
    if risky_years:
        min_y, max_y = min(risky_years), max(risky_years)
        risk_period = min_y if min_y == max_y else f"{min_y}–{max_y}"
    else:
        risk_period = "recently"

    # ── Top keywords ──────────────────────────────────────────────────────
    sorted_kws = sorted(all_keywords.items(), key=lambda x: x[1], reverse=True)
    top_kws = [k for k, _ in sorted_kws[:5]]
    kw_samples_str = ", ".join(f'"{k}"' for k in top_kws[:3]) if top_kws else "multiple indicators"
    kw_count = len(all_keywords)

    # ── Detector highlights ───────────────────────────────────────────────
    detector_bullets: List[str] = []
    for dname, count in sorted(high_detector_signals.items(), key=lambda x: x[1], reverse=True)[:3]:
        label = _DETECTOR_TEMPLATES.get(dname, dname.replace("_", " "))
        detector_bullets.append(f"Structural analysis detected {label} in {count} snapshot(s).")

    detector_clause = " ".join(detector_bullets) if detector_bullets else ""

    # ── Period clause ─────────────────────────────────────────────────────
    if risky_years:
        period_clause = f"historically ({risk_period})"
    else:
        period_clause = "was found to have"

    # If primary category is safe and confidence is 0, default confidence to 1.0 (100% safe confidence)
    if (primary_category == SAFE_LABEL or risk_level == "SAFE") and (confidence == 0.0 or confidence is None):
        confidence = 1.0

    niche_data = None
    if primary_category == SAFE_LABEL or risk_level == "SAFE":
        niche_data = detect_benign_content_niche(domain, snapshot_results)
        plural_snap = "s" if snap_count != 1 else ""
        narrative = (
            f"No threat signals were detected across {snap_count} historical snapshot{plural_snap}. "
            f"Content analysis identified this domain as a {niche_data['title']} ({niche_data['desc']}). "
            f"Historical captures show safe category signatures with zero threat flags or structural anomalies."
        )
        evidence_bullets = [
            f"Classification: {niche_data['icon']} {niche_data['title']}",
            f"Content Niche: {niche_data['desc']}",
            f"Analysed {snap_count} historical snapshot(s) with 0 threat flags",
        ]
    else:
        # ── Build threat narrative ───────────────────────────────────────────
        tpl = _NARRATIVES.get(primary_category, _NARRATIVES[SAFE_LABEL])
        try:
            narrative = tpl.format(
                period_clause=period_clause,
                kw_count=kw_count,
                kw_samples=kw_samples_str,
                detector_clause=detector_clause,
                confidence=confidence,
                snap_count=snap_count,
                plural="s" if snap_count != 1 else "",
            )
        except KeyError:
            narrative = f"Risk level: {risk_level}. Category: {primary_category}."

        evidence_bullets: List[str] = []
        if top_kws:
            evidence_bullets.append(f"Keywords detected: {', '.join(top_kws)}")
        if kw_count > len(top_kws):
            evidence_bullets.append(f"{kw_count - len(top_kws)} additional unique keyword signals found")
        evidence_bullets.extend(detector_bullets)
        evidence_bullets.append(f"Analysed {snap_count} historical snapshot(s)")
        if risky_years:
            evidence_bullets.append(f"Risk period: {risk_period}")

    return ExplainedRisk(
        narrative=narrative.strip(),
        evidence_bullets=evidence_bullets,
        primary_category=primary_category,
        risk_period=risk_period,
        confidence=confidence,
        detector_highlights=detector_bullets,
        risk_level=risk_level,
        content_niche=niche_data,
    )
