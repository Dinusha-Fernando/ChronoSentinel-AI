from typing import TYPE_CHECKING
from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base

if TYPE_CHECKING:
    from backend.app.models.snapshot import Snapshot

class AnalysisFlag(Base):
    __tablename__ = "analysis_flags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    snapshot_id: Mapped[int] = mapped_column(Integer, ForeignKey("snapshots.id", ondelete="CASCADE"), nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False, index=True)
    keyword: Mapped[str] = mapped_column(String, nullable=False)
    weight: Mapped[int] = mapped_column(Integer, nullable=False)
    match_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    
    # Evidence details
    element: Mapped[str] = mapped_column(String, nullable=True)
    matched_text: Mapped[str] = mapped_column(String, nullable=True)
    snippet: Mapped[str] = mapped_column(String, nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=True)

    # Relationships
    snapshot: Mapped["Snapshot"] = relationship("Snapshot", back_populates="flags")
