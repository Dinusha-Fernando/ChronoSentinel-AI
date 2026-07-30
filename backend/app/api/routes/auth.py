"""
Auth routes: login, refresh, logout, change-password, reset-password, /me
"""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.core.security import (
    verify_password, hash_password, create_access_token, create_refresh_token,
    decode_token, validate_password_strength, generate_temp_password,
)
from backend.app.core.dependencies import get_current_user, get_optional_user, get_client_ip, rate_limit_auth
from backend.app.core.redis import redis_manager
from backend.app.core.config import settings
from backend.app.core.audit import log_action
from backend.app.models.user import User, UserStatus
from backend.app.models.login_history import LoginHistory
from backend.app.models.notification import Notification
from backend.app.schemas.auth_schema import (
    LoginRequest, TokenResponse, RefreshRequest, LogoutRequest,
    ChangePasswordRequest, ResetPasswordRequest, CurrentUserResponse,
    ForgotPasswordRequest, UserResetPasswordRequest,
)
from backend.app.utils.logger import logger

router = APIRouter()
_UTC = timezone.utc


def _utcnow() -> datetime:
    return datetime.now(_UTC).replace(tzinfo=None)


def _parse_ua(ua_string: str | None) -> tuple[str, str]:
    if not ua_string:
        return "Unknown", "Unknown"
    try:
        import user_agents  # type: ignore
        ua = user_agents.parse(ua_string)
        return ua.browser.family or "Unknown", ua.os.family or "Unknown"
    except Exception:
        return "Unknown", "Unknown"


# ---------------------------------------------------------------------------
# POST /login
# ---------------------------------------------------------------------------
@router.post("/login", response_model=TokenResponse, dependencies=[Depends(rate_limit_auth)])
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    ip = get_client_ip(request)
    ua_string = request.headers.get("User-Agent")
    browser, os_name = _parse_ua(ua_string)

    # Fetch user by username or email
    result = await db.execute(
        select(User).where(
            (User.username == body.username) | (User.email == body.username),
            User.is_deleted == False,
        )
    )
    user: User | None = result.scalar_one_or_none()

    async def _record_login(success: bool, reason: str | None = None, user_id: int | None = None, role: str | None = None) -> None:
        history = LoginHistory(
            user_id=user_id,
            username_attempted=body.username,
            user_role_snapshot=role,
            ip_address=ip,
            user_agent=ua_string,
            browser=browser,
            os=os_name,
            success=success,
            failure_reason=reason,
            login_at=_utcnow(),
        )
        db.add(history)
        await db.flush()

    # User not found
    if user is None:
        await _record_login(False, "User not found")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")

    # Account suspended
    if user.status == UserStatus.suspended:
        await _record_login(False, "Account suspended", user.id, user.role)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account suspended.")

    # Account locked
    if user.locked_until and user.locked_until > _utcnow():
        await _record_login(False, "Account locked", user.id, user.role)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account locked. Try again after {user.locked_until.strftime('%H:%M:%S')} UTC.",
        )

    # Wrong password
    if not verify_password(body.password, user.hashed_password):
        user.failed_login_count += 1
        if user.failed_login_count >= settings.MAX_LOGIN_ATTEMPTS:
            user.locked_until = _utcnow() + timedelta(minutes=settings.ACCOUNT_LOCK_MINUTES)
            logger.warning(f"[Auth] Account locked for user {user.username} after {user.failed_login_count} failed attempts.")
        await _record_login(False, "Wrong password", user.id, user.role)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")

    # Successful login — reset counters
    user.failed_login_count = 0
    user.locked_until = None
    user.last_login_at = _utcnow()

    jti = str(uuid.uuid4())
    token_data = {"sub": str(user.id), "role": user.role, "jti": jti}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    await _record_login(True, None, user.id, user.role)

    await log_action(
        db,
        user_id=user.id,
        username=user.username,
        user_role=user.role,
        action="LOGIN",
        ip_address=ip,
        user_agent_string=ua_string,
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ---------------------------------------------------------------------------
# POST /refresh
# ---------------------------------------------------------------------------
@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type.")
        user_id = payload.get("sub")
        old_jti = payload.get("jti")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token.")

    # Check blacklist
    if old_jti:
        blacklisted = await redis_manager.get(f"blacklist:token:{old_jti}")
        if blacklisted:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked.")

    result = await db.execute(select(User).where(User.id == int(user_id), User.is_deleted == False))
    user: User | None = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")

    # Rotate: blacklist old JTI
    if old_jti:
        await redis_manager.set(
            f"blacklist:token:{old_jti}", "1",
            expire_seconds=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        )

    new_jti = str(uuid.uuid4())
    token_data = {"sub": str(user.id), "role": user.role, "jti": new_jti}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ---------------------------------------------------------------------------
# POST /logout
# ---------------------------------------------------------------------------
@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    body: LogoutRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    try:
        if body and body.refresh_token:
            payload = decode_token(body.refresh_token)
            jti = payload.get("jti")
            if jti:
                await redis_manager.set(
                    f"blacklist:token:{jti}", "1",
                    expire_seconds=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
                )
    except Exception:
        pass  # Already expired or invalid — treat as logged out

    if current_user:
        # Update logout time on latest login history entry
        await db.execute(
            select(LoginHistory)
            .where(
                LoginHistory.user_id == current_user.id,
                LoginHistory.success == True,
                LoginHistory.logout_at == None,
            )
            .order_by(LoginHistory.login_at.desc())
            .limit(1)
        )

        await log_action(
            db,
            user_id=current_user.id,
            username=current_user.username,
            user_role=current_user.role,
            action="LOGOUT",
            ip_address=get_client_ip(request),
            user_agent_string=request.headers.get("User-Agent"),
        )


# ---------------------------------------------------------------------------
# POST /change-password
# ---------------------------------------------------------------------------
@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    request: Request,
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")

    errors = validate_password_strength(body.new_password)
    if errors:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=" ".join(errors))

    current_user.hashed_password = hash_password(body.new_password)
    current_user.must_change_password = False
    current_user.password_changed_at = _utcnow()

    await log_action(
        db,
        user_id=current_user.id,
        username=current_user.username,
        user_role=current_user.role,
        action="CHANGE_PASSWORD",
        object_type="User",
        object_id=current_user.id,
        object_label=current_user.username,
        old_value={"password": "hidden"},
        new_value={"password": "hidden"},
        ip_address=get_client_ip(request),
        user_agent_string=request.headers.get("User-Agent"),
    )


# ---------------------------------------------------------------------------
# GET /me
# ---------------------------------------------------------------------------
@router.get("/me", response_model=CurrentUserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return CurrentUserResponse(
        id=current_user.id,
        full_name=current_user.full_name,
        username=current_user.username,
        email=current_user.email,
        role=current_user.role,
        status=current_user.status,
        department=current_user.department,
        last_login_at=current_user.last_login_at.isoformat() if current_user.last_login_at else None,
        must_change_password=current_user.must_change_password,
    )


# ---------------------------------------------------------------------------
# POST /forgot-password
# ---------------------------------------------------------------------------
@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(User).where(
            (User.username == body.username_or_email) | (User.email == body.username_or_email),
            User.is_deleted == False
        )
    )
    user: User | None = result.scalar_one_or_none()
    
    if not user:
        return {"message": "If an account matches that username or email, password reset instructions have been generated."}

    import secrets
    token = secrets.token_urlsafe(32)
    
    await redis_manager.set(f"password_reset:token:{token}", str(user.id), expire_seconds=900)
    
    await log_action(
        db,
        user_id=user.id,
        username=user.username,
        user_role=user.role,
        action="FORGOT_PASSWORD_REQUEST",
        ip_address=get_client_ip(request),
        user_agent_string=request.headers.get("User-Agent"),
    )

    # Deliver alert notification to admin dashboard
    notification = Notification(
        recipient_user_id=None,
        notification_type="admin_action",
        title="Password Reset Request",
        message=f"User {user.username} requested a password reset. Reset Token: {token}",
        metadata_json={"username": user.username, "token": token}
    )
    db.add(notification)
    await db.flush()

    return {
        "message": "Password reset token generated successfully. Use your reset token below to set a new password.",
        "reset_token": token
    }


# ---------------------------------------------------------------------------
# POST /reset-password
# ---------------------------------------------------------------------------
@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(
    request: Request,
    body: UserResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    user_id_str = await redis_manager.get(f"password_reset:token:{body.token}")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token. Please request a new password reset."
        )
        
    user_id = int(user_id_str)
    result = await db.execute(select(User).where(User.id == user_id, User.is_deleted == False))
    user: User | None = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account not found or has been disabled."
        )

    errors = validate_password_strength(body.new_password)
    if errors:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=" ".join(errors))

    user.hashed_password = hash_password(body.new_password)
    user.must_change_password = False
    user.password_changed_at = _utcnow()
    user.failed_login_count = 0
    user.locked_until = None

    await redis_manager.delete(f"password_reset:token:{body.token}")

    await log_action(
        db,
        user_id=user.id,
        username=user.username,
        user_role=user.role,
        action="RESET_PASSWORD_SUCCESS",
        object_type="User",
        object_id=user.id,
        object_label=user.username,
        ip_address=get_client_ip(request),
        user_agent_string=request.headers.get("User-Agent"),
    )

    return {
        "message": "Password has been successfully reset. You can now log in with your new password."
    }
