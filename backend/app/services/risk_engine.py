from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass
from backend.app.AI.classifier import classify_content
from backend.app.utils.text_cleaner import clean_html_content
from backend.app.services.redirect_engine import RedirectEvaluationResult
from backend.app.utils.logger import logger


def select_snapshots_to_check(snapshots: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Sorts snapshots by timestamp in chronological order."""
    if not snapshots:
        return []
    return sorted(snapshots, key=lambda s: str(s.get("timestamp", "")))


def compute_overall_risk(scores_or_snapshots: List[Any]) -> Tuple[int, str, int, int]:
    """
    Computes overall risk score, risk level (SAFE/MEDIUM/HIGH), peak score, and average score.
    Supports either a list of integer risk scores or a list of snapshot dict objects.
    Ensures high risk peaks maintain primary weight so old safe snapshots cannot dilute threats.
    """
    if not scores_or_snapshots:
        return 0, "SAFE", 0, 0

    scores: List[int] = []
    for item in scores_or_snapshots:
        if isinstance(item, (int, float)):
            scores.append(int(item))
        elif isinstance(item, dict):
            scores.append(int(item.get("risk_score", 0)))

    if not scores:
        return 0, "SAFE", 0, 0

    peak_score = max(scores)

    # Compute average score using active/valid snapshots (excluding 0-score failed fetches if non-zero exist)
    non_zero_scores = [s for s in scores if s > 0]
    if non_zero_scores:
        raw_avg = sum(non_zero_scores) / len(non_zero_scores)
    else:
        raw_avg = sum(scores) / len(scores) if scores else 0.0
    avg_score = int(round(raw_avg))

    # Weighted calculation: if a severe threat peak exists, retain peak dominance (80% peak + 20% avg)
    if peak_score >= 65:
        final_score = max(int(round(0.80 * peak_score + 0.20 * raw_avg)), peak_score - 10)
    else:
        final_score = int(round(0.60 * peak_score + 0.40 * raw_avg))

    final_score = min(100, max(0, final_score))

    if final_score <= 30:
        level = "SAFE"
    elif final_score <= 60:
        level = "MEDIUM"
    else:
        level = "HIGH"

    return final_score, level, peak_score, avg_score


HIGH_SEVERITY_CATEGORIES = (
    "gambling", "adult", "phishing", "phishing_scam", "malware",
    "malware_hacking", "illegal_pharmaceuticals"
)
MEDIUM_SEVERITY_CATEGORIES = ("crypto", "financial_scam")


@dataclass
class DualRiskEvaluationResult:
    final_risk_score: int
    primary_category: str
    category_confidence: float
    summary: str
    original_category: str
    original_risk: int
    redirect_target_category: Optional[str] = None
    redirect_target_risk: int = 0
    risk_narrative: Optional[str] = None
    category_scores: Dict[str, float] = None


class RiskDecisionEngine:
    @staticmethod
    def evaluate_dual_risk(
        original_html: str,
        target_html: Optional[str],
        redirect_eval: RedirectEvaluationResult,
        domain: str
    ) -> DualRiskEvaluationResult:
        """
        Runs independent ML classification on original snapshot HTML and target HTML,
        and applies the Dual Risk Matrix.
        """
        # 1. Clean & Classify Original Snapshot
        orig_cleaned = clean_html_content(original_html or "")
        orig_clf = classify_content(orig_cleaned, domain)

        orig_category = orig_clf.primary_category
        orig_confidence = orig_clf.confidence
        orig_scores = orig_clf.all_scores
        orig_risk = int(round(orig_scores.get(orig_category, 0.0) * 100)) if orig_scores else 0

        # Adjust base original risk for high-severity categories ONLY if confidence is significant (>= 35%)
        if orig_confidence >= 0.35:
            if orig_category in HIGH_SEVERITY_CATEGORIES:
                orig_risk = max(orig_risk, 80)
            elif orig_category in MEDIUM_SEVERITY_CATEGORIES:
                orig_risk = max(orig_risk, 65)
        else:
            # Low confidence noise (<35%): treat as unconfirmed or safe
            if orig_risk < 30:
                orig_category = "safe"

        target_category: Optional[str] = None
        target_risk: int = 0
        target_clf = None

        # 2. Clean & Classify Target HTML if redirect detected & target HTML available
        if redirect_eval.redirect_detected and target_html:
            target_cleaned = clean_html_content(target_html)
            target_clf = classify_content(target_cleaned, domain)

            target_category = target_clf.primary_category
            t_scores = target_clf.all_scores
            target_risk = int(round(t_scores.get(target_category, 0.0) * 100)) if t_scores else 0
            if target_category in HIGH_SEVERITY_CATEGORIES:
                target_risk = max(target_risk, 85)

        # 3. Apply Dual Risk Matrix
        final_risk = orig_risk
        display_category = orig_category
        narrative: Optional[str] = None
        final_confidence = orig_confidence
        final_summary = orig_clf.summary

        if redirect_eval.redirect_detected:
            if target_category in HIGH_SEVERITY_CATEGORIES:
                final_risk = max(orig_risk, target_risk, 85)
                display_category = f"{orig_category} -> {target_category}"
                narrative = (
                    f"⚠️ CHRONOSENTINEL WARNING: Snapshot for {domain} redirects to an external "
                    f"{target_category.upper()} threat network ({redirect_eval.redirect_target}). "
                    f"Original page was classified as '{orig_category}'."
                )
                if target_clf:
                    final_confidence = target_clf.confidence
                    final_summary = target_clf.summary
            elif target_category and target_category != "safe":
                final_risk = max(orig_risk, target_risk, 50)
                display_category = f"{orig_category} -> {target_category}"
                narrative = f"Snapshot redirects to external {target_category} site ({redirect_eval.redirect_target})."

        return DualRiskEvaluationResult(
            final_risk_score=final_risk,
            primary_category=display_category,
            category_confidence=final_confidence,
            summary=final_summary,
            original_category=orig_category,
            original_risk=orig_risk,
            redirect_target_category=target_category,
            redirect_target_risk=target_risk,
            risk_narrative=narrative,
            category_scores=orig_scores
        )
