from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional, Dict, Any

class DomainRequest(BaseModel):
    domain: str = Field(..., description="The domain to analyze", example="example.com")
    force_refresh: bool = Field(default=False, description="Bypass Redis cache and force re-analysis")

class AnalysisFlagSchema(BaseModel):
    category: str
    keyword: str
    weight: int
    match_count: int
    element: Optional[str] = None
    matched_text: Optional[str] = None
    snippet: Optional[str] = None
    position: Optional[int] = None

    class Config:
        from_attributes = True

class DetectorSignalSchema(BaseModel):
    detector: str
    signal: str
    model_config = {"extra": "allow"}

class AIClassificationSchema(BaseModel):
    primary_category: Optional[str] = None
    confidence: Optional[float] = None
    all_scores: Optional[Dict[str, float]] = None
    detected_language: Optional[str] = None
    summary: Optional[str] = None
    detectors: Optional[List[Dict[str, Any]]] = None
    detector_boost: Optional[int] = None

class SnapshotSchema(BaseModel):
    timestamp: str
    original_url: str
    status_code: Optional[int] = None
    redirect_url: Optional[str] = None
    is_redirect: bool = False
    mime_type: Optional[str] = None
    risk_score: int
    detected_language: Optional[str] = None
    content_category: Optional[str] = None
    category_confidence: Optional[float] = None
    content_summary: Optional[str] = None
    evidence_url: Optional[str] = None
    # Advanced Redirect Engine Telemetry
    redirect_detected: bool = False
    redirect_method: Optional[str] = None
    redirect_confidence: int = 0
    redirect_verified: bool = False
    redirect_same_domain: bool = False
    redirect_target: Optional[str] = None
    redirect_target_status: Optional[int] = None
    redirect_target_category: Optional[str] = None
    redirect_target_risk: int = 0
    original_category: Optional[str] = None
    original_risk: int = 0
    redirect_evidence: Optional[List[str]] = None
    ai_intelligence: Optional[AIClassificationSchema] = None
    flags: List[AnalysisFlagSchema] = []

    class Config:
        from_attributes = True

class TimelineEntrySchema(BaseModel):
    year: int
    category: str
    category_label: Optional[str] = None
    category_icon: Optional[str] = None
    risk_score: float
    peak_score: int
    snapshot_count: int
    summary: Optional[str] = None

class ThreatIntelSchema(BaseModel):
    provider: str
    status: str
    confidence: Optional[float] = None
    verdict: Optional[str] = None
    screenshot_url: Optional[str] = None
    raw_response: Optional[str] = None
    fetched_at: Optional[str] = None

class DomainAnalysisResponse(BaseModel):
    domain: str
    risk_score: int
    risk_level: str
    peak_score: int
    avg_score: int
    category_confidence: Dict[str, float] = {}
    flags: List[str] = Field(description="Unique flagged risk categories across snapshots")
    snapshots_checked: int
    last_updated: datetime
    history_summary: List[Dict[str, Any]] = []
    snapshots: List[SnapshotSchema] = []
    # Intelligence enrichments
    primary_category: Optional[str] = None
    risk_narrative: Optional[str] = None
    evidence_bullets: Optional[List[str]] = None
    risk_period: Optional[str] = None
    ai_confidence: Optional[float] = None
    timeline: Optional[List[TimelineEntrySchema]] = None
    threat_intel: Optional[List[ThreatIntelSchema]] = None
    threat_overall: Optional[str] = None

    class Config:
        from_attributes = True

class DomainAnalysisSubmitResponse(BaseModel):
    task_id: str
    message: str = "Analysis started in background"
