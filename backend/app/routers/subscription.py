import os
import uuid
import hmac
import hashlib
import time
import razorpay
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, SubscriptionTier, PLAN_LIMITS
from app.schemas.user import CreateSubscriptionRequest, CreateSubscriptionResponse, SubscriptionResponse

router = APIRouter()

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")

PLAN_PRICES = {
    "pro": {
        "name": "Pro Plan",
        "amount": 99900,  # ₹999 in paise
        "plan_id": "plan_pro_monthly",
    },
    "team": {
        "name": "Team Plan", 
        "amount": 399900,  # ₹3999 in paise
        "plan_id": "plan_team_monthly",
    },
}


def get_razorpay_client():
    """Get Razorpay client instance"""
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment gateway not configured"
        )
    return razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


@router.post("/create-subscription", response_model=CreateSubscriptionResponse)
async def create_subscription(
    request: CreateSubscriptionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new Razorpay subscription"""
    if request.plan_id not in PLAN_PRICES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid plan ID"
        )
    
    if current_user.subscription_tier != SubscriptionTier.free:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have an active subscription"
        )
    
    plan = PLAN_PRICES[request.plan_id]
    
    try:
        client = get_razorpay_client()
        
        # Create or get customer
        if not current_user.razorpay_customer_id:
            customer = client.customer.create({
                "name": current_user.name or current_user.email.split("@")[0],
                "email": current_user.email,
                "description": f"User ID: {current_user.id}"
            })
            current_user.razorpay_customer_id = customer["id"]
            db.commit()
        
        # Create subscription
        subscription = client.subscription.create({
            "plan_id": plan["plan_id"],
            "customer_id": current_user.razorpay_customer_id,
            "total_count": 12,
            "quantity": 1,
            "notes": {
                "user_id": str(current_user.id),
                "email": current_user.email
            }
        })
        
        # Create order for first payment
        order = client.order.create({
            "amount": plan["amount"],
            "currency": "INR",
            "receipt": f"subscription_{subscription['id']}",
            "notes": {
                "subscription_id": subscription["id"],
                "user_id": str(current_user.id)
            }
        })
        
        return CreateSubscriptionResponse(
            subscription_id=subscription["id"],
            customer_id=current_user.razorpay_customer_id,
            order_id=order["id"],
            amount=order["amount"],
            currency=order["currency"]
        )
        
    except razorpay.errors.RazorpayError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create subscription: {str(e)}"
        )


@router.post("/verify-payment")
async def verify_payment(
    subscription_id: str,
    payment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Verify payment and activate subscription"""
    try:
        client = get_razorpay_client()
        
        # Verify payment
        payment = client.payment.fetch(payment_id)
        
        if payment["status"] != "captured":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment not captured"
            )
        
        # Check if payment belongs to this subscription
        if payment.get("notes", {}).get("subscription_id") != subscription_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment does not match subscription"
            )
        
        # Determine tier based on subscription
        subscription = client.subscription.fetch(subscription_id)
        plan_id = subscription.get("plan_id", "")
        
        if "team" in plan_id:
            tier = SubscriptionTier.team
        elif "pro" in plan_id:
            tier = SubscriptionTier.pro
        else:
            tier = SubscriptionTier.pro
        
        # Update user subscription
        current_user.subscription_tier = tier
        current_user.razorpay_subscription_id = subscription_id
        current_user.subscription_status = "active"
        current_user.subscription_start_date = datetime.utcnow()
        
        # Calculate end date (1 month from now)
        from datetime import timedelta
        current_user.subscription_end_date = datetime.utcnow() + timedelta(days=30)
        
        db.commit()
        
        return {"status": "success", "message": "Subscription activated"}
        
    except razorpay.errors.RazorpayError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment verification failed: {str(e)}"
        )


@router.get("/status", response_model=SubscriptionResponse)
async def get_subscription_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current subscription status"""
    if current_user.subscription_tier == SubscriptionTier.free:
        return SubscriptionResponse(
            tier="free",
            status=None,
            cancel_at_period_end=False
        )
    
    return SubscriptionResponse(
        tier=current_user.subscription_tier.value,
        status=current_user.subscription_status,
        current_period_start=current_user.subscription_start_date,
        current_period_end=current_user.subscription_end_date,
        cancel_at_period_end=False
    )


@router.post("/cancel")
async def cancel_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cancel subscription at period end"""
    if current_user.subscription_tier == SubscriptionTier.free:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active subscription to cancel"
        )
    
    if not current_user.razorpay_subscription_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No subscription found"
        )
    
    try:
        client = get_razorpay_client()
        
        # Cancel subscription
        client.subscription.cancel(current_user.razorpay_subscription_id)
        
        current_user.subscription_status = "cancelled"
        db.commit()
        
        return {
            "status": "success", 
            "message": "Subscription will be cancelled at the end of the billing period"
        }
        
    except razorpay.errors.RazorpayError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to cancel subscription: {str(e)}"
        )


@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """Handle Razorpay webhooks"""
    try:
        body = await request.body()
        signature = request.headers.get("x-razorpay-signature", "")
        
        # Verify webhook signature
        if RAZORPAY_WEBHOOK_SECRET:
            expected_signature = hmac.new(
                RAZORPAY_WEBHOOK_SECRET.encode(),
                body,
                hashlib.sha256
            ).hexdigest()
            
            if not hmac.compare_digest(signature, expected_signature):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid webhook signature"
                )
        
        import json
        event = json.loads(body)
        
        event_type = event.get("event")
        payload = event.get("payload", {})
        
        # Handle subscription events
        if event_type == "subscription.activated":
            subscription = payload.get("subscription", {})
            customer = payload.get("customer", {})
            
            user = db.query(User).filter(
                User.razorpay_customer_id == customer.get("id")
            ).first()
            
            if user:
                plan_id = subscription.get("plan_id", "")
                if "team" in plan_id:
                    user.subscription_tier = SubscriptionTier.team
                else:
                    user.subscription_tier = SubscriptionTier.pro
                
                user.subscription_status = "active"
                user.razorpay_subscription_id = subscription.get("id")
                user.subscription_start_date = datetime.utcnow()
                from datetime import timedelta
                user.subscription_end_date = datetime.utcnow() + timedelta(days=30)
                db.commit()
                
        elif event_type == "subscription.cancelled":
            subscription = payload.get("subscription", {})
            
            user = db.query(User).filter(
                User.razorpay_subscription_id == subscription.get("id")
            ).first()
            
            if user:
                user.subscription_status = "cancelled"
                db.commit()
                
        elif event_type == "subscription.charged":
            subscription = payload.get("subscription", {})
            
            user = db.query(User).filter(
                User.razorpay_subscription_id == subscription.get("id")
            ).first()
            
            if user:
                from datetime import timedelta
                user.subscription_end_date = datetime.utcnow() + timedelta(days=30)
                user.subscription_status = "active"
                db.commit()
                
        elif event_type == "subscription.paused":
            subscription = payload.get("subscription", {})
            
            user = db.query(User).filter(
                User.razorpay_subscription_id == subscription.get("id")
            ).first()
            
            if user:
                user.subscription_status = "paused"
                db.commit()
                
        elif event_type == "subscription.resumed":
            subscription = payload.get("subscription", {})
            
            user = db.query(User).filter(
                User.razorpay_subscription_id == subscription.get("id")
            ).first()
            
            if user:
                user.subscription_status = "active"
                db.commit()
                
        return {"status": "received"}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/plans")
async def get_plans():
    """Get available plans with pricing"""
    return {
        "free": {
            "id": "free",
            "name": "Free Plan",
            "price": 0,
            "currency": "INR",
            "interval": "forever",
            "features": PLAN_LIMITS["free"]
        },
        "pro": {
            "id": "pro",
            "name": "Pro Plan",
            "price": 999,
            "currency": "INR",
            "interval": "month",
            "features": PLAN_LIMITS["pro"]
        },
        "team": {
            "id": "team",
            "name": "Team Plan",
            "price": 3999,
            "currency": "INR",
            "interval": "month", 
            "features": PLAN_LIMITS["team"]
        }
    }


import secrets


@router.post("/api-key/generate")
async def generate_api_key(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate a new API key"""
    if current_user.subscription_tier != SubscriptionTier.team:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="API access is only available for Team plan"
        )
    
    api_key = secrets.token_hex(32)
    current_user.api_key = api_key
    current_user.api_key_created_at = datetime.utcnow()
    db.commit()
    
    return {
        "api_key": api_key,
        "message": "Save this API key. It will not be shown again."
    }


@router.post("/api-key/revoke")
async def revoke_api_key(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Revoke the current API key"""
    if current_user.subscription_tier != SubscriptionTier.team:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="API access is only available for Team plan"
        )
    
    current_user.api_key = None
    current_user.api_key_created_at = None
    db.commit()
    
    return {"message": "API key revoked successfully"}


@router.get("/api-key/status")
async def get_api_key_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get API key status"""
    if current_user.subscription_tier != SubscriptionTier.team:
        return {
            "has_api_key": False,
            "message": "API access is only available for Team plan"
        }
    
    return {
        "has_api_key": bool(current_user.api_key),
        "created_at": current_user.api_key_created_at.isoformat() if current_user.api_key_created_at else None
    }
