from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from ..database import get_db
from ..models.auth import User
from ..models.finance import Transaction, Account, Category, Transfer
from ..schemas.finance import (
    TransactionCreate, TransactionResponse, 
    TransferCreate, TransferResponse
)
from .auth import get_current_user

router = APIRouter(prefix="/transactions", tags=["transactions"])

@router.get("", response_model=List[TransactionResponse])
def get_transactions(
    account_ids: Optional[List[int]] = Query(None),
    category_id: Optional[int] = Query(None),
    type: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Transaction).filter(Transaction.user_id == user.id)
    
    if account_ids:
        query = query.filter(Transaction.account_id.in_(account_ids))
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if type:
        query = query.filter(Transaction.type == type)
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    if search:
        # Search description or category name
        query = query.join(Category).filter(
            (Transaction.description.ilike(f"%{search}%")) | 
            (Category.name.ilike(f"%{search}%"))
        )
        
    # Sort chronologically by default (newest first)
    query = query.order_by(Transaction.date.desc())
    return query.limit(limit).all()


@router.post("", response_model=TransactionResponse)
def create_transaction(
    tx_in: TransactionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify account
    account = db.query(Account).filter(
        Account.id == tx_in.account_id, 
        Account.user_id == user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
        
    # Verify category (can be system category user_id = None, or custom category)
    category = db.query(Category).filter(
        Category.id == tx_in.category_id,
        (Category.user_id == user.id) | (Category.user_id == None)
    ).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
        
    # Create transaction
    transaction = Transaction(
        user_id=user.id,
        account_id=tx_in.account_id,
        category_id=tx_in.category_id,
        type=tx_in.type,
        amount=tx_in.amount,
        description=tx_in.description,
        date=tx_in.date
    )
    db.add(transaction)
    
    # Adjust account balance atomically
    if tx_in.type == "Expense":
        account.balance -= tx_in.amount
    elif tx_in.type == "Income":
        account.balance += tx_in.amount
        
    db.commit()
    db.refresh(transaction)
    return transaction


@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: int,
    tx_in: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id, 
        Transaction.user_id == user.id
    ).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Validate inputs if provided
    if "account_id" in tx_in:
        account = db.query(Account).filter(
            Account.id == tx_in["account_id"], 
            Account.user_id == user.id
        ).first()
        if not account:
            raise HTTPException(status_code=400, detail="New account not found or access denied")

    if "category_id" in tx_in:
        category = db.query(Category).filter(
            Category.id == tx_in["category_id"],
            (Category.user_id == user.id) | (Category.user_id == None)
        ).first()
        if not category:
            raise HTTPException(status_code=400, detail="New category not found or access denied")

    if "type" in tx_in:
        if tx_in["type"] not in ["Expense", "Income"]:
            raise HTTPException(status_code=400, detail="Type must be either Expense or Income")

    if "amount" in tx_in:
        try:
            amount_val = float(tx_in["amount"])
            if amount_val < 0:
                raise ValueError()
            tx_in["amount"] = amount_val
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Amount must be a positive number")

    old_account_id = transaction.account_id
    old_type = transaction.type
    old_amount = transaction.amount

    # Apply changes
    for key, value in tx_in.items():
        if hasattr(transaction, key) and key not in ["id", "user_id"]:
            # Parse dates if sent as strings
            if key == "date" and isinstance(value, str):
                value = datetime.fromisoformat(value.replace("Z", "+00:00"))
            setattr(transaction, key, value)
            
    db.commit()
    db.refresh(transaction)
    
    # Balance Reconciliation Logic
    # 1. Reverse the old impact on old account
    old_account = db.query(Account).filter(Account.id == old_account_id).first()
    if old_account:
        if old_type == "Expense":
            old_account.balance += old_amount
        elif old_type == "Income":
            old_account.balance -= old_amount
            
    # 2. Apply the new impact on new account
    new_account = db.query(Account).filter(Account.id == transaction.account_id).first()
    if new_account:
        if transaction.type == "Expense":
            new_account.balance -= transaction.amount
        elif transaction.type == "Income":
            new_account.balance += transaction.amount
            
    db.commit()
    db.refresh(transaction)
    return transaction


@router.delete("/{transaction_id}")
def delete_transaction(
    transaction_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id, 
        Transaction.user_id == user.id
    ).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    # Reverse impact on account balance
    account = db.query(Account).filter(Account.id == transaction.account_id).first()
    if account:
        if transaction.type == "Expense":
            account.balance += transaction.amount
        elif transaction.type == "Income":
            account.balance -= transaction.amount
            
    db.delete(transaction)
    db.commit()
    return {"status": "success", "message": "Transaction deleted successfully"}


@router.post("/bulk-delete")
def bulk_delete_transactions(
    payload: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ids = payload.get("ids", [])
    delete_all = payload.get("all", False)
    
    query = db.query(Transaction).filter(Transaction.user_id == user.id)
    if not delete_all:
        if not ids:
            raise HTTPException(status_code=400, detail="No transaction IDs provided for deletion.")
        query = query.filter(Transaction.id.in_(ids))
        
    transactions = query.all()
    if not transactions:
        return {"status": "success", "message": "No matching transactions found."}
        
    # Reconcile account balances atomically for all deleted transactions
    for tx in transactions:
        account = db.query(Account).filter(Account.id == tx.account_id).first()
        if account:
            if tx.type == "Expense":
                account.balance += tx.amount
            elif tx.type == "Income":
                account.balance -= tx.amount
        db.delete(tx)
        
    db.commit()
    return {"status": "success", "message": f"Successfully deleted {len(transactions)} transactions."}


# --- Transfers (Self Transfers) Section ---

@router.post("/transfers", response_model=TransferResponse)
def create_transfer(
    tr_in: TransferCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if tr_in.source_account_id == tr_in.destination_account_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source and destination accounts must be different."
        )
        
    # Verify source account
    src_account = db.query(Account).filter(
        Account.id == tr_in.source_account_id, 
        Account.user_id == user.id
    ).first()
    
    # Verify destination account
    dest_account = db.query(Account).filter(
        Account.id == tr_in.destination_account_id, 
        Account.user_id == user.id
    ).first()
    
    if not src_account or not dest_account:
        raise HTTPException(status_code=404, detail="Source or Destination Account not found")
        
    # Create transfer log
    transfer = Transfer(
        user_id=user.id,
        source_account_id=tr_in.source_account_id,
        destination_account_id=tr_in.destination_account_id,
        amount=tr_in.amount,
        description=tr_in.description,
        date=tr_in.date
    )
    db.add(transfer)
    
    # Update balances atomically (debit source, credit destination)
    src_account.balance -= tr_in.amount
    dest_account.balance += tr_in.amount
    
    db.commit()
    db.refresh(transfer)
    return transfer


@router.get("/transfers", response_model=List[TransferResponse])
def get_transfers(
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(Transfer).filter(
        Transfer.user_id == user.id
    ).order_by(Transfer.date.desc()).limit(limit).all()
