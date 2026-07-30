from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import String, Integer, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base

if TYPE_CHECKING:
    from backend.app.models.snapshot import Snapshot
    from backend.app.models.timeline import DomainTimeline
    from backend.app.models.threat_intel import ThreatIntelligence

class Domain(Base):
    __tablename__ = "domains"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    risk_score: Mapped[int] = mapped_column(Integer, index=True, default=0, nullable=False)
    risk_level: Mapped[str] = mapped_column(String, default="SAFE", nullable=False)
    last_analyzed_at: Mapped[datetime] = mapped_column(DateTime, index=True, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Intelligence fields
    primary_category: Mapped[str] = mapped_column(String(64), nullable=True)   # dominant threat category
    risk_narrative: Mapped[str] = mapped_column(Text, nullable=True)            # AI-generated explanation
    last_threat_intel_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)  # last ext-API check

    # Relationships
    snapshots: Mapped[list["Snapshot"]] = relationship(
        "Snapshot",
        back_populates="domain",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    timeline: Mapped[list["DomainTimeline"]] = relationship(
        "DomainTimeline",
        back_populates="domain",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    threat_intel: Mapped[list["ThreatIntelligence"]] = relationship(
        "ThreatIntelligence",
        back_populates="domain",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
