from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID


PLAN_LIMITS = {
    "free": {
        "max_file_size_mb": 5,
        "max_datasets": 10,
        "max_daily_operations": 10,
        "advanced_cleaning": False,
        "quality_reports": False,
        "api_access": False,
        "team_workspace": False,
    },
    "pro": {
        "max_file_size_mb": 100,
        "max_datasets": 100,
        "max_daily_operations": 100,
        "advanced_cleaning": True,
        "quality_reports": True,
        "api_access": False,
        "team_workspace": False,
    },
    "team": {
        "max_file_size_mb": 500,
        "max_datasets": -1,
        "max_daily_operations": -1,
        "advanced_cleaning": True,
        "quality_reports": True,
        "api_access": True,
        "team_workspace": True,
    },
}


class UserBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class PlanLimits(BaseModel):
    max_file_size_mb: int
    max_datasets: int
    max_daily_operations: int
    advanced_cleaning: bool
    quality_reports: bool
    api_access: bool
    team_workspace: bool


class UserResponse(UserBase):
    id: UUID
    subscription_tier: str
    storage_used: int
    operations_used: int
    daily_operations_remaining: int
    plan_limits: PlanLimits
    team_id: Optional[UUID] = None
    team_role: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(BaseModel):
    refresh_token: str
