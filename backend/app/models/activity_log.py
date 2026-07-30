from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Integer, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base

if TYPE_CHECKING:
    from backend.app.models.user import User


class ActivityLog(Base):
    """
    Immutable audit trail for every admin/user action.
    Rows are NEVER deleted — this is the enterprise audit record.
    """
    __tablename__ = "activity_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)

    # Who performed the action
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    username_snapshot: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    user_role_snapshot: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    # What was done
    action: Mapped[str] = mapped_column(String(128), nullable=False, index=True)

    # Object affected
    object_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    object_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    object_label: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)

    # Change data (stored as JSON)
    old_value: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    new_value: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Request metadata
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    browser: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    os: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    device: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    # Category & Severity
    category: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    severity: Mapped[str] = mapped_column(String(32), default="INFO", nullable=False, index=True)
    execution_time_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    endpoint: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)

    # Outcome
    status: Mapped[str] = mapped_column(String(32), default="success", nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationship
    user: Mapped[Optional["User"]] = relationship("User", back_populates="activity_logs", lazy="noload")

    def __repr__(self) -> str:
        return f"<ActivityLog id={self.id} action={self.action!r} user_id={self.user_id}>"
