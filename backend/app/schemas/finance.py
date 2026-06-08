from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# Category Schemas
class CategoryBase(BaseModel):
    name: str
    type: str = Field(..., description="Expense or Income")
    planned_outlay: float = 0.0
    is_custom: bool = False

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    id: int
    user_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Account Schemas
class AccountBase(BaseModel):
    name: str
    bank_name: str
    type: str = Field(..., description="Savings, Current, CreditCard, Cash, Wallet")
    balance: float = 0.0
    currency: str = "INR"

class AccountCreate(AccountBase):
    pass

class AccountResponse(AccountBase):
    id: int
    user_id: int
    is_archived: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Transaction Schemas
class TransactionBase(BaseModel):
    account_id: int
    category_id: int
    type: str = Field(..., description="Expense or Income")
    amount: float
    description: Optional[str] = None
    date: datetime = Field(default_factory=datetime.utcnow)

class TransactionCreate(TransactionBase):
    pass

class TransactionResponse(TransactionBase):
    id: int
    user_id: int
    created_at: datetime
    category: Optional[CategoryResponse] = None
    account: Optional[AccountResponse] = None

    class Config:
        from_attributes = True

# Transfer Schemas (Self-transfers between accounts)
class TransferBase(BaseModel):
    source_account_id: int
    destination_account_id: int
    amount: float
    description: Optional[str] = None
    date: datetime = Field(default_factory=datetime.utcnow)

class TransferCreate(TransferBase):
    pass

class TransferResponse(TransferBase):
    id: int
    user_id: int
    created_at: datetime
    source_account: Optional[AccountResponse] = None
    destination_account: Optional[AccountResponse] = None

    class Config:
        from_attributes = True

