from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.auth import User
from ..schemas.auth import SettingsUpdate, SettingsResponse
from .auth import get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])

@router.put("", response_model=SettingsResponse)
def update_settings(
    settings_in: SettingsUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    settings = user.settings
    if not settings:
        raise HTTPException(status_code=404, detail="Settings profile not found")
        
    for key, value in settings_in.model_dump(exclude_unset=True).items():
        setattr(settings, key, value)
        
    db.commit()
    db.refresh(settings)
    return settings
