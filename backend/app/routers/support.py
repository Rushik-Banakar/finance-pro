from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models.auth import User
from ..models.support import SupportTicket, Notification, AnalyticsSnapshot
from ..schemas.support import (
    SupportTicketCreate, SupportTicketResponse, 
    NotificationResponse, AnalyticsSnapshotResponse
)
from .auth import get_current_user

router = APIRouter(prefix="/support", tags=["support"])

@router.get("/tickets", response_model=List[SupportTicketResponse])
def get_tickets(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(SupportTicket).filter(SupportTicket.user_id == user.id).all()


@router.post("/tickets", response_model=SupportTicketResponse)
def create_ticket(
    ticket_in: SupportTicketCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ticket = SupportTicket(
        user_id=user.id,
        subject=ticket_in.subject,
        description=ticket_in.description,
        type=ticket_in.type,
        status="Open"
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.get("/notifications", response_model=List[NotificationResponse])
def get_notifications(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(Notification).filter(
        Notification.user_id == user.id
    ).order_by(Notification.created_at.desc()).all()


@router.put("/notifications/{notif_id}/read")
def mark_notification_read(
    notif_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notif = db.query(Notification).filter(
        Notification.id == notif_id,
        Notification.user_id == user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    notif.is_read = True
    db.commit()
    return {"status": "success", "message": "Notification marked as read"}


@router.get("/snapshots", response_model=List[AnalyticsSnapshotResponse])
def get_snapshots(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(AnalyticsSnapshot).filter(
        AnalyticsSnapshot.user_id == user.id
    ).order_by(AnalyticsSnapshot.date.asc()).all()
