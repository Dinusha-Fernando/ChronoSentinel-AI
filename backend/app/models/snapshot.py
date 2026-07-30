from typing import TYPE_CHECKING
from sqlalchemy import String, Integer, ForeignKey, Text, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base

if TYPE_CHECKING:
    from backend.app.models.domain import Domain
    from backend.app.models.analysis import AnalysisFlag

class Snapshot(Base):
    __tablename__ = "snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    domain_id: Mapped[int] = mapped_column(Integer, ForeignKey("domains.id", ondelete="CASCADE"), nullable=False)
    timestamp: Mapped[str] = mapped_column(String(14), nullable=False)
    original_url: Mapped[str] = mapped_column(String, nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, nullable=True)
    redirect_url: Mapped[str | None] = mapped_column(String, nullable=True)
    is_redirect: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    mime_type: Mapped[str] = mapped_column(String, nullable=True)
    risk_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    detected_language: Mapped[str] = mapped_column(String, nullable=True)

    # AI Classification Fields
    content_category: Mapped[str] = mapped_column(String(64), nullable=True)   # e.g. "gambling", "adult", "safe"
    category_confidence: Mapped[float] = mapped_column(Float, nullable=True)   # 0.0 – 1.0
    content_summary: Mapped[str] = mapped_column(Text, nullable=True)          # Short human-readable description
    extraction_metadata: Mapped[str] = mapped_column(Text, nullable=True)      # JSON blob with detector-level detail

    # Advanced Redirect Engine & Dual Risk Telemetry
    redirect_detected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    redirect_method: Mapped[str | None] = mapped_column(String, nullable=True)
    redirect_confidence: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    redirect_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    redirect_same_domain: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    redirect_target: Mapped[str | None] = mapped_column(String, nullable=True)
    redirect_target_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    redirect_target_category: Mapped[str | None] = mapped_column(String, nullable=True)
    redirect_target_risk: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    original_category: Mapped[str | None] = mapped_column(String, nullable=True)
    original_risk: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    redirect_evidence: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    domain: Mapped["Domain"] = relationship("Domain", back_populates="snapshots")
    flags: Mapped[list["AnalysisFlag"]] = relationship(
        "AnalysisFlag",
        back_populates="snapshot",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
