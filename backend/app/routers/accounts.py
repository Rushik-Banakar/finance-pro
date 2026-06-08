from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models.auth import User
from ..models.finance import Account
from ..schemas.finance import AccountCreate, AccountResponse
from .auth import get_current_user

router = APIRouter(prefix="/accounts", tags=["accounts"])

@router.get("", response_model=List[AccountResponse])
def get_accounts(
    include_archived: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Account).filter(Account.user_id == user.id)
    if not include_archived:
        query = query.filter(Account.is_archived == False)
    return query.all()


@router.post("", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
def create_account(
    account_in: AccountCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    account = Account(
        user_id=user.id,
        name=account_in.name,
        bank_name=account_in.bank_name,
        type=account_in.type,
        balance=account_in.balance,
        currency=account_in.currency
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.get("/{account_id}", response_model=AccountResponse)
def get_account_detail(
    account_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    account = db.query(Account).filter(
        Account.id == account_id, 
        Account.user_id == user.id
    ).first()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    return account


@router.put("/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: int,
    account_in: dict,  # Flexible update payload
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    account = db.query(Account).filter(
        Account.id == account_id, 
        Account.user_id == user.id
    ).first()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
        
    # Validate inputs if present
    if "name" in account_in:
        name_val = str(account_in["name"]).strip()
        if not name_val:
            raise HTTPException(status_code=400, detail="Account name cannot be empty")
        account_in["name"] = name_val

    if "bank_name" in account_in:
        bank_val = str(account_in["bank_name"]).strip()
        if not bank_val:
            raise HTTPException(status_code=400, detail="Bank name cannot be empty")
        account_in["bank_name"] = bank_val

    if "type" in account_in:
        type_val = account_in["type"]
        if type_val not in ["Savings", "Current", "CreditCard", "Cash", "Wallet"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid account type. Must be Savings, Current, CreditCard, Cash, or Wallet"
            )

    # Protect immutable fields and balance
    for key, value in account_in.items():
        if hasattr(account, key) and key not in ["id", "user_id", "balance", "created_at"]:
            setattr(account, key, value)
            
    db.commit()
    db.refresh(account)
    return account


@router.delete("/{account_id}")
def delete_account(
    account_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    account = db.query(Account).filter(
        Account.id == account_id, 
        Account.user_id == user.id
    ).first()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
        
    # Standard practice: archive accounts instead of hard delete to preserve historical transactions
    account.is_archived = True
    db.commit()
    return {"status": "success", "message": "Account archived successfully"}
