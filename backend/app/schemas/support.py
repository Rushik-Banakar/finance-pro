from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# Support Ticket Schemas
class SupportTicketBase(BaseModel):
    subject: str
    description: str
    type: str = "Ticket" # "FAQ", "Ticket", "Bug", "FeatureRequest", "Feedback"

class SupportTicketCreate(SupportTicketBase):
    pass

class SupportTicketResponse(SupportTicketBase):
    id: int
    user_id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

# Notification Schemas
class NotificationBase(BaseModel):
    type: str
    message: str
    is_read: bool = False

class NotificationResponse(NotificationBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Analytics Snapshot Schemas
class AnalyticsSnapshotBase(BaseModel):
    date: datetime
    total_balance: float
    savings_rate: float
    health_score: int
    insights: str = "[]" # JSON string list

class AnalyticsSnapshotResponse(AnalyticsSnapshotBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True

