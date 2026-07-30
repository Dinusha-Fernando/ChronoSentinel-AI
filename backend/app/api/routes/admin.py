"""
Admin routes: dashboard stats, activity logs, login history, scan records,
notifications, system settings, and export.
"""
import csv
import io
from datetime import datetime, date, timedelta, timezone
from math import ceil
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, and_, text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.core.dependencies import require_admin, require_super_admin, get_current_user, get_client_ip
from backend.app.core.audit import log_action
from backend.app.models.user import User, UserRole
from backend.app.models.activity_log import ActivityLog
from backend.app.models.login_history import LoginHistory
from backend.app.models.scan_record import ScanRecord
from backend.app.models.notification import Notification
from backend.app.models.system_settings import SystemSettings
from backend.app.models.domain import Domain
from backend.app.schemas.admin_schema import (
    DashboardStatsResponse,
    ScanRecordListResponse, ScanRecordResponse,
    ActivityLogListResponse, ActivityLogResponse,
    SpecificUserActivitySummaryResponse, ActiveUserSessionResponse, ActivityMetricsResponse,
    LoginHistoryListResponse, LoginHistoryResponse,
    NotificationResponse,
    SystemSettingResponse, BulkSystemSettingsUpdate,
)
from backend.app.utils.logger import logger, LOG_FILE_PATH

router = APIRouter()
_UTC = timezone.utc


def _utcnow() -> datetime:
    return datetime.now(_UTC).replace(tzinfo=None)


def _today_range() -> tuple[datetime, datetime]:
    today = date.today()
    start = datetime(today.year, today.month, today.day)
    return start, start + timedelta(days=1)


# ---------------------------------------------------------------------------
# GET /admin/stats — dashboard statistics
# ---------------------------------------------------------------------------
@router.get("/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    # User counts
    total_users = (await db.execute(
        select(func.count(User.id)).where(User.is_deleted == False, User.role == UserRole.user)
    )).scalar() or 0
    total_admins = (await db.execute(
        select(func.count(User.id)).where(User.is_deleted == False, User.role == UserRole.admin)
    )).scalar() or 0
    total_super_admins = (await db.execute(
        select(func.count(User.id)).where(User.is_deleted == False, User.role == UserRole.super_admin)
    )).scalar() or 0
    active_users = (await db.execute(
        select(func.count(User.id)).where(User.is_deleted == False, User.status == "active")
    )).scalar() or 0
    suspended_users = (await db.execute(
        select(func.count(User.id)).where(User.is_deleted == False, User.status == "suspended")
    )).scalar() or 0

    # Domain scan counts
    total_scans = (await db.execute(select(func.count(ScanRecord.id)))).scalar() or 0
    today_start, today_end = _today_range()
    todays_checks = (await db.execute(
        select(func.count(ScanRecord.id)).where(
            ScanRecord.checked_at >= today_start,
            ScanRecord.checked_at < today_end,
        )
    )).scalar() or 0
    unsafe_domains = (await db.execute(
        select(func.count(Domain.id)).where(Domain.risk_level.in_(["HIGH", "MEDIUM"]))
    )).scalar() or 0
    safe_domains = (await db.execute(
        select(func.count(Domain.id)).where(Domain.risk_level == "SAFE")
    )).scalar() or 0

    # Checks per day (last 30 days)
    thirty_days_ago = _utcnow() - timedelta(days=30)
    daily_rows = await db.execute(
        select(
            func.date(ScanRecord.checked_at).label("day"),
            func.count(ScanRecord.id).label("count"),
        )
        .where(ScanRecord.checked_at >= thirty_days_ago)
        .group_by(func.date(ScanRecord.checked_at))
        .order_by(func.date(ScanRecord.checked_at))
    )
    checks_per_day = [{"date": str(row.day), "count": row.count} for row in daily_rows]

    # Safe vs Unsafe breakdown
    risk_rows = await db.execute(
        select(Domain.risk_level, func.count(Domain.id)).group_by(Domain.risk_level)
    )
    safe_vs_unsafe = {row[0]: row[1] for row in risk_rows}

    # Most checked domains (top 10)
    top_domains_rows = await db.execute(
        select(ScanRecord.domain_name, func.count(ScanRecord.id).label("count"))
        .group_by(ScanRecord.domain_name)
        .order_by(func.count(ScanRecord.id).desc())
        .limit(10)
    )
    most_checked_domains = [{"domain": row[0], "count": row[1]} for row in top_domains_rows]

    # Users activity (logins per day, last 30 days)
    login_rows = await db.execute(
        select(
            func.date(LoginHistory.login_at).label("day"),
            func.count(LoginHistory.id).label("logins"),
        )
        .where(LoginHistory.login_at >= thirty_days_ago, LoginHistory.success == True)
        .group_by(func.date(LoginHistory.login_at))
        .order_by(func.date(LoginHistory.login_at))
    )
    users_activity = [{"date": str(row.day), "logins": row.logins} for row in login_rows]

    return DashboardStatsResponse(
        total_users=total_users,
        total_admins=total_admins,
        total_super_admins=total_super_admins,
        active_users=active_users,
        suspended_users=suspended_users,
        total_domains_checked=total_scans,
        todays_checks=todays_checks,
        unsafe_domains=unsafe_domains,
        safe_domains=safe_domains,
        checks_per_day=checks_per_day,
        safe_vs_unsafe=safe_vs_unsafe,
        most_checked_domains=most_checked_domains,
        users_activity=users_activity,
    )


# ---------------------------------------------------------------------------
# GET /admin/scan-records
# ---------------------------------------------------------------------------
@router.get("/scan-records", response_model=ScanRecordListResponse)
async def get_scan_records(
    domain: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    risk_level: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    stmt = select(ScanRecord)
    if domain:
        stmt = stmt.where(ScanRecord.domain_name.ilike(f"%{domain}%"))
    if user_id:
        stmt = stmt.where(ScanRecord.user_id == user_id)
    if risk_level:
        stmt = stmt.where(ScanRecord.risk_level == risk_level)
    if date_from:
        stmt = stmt.where(ScanRecord.checked_at >= datetime.fromisoformat(date_from))
    if date_to:
        stmt = stmt.where(ScanRecord.checked_at <= datetime.fromisoformat(date_to))

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar() or 0
    stmt = stmt.order_by(ScanRecord.checked_at.desc()).offset((page - 1) * page_size).limit(page_size)
    records = (await db.execute(stmt)).scalars().all()

    # Enrich with usernames
    enriched = []
    for rec in records:
        username = None
        if rec.user_id:
            u = (await db.execute(select(User.username).where(User.id == rec.user_id))).scalar_one_or_none()
            username = u
        enriched.append(ScanRecordResponse(
            id=rec.id,
            domain_name=rec.domain_name,
            user_id=rec.user_id,
            username=username,
            status=rec.status,
            risk_score=rec.risk_score,
            risk_level=rec.risk_level,
            duration_ms=rec.duration_ms,
            source=rec.source,
            wayback_status=rec.wayback_status,
            checked_at=rec.checked_at,
        ))

    return ScanRecordListResponse(
        records=enriched,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=ceil(total / page_size) if total else 1,
    )


# ---------------------------------------------------------------------------
# GET /admin/activity-logs
# ---------------------------------------------------------------------------
@router.get("/activity-logs", response_model=ActivityLogListResponse)
async def get_activity_logs(
    user_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    stmt = select(ActivityLog)
    if user_id:
        stmt = stmt.where(ActivityLog.user_id == user_id)
    if category:
        stmt = stmt.where(ActivityLog.category == category)
    if severity:
        stmt = stmt.where(ActivityLog.severity == severity)
    if action:
        stmt = stmt.where(ActivityLog.action.ilike(f"%{action}%"))
    if status:
        stmt = stmt.where(ActivityLog.status == status)
    if search:
        search_pattern = f"%{search}%"
        stmt = stmt.where(
            (ActivityLog.username_snapshot.ilike(search_pattern)) |
            (ActivityLog.action.ilike(search_pattern)) |
            (ActivityLog.object_label.ilike(search_pattern)) |
            (ActivityLog.ip_address.ilike(search_pattern)) |
            (ActivityLog.endpoint.ilike(search_pattern))
        )
    if date_from:
        stmt = stmt.where(ActivityLog.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        stmt = stmt.where(ActivityLog.created_at <= datetime.fromisoformat(date_to))

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar() or 0
    stmt = stmt.order_by(ActivityLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    logs = (await db.execute(stmt)).scalars().all()

    return ActivityLogListResponse(
        logs=[ActivityLogResponse.model_validate(l) for l in logs],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=ceil(total / page_size) if total else 1,
    )


# ---------------------------------------------------------------------------
# GET /admin/users/{user_id}/activity-summary
# ---------------------------------------------------------------------------
@router.get("/users/{user_id}/activity-summary", response_model=SpecificUserActivitySummaryResponse)
async def get_user_activity_summary(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    user_res = await db.execute(select(User).where(User.id == user_id, User.is_deleted == False))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Fetch recent activity logs
    logs_stmt = select(ActivityLog).where(ActivityLog.user_id == user_id).order_by(ActivityLog.created_at.desc()).limit(50)
    logs = (await db.execute(logs_stmt)).scalars().all()

    # Total actions & scans
    total_actions_stmt = select(func.count(ActivityLog.id)).where(ActivityLog.user_id == user_id)
    total_actions = (await db.execute(total_actions_stmt)).scalar() or 0

    # Scans & Risk Breakdown
    scans_stmt = select(ScanRecord).where(ScanRecord.user_id == user_id).order_by(ScanRecord.checked_at.desc())
    scans = (await db.execute(scans_stmt)).scalars().all()
    total_scans = len(scans)

    safe_count = 0
    medium_count = 0
    unsafe_count = 0
    risk_breakdown = {"SAFE": 0, "MEDIUM": 0, "UNSAFE": 0}
    recent_scanned_domains = []

    for s in scans:
        r_lvl = (s.risk_level or "SAFE").upper()
        if r_lvl in ("SAFE", "LOW", "CLEAN"):
            safe_count += 1
            risk_breakdown["SAFE"] += 1
        elif r_lvl in ("MEDIUM", "MODERATE", "SUSPICIOUS"):
            medium_count += 1
            risk_breakdown["MEDIUM"] += 1
        else:
            unsafe_count += 1
            risk_breakdown["UNSAFE"] += 1

    for s in scans[:15]:
        recent_scanned_domains.append({
            "id": s.id,
            "domain_name": s.domain_name,
            "status": s.status,
            "risk_score": s.risk_score,
            "risk_level": s.risk_level or "SAFE",
            "source": s.source,
            "checked_at": s.checked_at,
        })

    # Recent IPs
    ips_stmt = select(ActivityLog.ip_address).where(ActivityLog.user_id == user_id, ActivityLog.ip_address.isnot(None)).distinct().limit(5)
    recent_ips = [ip for ip in (await db.execute(ips_stmt)).scalars().all() if ip]

    # Category breakdown
    cat_stmt = select(ActivityLog.category, func.count(ActivityLog.id)).where(ActivityLog.user_id == user_id).group_by(ActivityLog.category)
    cat_rows = (await db.execute(cat_stmt)).all()
    top_categories = {cat or "GENERAL": count for cat, count in cat_rows}

    return SpecificUserActivitySummaryResponse(
        user_id=user.id,
        username=user.username,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        status=user.status,
        last_login_at=user.last_login_at,
        last_active_at=user.last_active_at,
        total_actions=total_actions,
        total_scans=total_scans,
        safe_domains_count=safe_count,
        medium_domains_count=medium_count,
        unsafe_domains_count=unsafe_count,
        risk_breakdown=risk_breakdown,
        recent_ips=recent_ips,
        top_categories=top_categories,
        recent_scanned_domains=recent_scanned_domains,
        logs=[ActivityLogResponse.model_validate(l) for l in logs],
    )


# ---------------------------------------------------------------------------
# GET /admin/active-sessions
# ---------------------------------------------------------------------------
@router.get("/active-sessions", response_model=List[ActiveUserSessionResponse])
async def get_active_sessions(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    # Retrieve non-deleted users
    users_stmt = select(User).where(User.is_deleted == False).order_by(User.last_active_at.desc().nullslast())
    users = (await db.execute(users_stmt)).scalars().all()

    now = datetime.utcnow()
    sessions = []

    for u in users:
        # Latest activity log entry for user
        last_log_stmt = select(ActivityLog).where(ActivityLog.user_id == u.id).order_by(ActivityLog.created_at.desc()).limit(1)
        last_log = (await db.execute(last_log_stmt)).scalar_one_or_none()

        # Count scans & risk breakdown for user session summary
        scans_count_stmt = select(func.count(ScanRecord.id)).where(ScanRecord.user_id == u.id)
        u_total_scans = (await db.execute(scans_count_stmt)).scalar() or 0

        u_safe_scans_stmt = select(func.count(ScanRecord.id)).where(
            ScanRecord.user_id == u.id,
            func.upper(ScanRecord.risk_level).in_(["SAFE", "LOW", "CLEAN"])
        )
        u_safe_scans = (await db.execute(u_safe_scans_stmt)).scalar() or 0
        u_unsafe_scans = u_total_scans - u_safe_scans

        last_active = u.last_active_at or (last_log.created_at if last_log else None) or u.created_at
        diff_mins = (now - last_active).total_seconds() / 60.0 if last_active else 999999

        if diff_mins <= 5:
            is_online = True
            status_label = "Online Now"
        elif diff_mins <= 15:
            is_online = True
            status_label = "Active (last 15m)"
        elif diff_mins <= 60:
            is_online = False
            status_label = "Idle (last 1h)"
        else:
            is_online = False
            status_label = "Offline"

        sessions.append(ActiveUserSessionResponse(
            user_id=u.id,
            username=u.username,
            full_name=u.full_name,
            email=u.email,
            role=u.role,
            last_active_at=last_active,
            is_online=is_online,
            status_label=status_label,
            last_action=last_log.action if last_log else "No recent activity",
            last_endpoint=last_log.endpoint if last_log else None,
            last_ip=last_log.ip_address if last_log else None,
            last_browser=last_log.browser if last_log else None,
            total_scans=u_total_scans,
            safe_scans=u_safe_scans,
            unsafe_scans=u_unsafe_scans,
        ))

    return sessions


# ---------------------------------------------------------------------------
# GET /admin/activity-metrics
# ---------------------------------------------------------------------------
@router.get("/activity-metrics", response_model=ActivityMetricsResponse)
async def get_activity_metrics(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    total_stmt = select(func.count(ActivityLog.id))
    total_events = (await db.execute(total_stmt)).scalar() or 0

    success_stmt = select(func.count(ActivityLog.id)).where(ActivityLog.status == "success")
    success_events = (await db.execute(success_stmt)).scalar() or 0

    success_rate = round((success_events / total_events) * 100, 1) if total_events > 0 else 100.0

    # Category breakdown
    cat_stmt = select(ActivityLog.category, func.count(ActivityLog.id)).group_by(ActivityLog.category)
    cat_rows = (await db.execute(cat_stmt)).all()
    categories_breakdown = {cat or "GENERAL": count for cat, count in cat_rows}

    # Severity breakdown
    sev_stmt = select(ActivityLog.severity, func.count(ActivityLog.id)).group_by(ActivityLog.severity)
    sev_rows = (await db.execute(sev_stmt)).all()
    severity_breakdown = {sev or "INFO": count for sev, count in sev_rows}

    # Top active users
    top_u_stmt = (
        select(ActivityLog.user_id, ActivityLog.username_snapshot, func.count(ActivityLog.id).label("count"))
        .where(ActivityLog.user_id.isnot(None))
        .group_by(ActivityLog.user_id, ActivityLog.username_snapshot)
        .order_by(text("count DESC"))
        .limit(5)
    )
    top_users = [{"user_id": r[0], "username": r[1] or "Unknown", "count": r[2]} for r in (await db.execute(top_u_stmt)).all()]

    return ActivityMetricsResponse(
        total_events=total_events,
        success_rate_percent=success_rate,
        categories_breakdown=categories_breakdown,
        severity_breakdown=severity_breakdown,
        top_active_users=top_users,
        hourly_trend=[],
    )


# ---------------------------------------------------------------------------
# GET /admin/login-history
# ---------------------------------------------------------------------------
@router.get("/login-history", response_model=LoginHistoryListResponse)
async def get_login_history(
    user_id: Optional[int] = Query(None),
    success: Optional[bool] = Query(None),
    role: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    stmt = select(LoginHistory)
    if user_id:
        stmt = stmt.where(LoginHistory.user_id == user_id)
    if success is not None:
        stmt = stmt.where(LoginHistory.success == success)
    if role:
        stmt = stmt.where(LoginHistory.user_role_snapshot == role)
    if date_from:
        stmt = stmt.where(LoginHistory.login_at >= datetime.fromisoformat(date_from))
    if date_to:
        stmt = stmt.where(LoginHistory.login_at <= datetime.fromisoformat(date_to))

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar() or 0
    stmt = stmt.order_by(LoginHistory.login_at.desc()).offset((page - 1) * page_size).limit(page_size)
    records = (await db.execute(stmt)).scalars().all()

    return LoginHistoryListResponse(
        records=[LoginHistoryResponse.model_validate(r) for r in records],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=ceil(total / page_size) if total else 1,
    )


# ---------------------------------------------------------------------------
# GET /admin/notifications
# ---------------------------------------------------------------------------
@router.get("/notifications")
async def get_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role_val = str(getattr(current_user.role, "value", current_user.role)).lower()
    is_admin = role_val in ("admin", "super_admin", "superadmin")

    stmt = select(Notification)
    if not is_admin:
        stmt = stmt.where(
            (Notification.recipient_user_id == current_user.id) |
            (Notification.recipient_user_id.is_(None))
        )

    if unread_only:
        stmt = stmt.where(Notification.is_read == False)
    stmt = stmt.order_by(Notification.created_at.desc()).limit(limit)
    notifications = (await db.execute(stmt)).scalars().all()

    unread_stmt = select(func.count(Notification.id)).where(Notification.is_read == False)
    if not is_admin:
        unread_stmt = unread_stmt.where(
            (Notification.recipient_user_id == current_user.id) |
            (Notification.recipient_user_id.is_(None))
        )
    unread_count = (await db.execute(unread_stmt)).scalar() or 0

    return {
        "notifications": [NotificationResponse.model_validate(n) for n in notifications],
        "unread_count": unread_count,
    }


# ---------------------------------------------------------------------------
# PATCH /admin/notifications/{id}/read
# ---------------------------------------------------------------------------
@router.patch("/notifications/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_notification_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Notification).where(Notification.id == notification_id))
    notif: Notification | None = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    notif.is_read = True


# ---------------------------------------------------------------------------
# PATCH /admin/notifications/mark-all-read
# ---------------------------------------------------------------------------
@router.patch("/notifications/mark-all-read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import update
    role_val = str(getattr(current_user.role, "value", current_user.role)).lower()
    is_admin = role_val in ("admin", "super_admin", "superadmin")

    stmt = update(Notification).where(Notification.is_read == False).values(is_read=True)
    if not is_admin:
        stmt = stmt.where(
            (Notification.recipient_user_id == current_user.id) |
            (Notification.recipient_user_id.is_(None))
        )
    await db.execute(stmt)


# ---------------------------------------------------------------------------
# GET /admin/settings (Super Admin only)
# ---------------------------------------------------------------------------
@router.get("/settings")
async def get_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    settings_rows = (await db.execute(select(SystemSettings).order_by(SystemSettings.category, SystemSettings.key))).scalars().all()
    return [SystemSettingResponse.model_validate(s) for s in settings_rows]


# ---------------------------------------------------------------------------
# PUT /admin/settings (Super Admin only)
# ---------------------------------------------------------------------------
@router.put("/settings", status_code=status.HTTP_204_NO_CONTENT)
async def update_settings(
    request: Request,
    body: BulkSystemSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    for key, value in body.settings.items():
        result = await db.execute(select(SystemSettings).where(SystemSettings.key == key))
        setting: SystemSettings | None = result.scalar_one_or_none()
        if setting:
            old_val = setting.value
            setting.value = value
            setting.updated_by = current_user.id
            setting.updated_at = _utcnow()
            await log_action(
                db,
                user_id=current_user.id,
                username=current_user.username,
                user_role=current_user.role,
                action="UPDATE_SETTING",
                object_type="SystemSettings",
                object_id=setting.id,
                object_label=key,
                old_value={"value": old_val},
                new_value={"value": value},
                ip_address=get_client_ip(request),
                user_agent_string=request.headers.get("User-Agent"),
            )
        else:
            new_setting = SystemSettings(key=key, value=value, updated_by=current_user.id, updated_at=_utcnow())
            db.add(new_setting)


# ---------------------------------------------------------------------------
# GET /admin/export/csv
# ---------------------------------------------------------------------------
@router.get("/export/csv")
async def export_csv(
    report_type: str = Query(..., description="activity_logs | login_history | scan_records | users"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    output = io.StringIO()

    if report_type == "users":
        writer = csv.writer(output)
        writer.writerow(["ID", "Full Name", "Username", "Email", "Role", "Status", "Department", "Created At", "Last Login"])
        rows = (await db.execute(select(User).where(User.is_deleted == False))).scalars().all()
        for u in rows:
            writer.writerow([u.id, u.full_name, u.username, u.email, u.role, u.status, u.department or "", u.created_at, u.last_login_at or ""])

    elif report_type == "login_history":
        writer = csv.writer(output)
        writer.writerow(["ID", "Username", "Role", "IP", "Browser", "Country", "Login At", "Logout At", "Success", "Failure Reason"])
        stmt = select(LoginHistory).order_by(LoginHistory.login_at.desc())
        if date_from:
            stmt = stmt.where(LoginHistory.login_at >= datetime.fromisoformat(date_from))
        if date_to:
            stmt = stmt.where(LoginHistory.login_at <= datetime.fromisoformat(date_to))
        rows = (await db.execute(stmt)).scalars().all()
        for r in rows:
            writer.writerow([r.id, r.username_attempted, r.user_role_snapshot or "", r.ip_address or "", r.browser or "", r.country or "", r.login_at, r.logout_at or "", r.success, r.failure_reason or ""])

    elif report_type == "activity_logs":
        writer = csv.writer(output)
        writer.writerow(["ID", "User", "Role", "Category", "Severity", "Action", "Object Type", "Object", "Endpoint", "Duration(ms)", "IP", "Browser", "Status", "Time"])
        stmt = select(ActivityLog).order_by(ActivityLog.created_at.desc())
        if date_from:
            stmt = stmt.where(ActivityLog.created_at >= datetime.fromisoformat(date_from))
        if date_to:
            stmt = stmt.where(ActivityLog.created_at <= datetime.fromisoformat(date_to))
        rows = (await db.execute(stmt)).scalars().all()
        for r in rows:
            writer.writerow([r.id, r.username_snapshot or "", r.user_role_snapshot or "", r.category or "GENERAL", r.severity or "INFO", r.action, r.object_type or "", r.object_label or "", r.endpoint or "", r.execution_time_ms or "", r.ip_address or "", r.browser or "", r.status, r.created_at])

    elif report_type == "scan_records":
        writer = csv.writer(output)
        writer.writerow(["ID", "Domain", "User ID", "Status", "Risk Score", "Risk Level", "Duration(ms)", "Source", "Wayback Status", "Checked At"])
        stmt = select(ScanRecord).order_by(ScanRecord.checked_at.desc())
        if date_from:
            stmt = stmt.where(ScanRecord.checked_at >= datetime.fromisoformat(date_from))
        if date_to:
            stmt = stmt.where(ScanRecord.checked_at <= datetime.fromisoformat(date_to))
        rows = (await db.execute(stmt)).scalars().all()
        for r in rows:
            writer.writerow([r.id, r.domain_name, r.user_id or "", r.status, r.risk_score or "", r.risk_level or "", r.duration_ms or "", r.source, r.wayback_status or "", r.checked_at])
    else:
        raise HTTPException(status_code=400, detail=f"Unknown report type: {report_type}")

    output.seek(0)
    filename = f"{report_type}_{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ---------------------------------------------------------------------------
# GET /admin/system-logs
# ---------------------------------------------------------------------------
@router.get("/system-logs")
async def get_system_logs(
    level: Optional[str] = Query(None, description="Filter by log level (INFO, WARNING, ERROR, CRITICAL)"),
    search: Optional[str] = Query(None, description="Search term in log messages"),
    limit: int = Query(200, ge=1, le=1000, description="Max number of log lines to return"),
    _: User = Depends(require_admin),
):
    import os
    if not os.path.exists(LOG_FILE_PATH):
        return {"logs": []}

    try:
        with open(LOG_FILE_PATH, "r", encoding="utf-8") as f:
            lines = f.readlines()
        
        parsed_logs = []
        current_log = None

        for line in lines:
            line_str = line.rstrip("\n")
            if not line_str:
                continue
            
            parts = line_str.split(" | ", 2)
            is_new_log = False
            if len(parts) >= 3 and len(parts[0]) == 19:
                try:
                    datetime.strptime(parts[0], "%Y-%m-%d %H:%M:%S")
                    is_new_log = True
                except ValueError:
                    pass

            if is_new_log:
                if current_log:
                    parsed_logs.append(current_log)
                
                # Split parts[2] into location and message by " - "
                msg_parts = parts[2].split(" - ", 1)
                location = msg_parts[0].strip() if len(msg_parts) > 1 else ""
                message = msg_parts[1].strip() if len(msg_parts) > 1 else parts[2].strip()

                current_log = {
                    "timestamp": parts[0].strip(),
                    "level": parts[1].strip(),
                    "location": location,
                    "message": message
                }
            else:
                if current_log:
                    current_log["message"] += "\n" + line_str
                else:
                    parsed_logs.append({
                        "timestamp": "",
                        "level": "INFO",
                        "location": "",
                        "message": line_str
                    })

        if current_log:
            parsed_logs.append(current_log)

        logs = []
        for log in reversed(parsed_logs):
            lvl = log["level"]
            message = log["message"]
            location = log["location"]
            
            if level and lvl != level:
                continue
            if search and search.lower() not in message.lower() and search.lower() not in location.lower():
                continue
                
            logs.append(log)
            if len(logs) >= limit:
                break
    except Exception as e:
        logger.error(f"Failed to read log file: {e}")
        raise HTTPException(status_code=500, detail=f"Could not read system logs: {e}")

    return {"logs": logs}


# ---------------------------------------------------------------------------
# GET /admin/system-logs/download
# ---------------------------------------------------------------------------
@router.get("/system-logs/download")
async def download_system_logs(
    _: User = Depends(require_admin),
):
    import os
    from fastapi.responses import FileResponse

    if not os.path.exists(LOG_FILE_PATH):
        raise HTTPException(status_code=404, detail="Log file not found.")

    return FileResponse(
        LOG_FILE_PATH,
        media_type="text/plain",
        filename=f"system_logs_{date.today().isoformat()}.log"
    )
