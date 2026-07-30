from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Dashboard Stats
# ---------------------------------------------------------------------------
class DashboardStatsResponse(BaseModel):
    # User stats
    total_users: int = 0
    total_admins: int = 0
    total_super_admins: int = 0
    active_users: int = 0
    suspended_users: int = 0

    # Domain scan stats
    total_domains_checked: int = 0
    todays_checks: int = 0
    unsafe_domains: int = 0
    safe_domains: int = 0
    pending_checks: int = 0

    # Chart data
    checks_per_day: List[Dict[str, Any]] = []       # [{date, count}]
    safe_vs_unsafe: Dict[str, int] = {}              # {SAFE: n, MEDIUM: n, HIGH: n}
    most_checked_domains: List[Dict[str, Any]] = []  # [{domain, count}]
    users_activity: List[Dict[str, Any]] = []        # [{date, logins}]


# ---------------------------------------------------------------------------
# Scan Records
# ---------------------------------------------------------------------------
class ScanRecordResponse(BaseModel):
    id: int
    domain_name: str
    user_id: Optional[int] = None
    username: Optional[str] = None
    status: str
    risk_score: Optional[int] = None
    risk_level: Optional[str] = None
    duration_ms: Optional[int] = None
    source: str
    wayback_status: Optional[str] = None
    checked_at: datetime

    model_config = {"from_attributes": True}


class ScanRecordListResponse(BaseModel):
    records: List[ScanRecordResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ---------------------------------------------------------------------------
# Activity Logs
# ---------------------------------------------------------------------------
class ActivityLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    username_snapshot: Optional[str] = None
    user_role_snapshot: Optional[str] = None
    action: str
    category: Optional[str] = None
    severity: Optional[str] = "INFO"
    object_type: Optional[str] = None
    object_id: Optional[str] = None
    object_label: Optional[str] = None
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    browser: Optional[str] = None
    os: Optional[str] = None
    device: Optional[str] = None
    endpoint: Optional[str] = None
    execution_time_ms: Optional[int] = None
    status: str
    error_message: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ActivityLogListResponse(BaseModel):
    logs: List[ActivityLogResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class SpecificUserActivitySummaryResponse(BaseModel):
    user_id: int
    username: str
    full_name: str
    email: str
    role: str
    status: str
    last_login_at: Optional[datetime] = None
    last_active_at: Optional[datetime] = None
    total_actions: int = 0
    total_scans: int = 0
    safe_domains_count: int = 0
    medium_domains_count: int = 0
    unsafe_domains_count: int = 0
    risk_breakdown: Dict[str, int] = {}
    recent_ips: List[str] = []
    top_categories: Dict[str, int] = {}
    recent_scanned_domains: List[Dict[str, Any]] = []
    logs: List[ActivityLogResponse] = []


class ActiveUserSessionResponse(BaseModel):
    user_id: int
    username: str
    full_name: str
    email: str
    role: str
    last_active_at: datetime
    is_online: bool
    status_label: str
    last_action: Optional[str] = None
    last_endpoint: Optional[str] = None
    last_ip: Optional[str] = None
    last_browser: Optional[str] = None
    total_scans: int = 0
    safe_scans: int = 0
    unsafe_scans: int = 0


class ActivityMetricsResponse(BaseModel):
    total_events: int = 0
    success_rate_percent: float = 100.0
    categories_breakdown: Dict[str, int] = {}
    severity_breakdown: Dict[str, int] = {}
    top_active_users: List[Dict[str, Any]] = []
    hourly_trend: List[Dict[str, Any]] = []


# ---------------------------------------------------------------------------
# Login History
# ---------------------------------------------------------------------------
class LoginHistoryResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    username_attempted: str
    user_role_snapshot: Optional[str] = None
    ip_address: Optional[str] = None
    browser: Optional[str] = None
    os: Optional[str] = None
    country: Optional[str] = None
    success: bool
    failure_reason: Optional[str] = None
    login_at: datetime
    logout_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class LoginHistoryListResponse(BaseModel):
    records: List[LoginHistoryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
class NotificationResponse(BaseModel):
    id: int
    notification_type: str
    title: str
    message: str
    is_read: bool
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# System Settings
# ---------------------------------------------------------------------------
class SystemSettingResponse(BaseModel):
    id: int
    key: str
    value: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    updated_at: datetime

    model_config = {"from_attributes": True}


class SystemSettingUpdate(BaseModel):
    value: Optional[str] = None


class BulkSystemSettingsUpdate(BaseModel):
    settings: Dict[str, Optional[str]]  # {key: value}
