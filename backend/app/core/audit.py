"""
Audit helper — writes immutable ActivityLog rows for every admin action.
Import and call `log_action` at the end of any mutating admin endpoint.
"""
from datetime import datetime
from typing import Optional, Any

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.activity_log import ActivityLog
from backend.app.utils.logger import logger


def _parse_user_agent(ua_string: Optional[str]) -> tuple[str, str, str]:
    """
    Parse a User-Agent string into (browser, os, device).
    Returns ('Unknown', 'Unknown', 'Unknown') on failure.
    """
    if not ua_string:
        return "Unknown", "Unknown", "Unknown"
    try:
        import user_agents  # type: ignore
        ua = user_agents.parse(ua_string)
        browser = ua.browser.family or "Unknown"
        os_name = ua.os.family or "Unknown"
        device = ua.device.family or "Other"
        return browser, os_name, device
    except Exception:
        return "Unknown", "Unknown", "Unknown"


def _infer_category_and_severity(action: str, status: str) -> tuple[str, str]:
    act = action.upper()
    
    # Severity default
    severity = "INFO"
    if status.lower() in ("failed", "error", "failure"):
        severity = "ERROR"
    elif "DELETE" in act or "SUSPEND" in act or "LOCK" in act or "PURGE" in act:
        severity = "WARNING"
    elif "SECURITY" in act or "THREAT" in act or "ALERT" in act:
        severity = "CRITICAL"

    # Category default
    if any(k in act for k in ["LOGIN", "LOGOUT", "REGISTER", "PASSWORD", "AUTH"]):
        category = "AUTHENTICATION"
    elif any(k in act for k in ["USER", "ROLE", "SUSPEND", "ACTIVATE"]):
        category = "USER_MANAGEMENT"
    elif any(k in act for k in ["SCAN", "CRAWL", "PIPELINE"]):
        category = "SECURITY_SCAN"
    elif any(k in act for k in ["AI", "ANALYSIS", "LLM", "PROMPT"]):
        category = "AI_ANALYSIS"
    elif any(k in act for k in ["DOMAIN", "SNAPSHOT", "WAYBACK", "MONITOR"]):
        category = "DOMAIN_OPERATIONS"
    elif any(k in act for k in ["SYSTEM", "SETTINGS", "CONFIG", "CLEANUP"]):
        category = "SYSTEM_SETTINGS"
    elif any(k in act for k in ["EXPORT", "DOWNLOAD", "REPORT"]):
        category = "EXPORT"
    else:
        category = "GENERAL"

    return category, severity


async def log_action(
    db: AsyncSession,
    *,
    user_id: Optional[int],
    username: Optional[str],
    user_role: Optional[Any],
    action: str,
    category: Optional[str] = None,
    severity: Optional[str] = None,
    object_type: Optional[str] = None,
    object_id: Optional[Any] = None,
    object_label: Optional[str] = None,
    old_value: Optional[dict] = None,
    new_value: Optional[dict] = None,
    ip_address: Optional[str] = None,
    user_agent_string: Optional[str] = None,
    endpoint: Optional[str] = None,
    execution_time_ms: Optional[int] = None,
    status: str = "success",
    error_message: Optional[str] = None,
) -> None:
    """
    Write an immutable audit log entry.
    This function is fire-and-forget — errors are logged but never raised.
    """
    try:
        browser, os_name, device = _parse_user_agent(user_agent_string)
        
        inf_cat, inf_sev = _infer_category_and_severity(action, status)
        final_category = category or inf_cat
        final_severity = severity or inf_sev

        role_str = (
            user_role.value if hasattr(user_role, 'value') else str(user_role)
        ) if user_role is not None else None

        log_entry = ActivityLog(
            user_id=user_id,
            username_snapshot=username,
            user_role_snapshot=role_str,
            action=action,
            category=final_category,
            severity=final_severity,
            object_type=object_type,
            object_id=str(object_id) if object_id is not None else None,
            object_label=object_label,
            old_value=old_value,
            new_value=new_value,
            ip_address=ip_address,
            user_agent=user_agent_string,
            browser=browser,
            os=os_name,
            device=device,
            endpoint=endpoint,
            execution_time_ms=execution_time_ms,
            status=status,
            error_message=error_message,
            created_at=datetime.utcnow(),
        )
        db.add(log_entry)
        await db.flush()
    except Exception as err:
        logger.error(f"Failed to write audit log: {err}")
