from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Any
from datetime import datetime

class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    username: str
    email: str

class TokenData(BaseModel):
    username: Optional[str] = None

class PINVerify(BaseModel):
    pin: str = Field(..., min_length=4, max_length=6, pattern="^[0-9]+$")

class PINUpdate(BaseModel):
    pin: Optional[str] = Field(None, min_length=4, max_length=6, pattern="^[0-9]+$")
    is_pin_enabled: bool

class SettingsBase(BaseModel):
    is_pin_enabled: bool = False
    auto_lock_duration: int = 300
    session_timeout: int = 3600
    currency: str = "INR"
    language: str = "English"
    date_format: str = "DD-MM-YYYY"
    notification_pref: str = "Email"
    theme: str = "FinancePro"
    theme_customization: str = "{}"
    hide_balance: bool = False
    lock_analytics: bool = False

class SettingsUpdate(BaseModel):
    is_pin_enabled: Optional[bool] = None
    auto_lock_duration: Optional[int] = None
    session_timeout: Optional[int] = None
    currency: Optional[str] = None
    language: Optional[str] = None
    date_format: Optional[str] = None
    notification_pref: Optional[str] = None
    theme: Optional[str] = None
    theme_customization: Optional[str] = None
    hide_balance: Optional[bool] = None
    lock_analytics: Optional[bool] = None

class SettingsResponse(SettingsBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True
