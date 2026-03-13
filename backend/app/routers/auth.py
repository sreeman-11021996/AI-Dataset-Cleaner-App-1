from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
import uuid
import secrets
import httpx

from app.core.database import get_db
from app.core.security import (
    get_password_hash, verify_password, 
    create_access_token, create_refresh_token, decode_token
)
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token, TokenRefresh
from app.core.security import get_current_user

router = APIRouter()


# Pydantic schemas for new endpoints
class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


class GoogleOAuthRequest(BaseModel):
    id_token: str


class GoogleUserInfo(BaseModel):
    email: EmailStr
    name: str | None = None
    google_id: str
    picture: str | None = None


async def get_google_user_info(id_token: str) -> GoogleUserInfo:
    """Verify Google ID token and get user info"""
    async with httpx.AsyncClient() as client:
        # Google's token info endpoint
        response = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": id_token}
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google ID token"
            )
        
        data = response.json()
        
        return GoogleUserInfo(
            email=data.get("email"),
            name=data.get("name"),
            google_id=data.get("sub"),
            picture=data.get("picture")
        )


@router.post("/register", response_model=UserResponse)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    user = User(
        email=user_data.email,
        name=user_data.name,
        password_hash=get_password_hash(user_data.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if not verify_password(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    return Token(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=Token)
async def refresh_token(token_data: TokenRefresh, db: Session = Depends(get_db)):
    payload = decode_token(token_data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    return Token(access_token=access_token, refresh_token=refresh_token)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/password-reset-request")
async def request_password_reset(
    request: PasswordResetRequest,
    db: Session = Depends(get_db)
):
    """Request a password reset email"""
    user = db.query(User).filter(User.email == request.email).first()
    
    # Always return success to prevent email enumeration
    if user:
        # Generate reset token
        reset_token = secrets.token_urlsafe(32)
        user.reset_token = reset_token
        user.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
        db.commit()
        
        # In production, send email with reset link
        # For now, return the token (development only)
        return {
            "message": "Password reset email sent",
            "reset_token": reset_token  # Remove in production
        }
    
    return {
        "message": "If the email exists, a password reset link has been sent"
    }


@router.post("/password-reset-confirm")
async def confirm_password_reset(
    request: PasswordResetConfirm,
    db: Session = Depends(get_db)
):
    """Reset password using token"""
    user = db.query(User).filter(User.reset_token == request.token).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    if user.reset_token_expires and user.reset_token_expires < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired"
        )
    
    # Update password
    user.password_hash = get_password_hash(request.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()
    
    return {"message": "Password reset successfully"}


@router.post("/oauth/google", response_model=Token)
async def google_oauth(
    oauth_request: GoogleOAuthRequest,
    db: Session = Depends(get_db)
):
    """Authenticate with Google OAuth"""
    try:
        google_user = await get_google_user_info(oauth_request.id_token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google ID token"
        )
    
    # Check if user exists with this Google account
    user = db.query(User).filter(
        User.oauth_provider == "google",
        User.oauth_id == google_user.google_id
    ).first()
    
    if not user:
        # Check if user exists with same email
        user = db.query(User).filter(User.email == google_user.email).first()
        
        if user:
            # Link Google account to existing user
            user.oauth_provider = "google"
            user.oauth_id = google_user.google_id
            if not user.name and google_user.name:
                user.name = google_user.name
            db.commit()
        else:
            # Create new user with Google
            user = User(
                email=google_user.email,
                name=google_user.name,
                oauth_provider="google",
                oauth_id=google_user.google_id,
                password_hash=None  # No password for OAuth users
            )
            db.add(user)
            db.commit()
            db.refresh(user)
    
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    return Token(access_token=access_token, refresh_token=refresh_token)
