from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Integer, DateTime, Float, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base
import enum

if TYPE_CHECKING:
    from backend.app.models.domain import Domain
    from backend.app.models.user import User


class ScanSource(str, enum.Enum):
    manual = "manual"
    batch = "batch"
    api = "api"
    anonymous = "anonymous"


class ScanRecord(Base):
    """Every domain scan, tied to the user who initiated it."""
    __tablename__ = "scan_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)

    # Domain reference (nullable in case domain record is removed)
    domain_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("domains.id", ondelete="SET NULL"), nullable=True, index=True
    )
    domain_name: Mapped[str] = mapped_column(String(256), nullable=False, index=True)

    # User reference (nullable for anonymous scans)
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Scan metadata
    status: Mapped[str] = mapped_column(String(32), default="completed", nullable=False, index=True)
    risk_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    risk_level: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    source: Mapped[str] = mapped_column(
        SAEnum(ScanSource, name="scan_source", create_type=True),
        default=ScanSource.manual,
        nullable=False
    )

    wayback_status: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    checked_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    domain: Mapped[Optional["Domain"]] = relationship("Domain", lazy="noload")
    user: Mapped[Optional["User"]] = relationship("User", back_populates="scan_records", lazy="noload")

    def __repr__(self) -> str:
        return f"<ScanRecord id={self.id} domain={self.domain_name!r} user_id={self.user_id}>"
