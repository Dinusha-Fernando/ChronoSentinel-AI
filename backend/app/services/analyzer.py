import re
import json
import os
from typing import Dict, List, Any, Tuple, Optional
from langdetect import detect, DetectorFactory
from bs4 import BeautifulSoup
from backend.app.utils.text_cleaner import extract_meta_tags_content, normalize_obfuscated_text, clean_html_content
from backend.app.utils.logger import logger

def validate_snapshot_html(html: str) -> Tuple[bool, Optional[str]]:
    """
    Validates HTML content. Returns (is_valid, invalid_reason).
    """
    if not html or not html.strip():
        return False, "Blank page"
    
    html_lower = html.lower()
    
    # Check Wayback error signatures
    wayback_errors = [
        "wayback machine closed the connection",
        "archive.org/details/error",
        "snapshot not found",
        "wayback machine has not archived that url",
        "wayback machine error"
    ]
    for err in wayback_errors:
        if err in html_lower:
            return False, "Wayback error page"
            
    # Check general network / browser error messages
    browser_errors = [
        "site cannot be reached",
        "page not found",
        "404 not found",
        "dns_probe_finished_nxdomain",
        "server not found",
        "connection timed out",
        "error 502",
        "bad gateway",
        "504 gateway timeout",
        "hmmm... can't reach this page",
        "this site can't be reached",
        "server error"
    ]
    for err in browser_errors:
        if f"<title>{err}" in html_lower or html_lower.strip() == err:
            return False, f"Browser error page: {err}"
            
    # Check placeholder / domain parking pages
    parked_signatures = [
        "domain is registered",
        "domain is parking",
        "this domain is for sale",
        "domain parking",
        "buy this domain",
        "parked free",
        "website is under construction",
        "coming soon"
    ]
    for sig in parked_signatures:
        if sig in html_lower and len(html_lower) < 3000:
            return False, "Placeholder/parked page"
            
    return True, None

def classify_images_in_html(html: str, domain: str) -> List[Dict[str, Any]]:
    """
    Extracts every image referenced by the HTML and runs rule-based classification on its URL/alt text.
    Returns a list of image detections.
    """
    if not html:
        return []
        
    try:
        soup = BeautifulSoup(html, "html.parser")
    except Exception:
        return []
        
    image_detections = []
    # Keywords to trigger categories
    image_keywords = {
        "gambling": ["casino", "slot", "betting", "poker", "roulette", "blackjack", "jackpot", "wager", "baccarat", "spins", "bookie"],
        "adult": ["xxx", "porn", "adult", "sex", "nude", "escort", "massage", "sensual", "erotic", "hentai", "pornhub", "xvideos"],
        "scam": ["fake-login", "phishing", "free-prize", "win-money", "giveaway", "cryptocurrency-bonus"]
    }
    
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src")
        if not src:
            continue
            
        alt = img.get("alt", "").lower()
        title = img.get("title", "").lower()
        src_lower = src.lower()
        
        # Combine alt text, title and image filename
        filename = src_lower.split("/")[-1] if "/" in src_lower else src_lower
        combined_text = f"{alt} {title} {filename}"
        
        for category, kws in image_keywords.items():
            triggered_kw = None
            for kw in kws:
                if kw in combined_text:
                    triggered_kw = kw
                    break
            if triggered_kw:
                # Store the image URL, category, confidence score, and screenshot reference placeholder
                image_detections.append({
                    "url": src,
                    "category": category,
                    "confidence_score": 0.85 if triggered_kw in alt else 0.70,
                    "evidence_description": f"Image tag with threat signal '{triggered_kw}' in filename/alt text.",
                    "screenshot_reference": f"https://web.archive.org/web/{domain}/{src}" if not src.startswith("http") else src
                })
                break # Classify as one category per image
                
    return image_detections

def find_keyword_locations(html: str, keywords_list: List[str]) -> List[Dict[str, Any]]:
    """
    Searches the HTML structure (meta tags, titles, headings, p, div, span, li, a, td)
    to accurately locate where target keywords appear in body paragraphs and elements.
    Returns a list of match details (keyword, element, matched_text, snippet, position).
    """
    if not html or not keywords_list:
        return []

    matches = []
    seen_keys = set()
    try:
        soup = BeautifulSoup(html, "html.parser")
        # Remove non-content, code blocks, scripts, and styling tags before locating keywords
        for el in soup(["script", "style", "code", "pre", "template", "svg", "noscript", "iframe"]):
            el.decompose()
    except Exception:
        return []

    for keyword in keywords_list:
        if not keyword or not keyword.strip():
            continue
        keyword_clean = keyword.lower().strip()
        parts = [re.escape(p) for p in keyword_clean.split() if p]
        if not parts:
            continue
        
        sep = r"[\W_]+"
        pattern = rf"(?<![a-z0-9]){sep.join(parts)}(?![a-z0-9])" if len(parts) > 1 else rf"(?<![a-z0-9]){parts[0]}(?![a-z0-9])"

        # 1. Search meta tags first
        for meta in soup.find_all("meta"):
            content = meta.get("content", "")
            if content and re.search(pattern, content.lower()):
                name_attr = meta.get("name") or meta.get("property") or "meta"
                dedup_key = (keyword, f'<meta name="{name_attr}">', content[:120])
                if dedup_key not in seen_keys:
                    seen_keys.add(dedup_key)
                    m = re.search(pattern, content.lower())
                    matches.append({
                        "keyword": keyword,
                        "element": f'<meta name="{name_attr}">',
                        "matched_text": content.strip(),
                        "snippet": content.strip()[:120],
                        "position": m.start() if m else 0
                    })

        # 2. Search title tag
        if soup.title:
            title_text = soup.title.get_text().strip()
            if title_text and re.search(pattern, title_text.lower()):
                dedup_key = (keyword, "<title>", title_text[:120])
                if dedup_key not in seen_keys:
                    seen_keys.add(dedup_key)
                    m = re.search(pattern, title_text.lower())
                    matches.append({
                        "keyword": keyword,
                        "element": "<title>",
                        "matched_text": title_text,
                        "snippet": title_text[:120],
                        "position": m.start() if m else 0
                    })

        # 3. Search HTML body paragraph & text elements (<p>, <div>, <span>, <a>, <li>, <td>, <h1>-<h6>, <article>, <section>)
        for element in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "li", "span", "div", "td", "article", "section"]):
            text = element.get_text(separator=" ").strip()
            if not text:
                continue

            # Skip huge outer container divs to pinpoint specific paragraph/div element
            if len(text) > 1000 and element.name in ("div", "article", "section"):
                continue

            if re.search(pattern, text.lower()):
                snippet = text[:150]
                dedup_key = (keyword, f"<{element.name}>", snippet)
                if dedup_key not in seen_keys:
                    seen_keys.add(dedup_key)
                    m = re.search(pattern, text.lower())
                    matches.append({
                        "keyword": keyword,
                        "element": f"<{element.name}>",
                        "matched_text": text[:300],
                        "snippet": snippet,
                        "position": m.start() if m else 0
                    })

    return matches

# Ensure consistent language detection
DetectorFactory.seed = 0

# -----------------------------------------------------------------------------
# RISK KEYWORD REGISTRY
# -----------------------------------------------------------------------------

def load_keywords() -> Dict[str, Dict]:
    keywords = {}
    base_dir = os.path.join(os.path.dirname(__file__), "keywords")
    if not os.path.exists(base_dir):
        return keywords
        
    for filename in os.listdir(base_dir):
        if filename.endswith(".json"):
            lang = filename.split(".")[0]
            try:
                with open(os.path.join(base_dir, filename), "r", encoding="utf-8-sig") as f:
                    keywords[lang] = json.load(f)
            except Exception as e:
                logger.error(f"Error loading keywords for {lang}: {e}")
    return keywords

LANGUAGE_KEYWORDS = load_keywords()
RISK_CATEGORIES = LANGUAGE_KEYWORDS

# Per-category score cap to allow multiple categories to accumulate
CATEGORY_SCORE_CAP = 65

def keyword_match_count(text: str, keyword: str) -> int:
    """Count keyword hits while tolerating punctuation in phrases and slugs."""
    if not text or not keyword:
        return 0

    keyword = keyword.lower().strip()
    parts = [re.escape(part) for part in keyword.split() if part]
    if not parts:
        return 0

    if len(parts) == 1:
        pattern = rf"(?<![a-z0-9]){parts[0]}(?![a-z0-9])"
    else:
        separator = r"[\W_]+"
        pattern = rf"(?<![a-z0-9]){separator.join(parts)}(?![a-z0-9])"

    return len(re.findall(pattern, text))

def get_language(text: str) -> str:
    try:
        # Require enough text to accurately detect language
        if len(text.strip()) > 20:
            lang = detect(text)
            # Normalize language codes (e.g. zh-cn -> zh, ja-jp -> ja)
            if lang.startswith("zh"):
                lang = "zh"
            elif lang.startswith("ja"):
                lang = "ja"
            elif lang.startswith("ko"):
                lang = "ko"
                
            if lang in LANGUAGE_KEYWORDS:
                return lang
    except Exception:
        pass
    return "en"

def preprocess_domain_name(domain: str) -> str:
    """
    Extracts the domain name and appends any embedded threat keywords as separate words.
    This bypasses boundary checks for squished words like 'bestxxxpornvideos' or 'slotgacor777'.
    """
    if not domain:
        return ""
    
    domain_lower = domain.lower()
    # Strip protocol and path if present
    domain_clean = domain_lower.removeprefix("http://").removeprefix("https://").split("/")[0].split(":")[0]
    # Strip any top-level domain suffix (e.g. .com, .co.uk, .casino, .online)
    domain_clean = re.sub(r"\.[a-z]{2,}(?:\.[a-z]{2,})?$", "", domain_clean)
            
    found_keywords = []
    for lang, categories in LANGUAGE_KEYWORDS.items():
        positive_kws = categories.get("positive_keywords", {})
        for category, keywords in positive_kws.items():
            for kw in keywords.keys():
                kw_clean = kw.lower().strip()
                kw_spaceless = kw_clean.replace(" ", "")
                # Skip very short keywords to avoid noise, check if spaceless keyword is a substring of the clean domain
                if len(kw_spaceless) >= 3 and kw_spaceless in domain_clean:
                    found_keywords.append(kw_clean)
                    
    # Combine original domain, all found keywords, and sub-segments split by non-alphanumeric chars
    words = [domain_lower] + found_keywords + re.split(r"[\W_]+", domain_lower)
    
    seen = set()
    unique_words = []
    for w in words:
        if w and w not in seen:
            seen.add(w)
            unique_words.append(w)
            
    return " ".join(unique_words)

def analyze_snapshot_content(
    html_content: str, 
    domain: Optional[str] = None, 
    redirect_url: Optional[str] = None
) -> Tuple[int, Dict[str, int], List[Dict[str, Any]]]:
    """
    Cleans raw HTML, detects language, scans for risk keywords (with context-aware 
    thresholds and negative keywords), and computes the risk score.
    Now scans redirect target URLs for embedded threat keywords.

    returns (snapshot_risk_score, category_scores, list_of_triggered_flags).
    """
    if not html_content and not redirect_url and not domain:
        return 0, {}, []

    # Clean the HTML content to obtain readable lowercase text (meta tags + full body content)
    meta_text = extract_meta_tags_content(html_content or "")
    body_text = clean_html_content(html_content or "")
    cleaned_text = f"{meta_text} {body_text}".lower()
    if domain:
        cleaned_text = f"{preprocess_domain_name(domain)} {cleaned_text}"
    if redirect_url:
        cleaned_text = f"{preprocess_domain_name(redirect_url)} {cleaned_text}"
    scan_text = f"{cleaned_text} {normalize_obfuscated_text(cleaned_text)}"
    
    lang = get_language(cleaned_text)
    lang_dict = LANGUAGE_KEYWORDS.get(lang) or LANGUAGE_KEYWORDS.get("en", {})
    positive_kws = lang_dict.get("positive_keywords", {})
    negative_kws = lang_dict.get("negative_keywords", {})

    total_score = 0
    flags = []
    category_scores = {}

    for category, keywords in positive_kws.items():
        category_score = 0
        neg_keywords = negative_kws.get(category, {})

        for keyword, (weight, min_matches) in keywords.items():
            matches = keyword_match_count(scan_text, keyword)
            if matches >= min_matches:
                # Contribute to score
                flags.append({
                    "category": category,
                    "keyword": keyword,
                    "weight": weight,
                    "match_count": matches
                })
                category_score += weight
                
        # Apply negative keywords (false positive filter)
        for neg_kw, neg_weight in neg_keywords.items():
            if keyword_match_count(scan_text, neg_kw) > 0:
                category_score -= neg_weight
                
        category_score = max(0, category_score) # No negative scores
        if category_score == 0:
            flags = [f for f in flags if f.get("category") != category]

        # Apply per-category cap for total score, but keep actual category score for confidence
        capped_cat_score = min(category_score, CATEGORY_SCORE_CAP)
        total_score += capped_cat_score
        category_scores[category] = min(category_score, 100) # Confidence out of 100

    # Cap final score at 100
    final_score = min(total_score, 100)

    # Enrich flags with location data
    matched_kws = [f.get("keyword") for f in flags if isinstance(f, dict) and f.get("keyword")]
    locations = find_keyword_locations(html_content, matched_kws)
    for flag in flags:
        if not isinstance(flag, dict) or not flag.get("keyword"):
            continue
        flag_kw = flag.get("keyword", "").lower()
        flag_locs = [loc for loc in locations if loc.get("keyword", "").lower() == flag_kw]
        if flag_locs:
            flag["element"] = flag_locs[0]["element"]
            flag["matched_text"] = flag_locs[0]["matched_text"]
            flag["snippet"] = flag_locs[0]["snippet"]
            flag["position"] = flag_locs[0]["position"]
        else:
            flag["element"] = "<body>"
            flag["matched_text"] = flag.get("keyword", "")
            flag["snippet"] = f"Keyword match found ({flag.get('match_count', 1)} times)"
            flag["position"] = 0

    return final_score, category_scores, flags
