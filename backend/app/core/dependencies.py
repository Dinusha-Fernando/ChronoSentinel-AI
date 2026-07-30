"""
FastAPI dependency injection for authentication and role-based access control (RBAC).
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.core.security import decode_token
from backend.app.core.redis import redis_manager
from backend.app.models.user import User, UserRole, UserStatus
from backend.app.utils.logger import logger

_bearer = HTTPBearer(auto_error=False)
_UTC = timezone.utc


# ---------------------------------------------------------------------------
# Helper: extract client IP
# ---------------------------------------------------------------------------
def get_client_ip(request: Request) -> str:
    """Extract real client IP, respecting X-Forwarded-For if behind a proxy."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ---------------------------------------------------------------------------
# Token extraction
# ---------------------------------------------------------------------------
async def _get_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> str:
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials


# ---------------------------------------------------------------------------
# Rate limiting (auth endpoints: 5 req/min per IP)
# ---------------------------------------------------------------------------
async def rate_limit_auth(request: Request) -> None:
    """
    Sliding-window rate limit for auth endpoints.
    Allows 5 requests per minute per IP. Uses Redis if available.
    """
    ip = get_client_ip(request)
    key = f"rate_limit:auth:{ip}"
    try:
        count = await redis_manager.get(key)
        if count is None:
            await redis_manager.set(key, "1", expire_seconds=60)
        else:
            if int(count) >= 5:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many authentication attempts. Please wait 60 seconds.",
                )
            await redis_manager.set(key, str(int(count) + 1), expire_seconds=60)
    except HTTPException:
        raise
    except Exception:
        # Redis unavailable — fail open (allow request)
        pass


# ---------------------------------------------------------------------------
# Core user resolution
# ---------------------------------------------------------------------------
async def get_current_user(
    token: str = Depends(_get_token),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Validates the Bearer JWT and returns the authenticated User.
    Raises 401 for invalid/expired tokens.
    Raises 403 for suspended/deleted accounts.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        token_type: str = payload.get("type", "")
        if token_type != "access":
            raise credentials_exception

        user_id: Optional[int] = payload.get("sub")
        if user_id is None:
            raise credentials_exception

        # Check if token has been blacklisted (logged-out refresh tokens cascade)
        jti: Optional[str] = payload.get("jti")
        if jti:
            blacklisted = await redis_manager.get(f"blacklist:token:{jti}")
            if blacklisted:
                raise credentials_exception

    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == int(user_id), User.is_deleted == False))
    user: Optional[User] = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    if user.status == UserStatus.suspended:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended. Contact an administrator.",
        )

    # Check account lock
    if user.locked_until and user.locked_until > datetime.now(_UTC).replace(tzinfo=None):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is temporarily locked. Try again after {user.locked_until.strftime('%H:%M:%S')}.",
        )

    # Track active presence
    user.last_active_at = datetime.utcnow()
    await db.flush()

    return user


# ---------------------------------------------------------------------------
# Optional auth (for endpoints that work both authenticated and anonymous)
# ---------------------------------------------------------------------------
async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Returns the authenticated user if a valid token is provided, else None."""
    if not credentials or not credentials.credentials:
        return None
    try:
        return await get_current_user(token=credentials.credentials, db=db)
    except HTTPException:
        return None


# ---------------------------------------------------------------------------
# Role-based access control
# ---------------------------------------------------------------------------
async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Allow access only for Admin and Super Admin roles."""
    role_val = str(getattr(current_user.role, "value", current_user.role)).lower()
    if role_val not in ("admin", "super_admin", "superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required.",
        )
    return current_user


async def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    """Allow access only for Super Admin role."""
    role_val = str(getattr(current_user.role, "value", current_user.role)).lower()
    if role_val not in ("super_admin", "superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin privileges required.",
        )
    return current_user
