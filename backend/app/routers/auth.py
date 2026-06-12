from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from typing import Optional
from jose import JWTError, jwt
from fastapi.security import OAuth2PasswordBearer

from ..database import get_db
from ..models.auth import User, Settings
from ..models.finance import Category
from ..schemas.auth import UserCreate, UserResponse, Token, PINVerify, PINUpdate, SettingsResponse
from ..services.auth_service import (
    verify_password, 
    get_password_hash, 
    create_access_token, 
    verify_pin, 
    get_pin_hash,
    decode_access_token
)

router = APIRouter(prefix="/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login-oauth", auto_error=False)

def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme), 
    authorization: Optional[str] = Header(None), 
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to fetch current authenticated user from JWT token (supports OAuth2 bearer and manual headers).
    """
    # Try custom Authorization header first
    actual_token = None
    if authorization and authorization.startswith("Bearer "):
        actual_token = authorization.split(" ")[1]
    elif token:
        actual_token = token
        
    if not actual_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication missing.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        from jose import jwt
        from jose.exceptions import ExpiredSignatureError, JWTError
        from ..config import settings
        
        payload = jwt.decode(actual_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please login.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    username: str = payload.get("sub")
    user_id = payload.get("id") or payload.get("user_id")
    if username is None or user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token structure.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    return user


@router.post("/signup", response_model=UserResponse)
def signup(user_in: UserCreate, db: Session = Depends(get_db)):
    # Check if username or email already exists
    existing_user = db.query(User).filter(
        (User.username == user_in.username) | (User.email == user_in.email)
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or Email already registered"
        )
        
    # Create new user
    hashed_pwd = get_password_hash(user_in.password)
    user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=hashed_pwd
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Initialize user settings
    settings = Settings(
        user_id=user.id,
        is_pin_enabled=False,
        currency="INR",
        theme="FinancePro"
    )
    db.add(settings)
    
    # Initialize default custom categories for this user
    default_categories = [
        {"name": "Salary", "type": "Income", "icon": "Briefcase"},
        {"name": "Freelance", "type": "Income", "icon": "Laptop"},
        {"name": "Rent & Housing", "type": "Expense", "icon": "Home", "planned_outlay": 30000.0},
        {"name": "Food & Dining", "type": "Expense", "icon": "Utensils", "planned_outlay": 15000.0},
        {"name": "Shopping", "type": "Expense", "icon": "ShoppingBag", "planned_outlay": 12000.0},
        {"name": "Utilities", "type": "Expense", "icon": "Zap", "planned_outlay": 8000.0},
        {"name": "Entertainment", "type": "Expense", "icon": "Film", "planned_outlay": 6000.0},
        {"name": "Travel & Fuel", "type": "Expense", "icon": "Car", "planned_outlay": 8000.0},
        {"name": "Healthcare", "type": "Expense", "icon": "HeartPulse", "planned_outlay": 5000.0},
        {"name": "Other Expense", "type": "Expense", "icon": "HelpCircle", "planned_outlay": 5000.0},
    ]
    for cat in default_categories:
        cat_obj = Category(
            user_id=user.id,
            name=cat["name"],
            type=cat["type"],
            planned_outlay=cat.get("planned_outlay", 0.0),
            is_custom=True
        )
        db.add(cat_obj)
        
    db.commit()
    return user


@router.post("/login", response_model=Token)
def login(login_data: dict, db: Session = Depends(get_db)):
    # Standard JSON body login for easy axios mapping
    username_or_email = login_data.get("username")
    password = login_data.get("password")
    
    if not username_or_email or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username/Email and Password are required"
        )
        
    user = db.query(User).filter(
        (User.username == username_or_email) | (User.email == username_or_email)
    ).first()
    
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password"
        )
        
    token = create_access_token(data={"sub": user.username, "id": user.id, "email": user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": user.username,
        "email": user.email
    }


@router.post("/login-oauth", response_model=Token)
def login_oauth(form_data: dict, db: Session = Depends(get_db)):
    # Fallback endpoint for standard Swagger OAuth2 logins
    username = form_data.get("username")
    password = form_data.get("password")
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect credentials")
    token = create_access_token(data={"sub": user.username, "id": user.id, "email": user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": user.username,
        "email": user.email
    }


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return user


@router.post("/refresh", response_model=Token)
def refresh_token(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication missing.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    token = authorization.split(" ")[1]
    try:
        from jose import jwt
        from jose.exceptions import JWTError
        from ..config import settings
        
        # Decode without verifying expiration so we can read the username of the expired token
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM], 
            options={"verify_exp": False}
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    username: str = payload.get("sub")
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token structure.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    new_token = create_access_token(data={"sub": user.username, "id": user.id, "email": user.email})
    return {
        "access_token": new_token,
        "token_type": "bearer",
        "username": user.username,
        "email": user.email
    }


@router.get("/settings", response_model=SettingsResponse)
def get_user_settings(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user.settings:
        settings = Settings(user_id=user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
        return settings
    return user.settings


@router.post("/verify-pin")
def verify_user_pin(pin_in: PINVerify, user: User = Depends(get_current_user)):
    if not user.settings or not user.settings.pin_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Security PIN lock is not configured on this account."
        )
    if not verify_pin(pin_in.pin, user.settings.pin_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid security PIN."
        )
    return {"status": "success", "message": "PIN verified successfully"}


@router.post("/update-pin")
def update_user_pin(
    pin_in: PINUpdate, 
    user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    if not user.settings:
        settings = Settings(user_id=user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    else:
        settings = user.settings
        
    settings.is_pin_enabled = pin_in.is_pin_enabled
    if pin_in.pin:
        settings.pin_hash = get_pin_hash(pin_in.pin)
    elif not pin_in.is_pin_enabled:
        # If disabling PIN, clear PIN hash
        settings.pin_hash = None
        
    db.commit()
    return {"status": "success", "message": "Security PIN settings updated successfully"}
