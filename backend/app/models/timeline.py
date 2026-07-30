"""
DomainTimeline — Year-level historical intelligence record
==========================================================
Stores one row per (domain, year) with the dominant threat category,
average risk score, and a short summary for that year.
Enables the interactive timeline UI without re-fetching snapshots.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base

if TYPE_CHECKING:
    from backend.app.models.domain import Domain


class DomainTimeline(Base):
    __tablename__ = "domain_timeline"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    domain_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("domains.id", ondelete="CASCADE"), nullable=False, index=True
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(64), nullable=True)      # dominant category that year
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)         # avg risk score for the year
    peak_score: Mapped[int] = mapped_column(Integer, default=0)            # highest single snapshot score
    snapshot_count: Mapped[int] = mapped_column(Integer, default=0)        # how many snapshots that year
    summary: Mapped[str] = mapped_column(Text, nullable=True)              # auto-generated year summary
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationship back to Domain (not loaded by default — just for ORM joins)
    domain: Mapped["Domain"] = relationship("Domain", back_populates="timeline")
