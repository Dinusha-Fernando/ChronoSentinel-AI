from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import String, Integer, DateTime, Boolean, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base

import enum


if TYPE_CHECKING:
    from backend.app.models.activity_log import ActivityLog
    from backend.app.models.login_history import LoginHistory
    from backend.app.models.scan_record import ScanRecord
    from backend.app.models.notification import Notification


class UserRole(str, enum.Enum):
    super_admin = "super_admin"
    admin = "admin"
    user = "user"


class UserStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    pending = "pending"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True
    )

    full_name: Mapped[str] = mapped_column(
        String(128),
        nullable=False
    )

    username: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True,
        nullable=False
    )

    email: Mapped[str] = mapped_column(
        String(256),
        unique=True,
        index=True,
        nullable=False
    )

    hashed_password: Mapped[str] = mapped_column(
        String(256),
        nullable=False
    )


    # Role & Status
    role: Mapped[str] = mapped_column(
        SAEnum(
            UserRole,
            name="user_role",
            create_type=False
        ),
        default=UserRole.user,
        nullable=False,
        index=True
    )

    status: Mapped[str] = mapped_column(
        SAEnum(
            UserStatus,
            name="user_status",
            create_type=False
        ),
        default=UserStatus.active,
        nullable=False,
        index=True
    )


    # Optional Profile
    department: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True
    )


    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    last_login_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True
    )

    last_active_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True
    )


    # Security: Account lockout
    failed_login_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )

    locked_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True
    )


    # Password management
    must_change_password: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )

    password_changed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True
    )


    # Soft-delete flag (keeps audit trail intact)
    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )

    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True
    )


    # Relationships
    activity_logs: Mapped[list["ActivityLog"]] = relationship(
        "ActivityLog",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="noload"
    )

    login_history: Mapped[list["LoginHistory"]] = relationship(
        "LoginHistory",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="noload"
    )

    scan_records: Mapped[list["ScanRecord"]] = relationship(
        "ScanRecord",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="noload"
    )

    notifications: Mapped[list["Notification"]] = relationship(
        "Notification",
        back_populates="recipient",
        cascade="all, delete-orphan",
        lazy="noload"
    )


    def __repr__(self) -> str:
        return (
            f"<User id={self.id} "
            f"username={self.username!r} "
            f"role={self.role}>"
        )