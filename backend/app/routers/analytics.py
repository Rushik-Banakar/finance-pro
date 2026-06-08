from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any

from ..database import get_db
from ..models.auth import User
from ..models.finance import Transaction, Account
from .auth import get_current_user
from ..services.ds_service import get_basic_kpis, get_ml_insights

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/kpis")
def get_kpi_metrics(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    transactions = db.query(Transaction).filter(Transaction.user_id == user.id).all()
    accounts = db.query(Account).filter(Account.user_id == user.id).all()
    return get_basic_kpis(transactions, accounts)


@router.get("/ml")
def get_ml_analytics(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    transactions = db.query(Transaction).filter(Transaction.user_id == user.id).all()
    return get_ml_insights(transactions)
