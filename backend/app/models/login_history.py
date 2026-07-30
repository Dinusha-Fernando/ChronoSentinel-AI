from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Integer, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base

if TYPE_CHECKING:
    from backend.app.models.user import User


class LoginHistory(Base):
    """Records every login attempt — both successful and failed."""
    __tablename__ = "login_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)

    # Resolved user (nullable — may not resolve if username is fake)
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Always store the attempted username string (even if user doesn't exist)
    username_attempted: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    user_role_snapshot: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    # Request metadata
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    browser: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    os: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # Outcome
    success: Mapped[bool] = mapped_column(Boolean, nullable=False, index=True)
    failure_reason: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)

    # Timestamps
    login_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    logout_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationship
    user: Mapped[Optional["User"]] = relationship("User", back_populates="login_history", lazy="noload")

    def __repr__(self) -> str:
        result = "success" if self.success else "failed"
        return f"<LoginHistory id={self.id} username={self.username_attempted!r} {result}>"
