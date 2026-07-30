"""
Threat Intelligence — DB Model
================================
Stores results from external threat intelligence providers
(VirusTotal, Google Safe Browsing, URLScan, AbuseIPDB, etc.)
one row per (domain, provider) check.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base

if TYPE_CHECKING:
    from backend.app.models.domain import Domain


class ThreatIntelligence(Base):
    __tablename__ = "threat_intelligence"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    domain_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("domains.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(String(64), nullable=False)     # e.g. "virustotal"
    status: Mapped[str] = mapped_column(String(32), nullable=True)        # e.g. "malicious", "safe", "unknown"
    confidence: Mapped[float] = mapped_column(Float, nullable=True)       # 0.0–1.0
    verdict: Mapped[str] = mapped_column(String(256), nullable=True)      # short human verdict
    raw_response: Mapped[str] = mapped_column(Text, nullable=True)        # full JSON response
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    domain: Mapped["Domain"] = relationship("Domain", back_populates="threat_intel")
