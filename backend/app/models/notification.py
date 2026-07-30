from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Integer, DateTime, Boolean, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base

if TYPE_CHECKING:
    from backend.app.models.user import User


class Notification(Base):
    """In-app notifications delivered to admin users."""
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)

    recipient_user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )

    # Notification type — maps to frontend icon/colour
    # Types: new_user | user_deleted | unsafe_domain | failed_logins |
    #        system_error | wayback_failure | api_error | admin_action
    notification_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(256), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    # Additional structured payload (e.g., domain name, user id, etc.)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationship
    recipient: Mapped[Optional["User"]] = relationship("User", back_populates="notifications", lazy="noload")

    def __repr__(self) -> str:
        return f"<Notification id={self.id} type={self.notification_type!r} read={self.is_read}>"
