from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from ..models.auth import User
from ..models.finance import Category, Transaction, Account
from ..schemas.finance import CategoryCreate, CategoryResponse
from .auth import get_current_user

router = APIRouter(prefix="/categories", tags=["categories"])

@router.get("", response_model=List[CategoryResponse])
def get_categories(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch system default categories (user_id is None) and user's custom categories
    return db.query(Category).filter(
        (Category.user_id == user.id) | (Category.user_id == None)
    ).all()


@router.post("", response_model=CategoryResponse)
def create_category(
    category_in: CategoryCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    category = Category(
        user_id=user.id,
        name=category_in.name,
        type=category_in.type,
        planned_outlay=category_in.planned_outlay,
        is_custom=True
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    category_in: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    category = db.query(Category).filter(
        Category.id == category_id,
        (Category.user_id == user.id) | (Category.user_id == None)
    ).first()
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
        
    # Print DELETE BUDGET if planned_outlay is 0 in category_in
    if "planned_outlay" in category_in and category_in["planned_outlay"] == 0:
        print("DELETE BUDGET:", category_id, flush=True)

    # Relax restrictions on system categories to allow updating name and planned_outlay!
    if category.user_id is None:
        allowed_keys = ["planned_outlay", "name"]
        for key, value in category_in.items():
            if key in allowed_keys and hasattr(category, key):
                setattr(category, key, value)
            elif key not in allowed_keys:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot modify core system default category attribute '{key}'."
                )
    else:
        # Custom category. Allow all updates
        for key, value in category_in.items():
            if hasattr(category, key) and key not in ["id", "user_id"]:
                setattr(category, key, value)
                
    db.commit()
    db.refresh(category)
    return category


@router.post("/{category_id}/split")
def split_category(
    category_id: int,
    split_in: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    category = db.query(Category).filter(
        Category.id == category_id,
        (Category.user_id == user.id) | (Category.user_id == None)
    ).first()
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
        
    name_a = split_in.get("name_a")
    planned_outlay_a = split_in.get("planned_outlay_a", 0.0)
    
    name_b = split_in.get("name_b")
    planned_outlay_b = split_in.get("planned_outlay_b", 0.0)
    
    migration_option = split_in.get("migration_option", "move_all_a")
    manual_moves = split_in.get("manual_moves", {})
    
    # Rename category X to A
    category.name = name_a
    category.planned_outlay = planned_outlay_a
    
    # Create category B (custom category for this user)
    category_b = Category(
        user_id=user.id,
        name=name_b,
        type=category.type,
        planned_outlay=planned_outlay_b,
        is_custom=True
    )
    db.add(category_b)
    db.flush() # Populate category_b.id
    
    # Migrate user transactions
    transactions = db.query(Transaction).filter(
        Transaction.category_id == category_id,
        Transaction.user_id == user.id
    ).all()
    
    if transactions:
        if migration_option == "move_all_b":
            for tx in transactions:
                tx.category_id = category_b.id
                tx.category = category_b
        elif migration_option == "manual" and manual_moves:
            for tx in transactions:
                target = manual_moves.get(str(tx.id)) or manual_moves.get(tx.id)
                if target == "b":
                    tx.category_id = category_b.id
                    tx.category = category_b
                    
    db.commit()
    return {
        "status": "success",
        "message": "Category split completed successfully",
        "category_a_id": category.id,
        "category_b_id": category_b.id
    }


@router.get("/{category_id}/dependencies")
def get_category_dependencies(
    category_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    category = db.query(Category).filter(
        Category.id == category_id,
        (Category.user_id == user.id) | (Category.user_id == None)
    ).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
        
    transactions_count = db.query(Transaction).filter(
        Transaction.category_id == category_id,
        Transaction.user_id == user.id
    ).count()
    
    budgets_count = 1 if category.planned_outlay > 0 else 0
    analytics_count = transactions_count
    
    return {
        "category_name": category.name,
        "transactions_count": transactions_count,
        "budgets_count": budgets_count,
        "analytics_count": analytics_count
    }


@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    delete_transactions: bool = False,
    new_category_id: Optional[int] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    print("DELETE CATEGORY:", category_id, flush=True)
    category = db.query(Category).filter(
        Category.id == category_id,
        (Category.user_id == user.id) | (Category.user_id == None)
    ).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found."
        )
        
    # Fetch all transactions referencing this category across all users to prevent constraint failures
    transactions = db.query(Transaction).filter(
        Transaction.category_id == category_id
    ).all()
    
    if transactions:
        if not delete_transactions and not new_category_id:
            user_tx_count = db.query(Transaction).filter(
                Transaction.category_id == category_id,
                Transaction.user_id == user.id
            ).count()
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error_code": "CATEGORY_HAS_TRANSACTIONS",
                    "message": "This category contains transactions.",
                    "transaction_count": user_tx_count
                }
            )
            
        if delete_transactions:
            # Option B: Delete category and related transactions
            for tx in transactions:
                account = db.query(Account).filter(Account.id == tx.account_id).first()
                if account:
                    if tx.type == "Expense":
                        account.balance += tx.amount
                    elif tx.type == "Income":
                        account.balance -= tx.amount
                db.delete(tx)
                
        elif new_category_id:
            if new_category_id == category_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot move transactions to the category being deleted."
                )
            # Option A: Move transactions
            new_cat = db.query(Category).filter(Category.id == new_category_id).first()
            if not new_cat:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Destination category not found."
                )
                
            # Re-associate referencing records
            for tx in transactions:
                if new_cat.user_id is None or new_cat.user_id == tx.user_id:
                    tx.category_id = new_category_id
                    tx.category = new_cat
                else:
                    # Re-associate other users' transactions to a fallback system default of the same type
                    fallback_cat = db.query(Category).filter(
                        Category.type == category.type,
                        Category.user_id == None,
                        Category.id != category_id
                    ).first()
                    if fallback_cat:
                        tx.category_id = fallback_cat.id
                        tx.category = fallback_cat
                    else:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Cannot move other users' transactions due to lack of a fallback category."
                        )
                        
    # Safely delete the category
    category.transactions = []
    db.delete(category)
    db.commit()
    return {"status": "success", "message": "Category deleted successfully"}
