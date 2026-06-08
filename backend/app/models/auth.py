from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    accounts = relationship("Account", back_populates="user", cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    transfers = relationship("Transfer", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    settings = relationship("Settings", uselist=False, back_populates="user", cascade="all, delete-orphan")
    tickets = relationship("SupportTicket", back_populates="user", cascade="all, delete-orphan")
    snapshots = relationship("AnalyticsSnapshot", back_populates="user", cascade="all, delete-orphan")


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    pin_hash = Column(String, nullable=True)
    is_pin_enabled = Column(Boolean, default=False)
    auto_lock_duration = Column(Integer, default=300)  # in seconds, e.g. 5 minutes
    session_timeout = Column(Integer, default=3600)   # in seconds, e.g. 1 hour
    currency = Column(String, default="INR")
    language = Column(String, default="English")
    date_format = Column(String, default="DD-MM-YYYY")
    notification_pref = Column(String, default="Email")
    theme = Column(String, default="FinancePro")
    theme_customization = Column(String, default="{}") # JSON string for layout settings
    hide_balance = Column(Boolean, default=False)
    lock_analytics = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="settings")
