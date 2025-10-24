"""
Admin Routes Module

This module handles all admin-related endpoints including:
- User management (list, update, disable users)
- Activity logs retrieval
- User statistics

All endpoints require ADMIN role authentication.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from datetime import datetime

# Database and security imports
from app.core.database import get_db
from app.core.deps import get_current_user

# Models
from app.models.user import User
from sqlalchemy import text

# Pydantic schemas
from pydantic import BaseModel, EmailStr, Field

router = APIRouter()


# ============================================
# PYDANTIC SCHEMAS
# ============================================

class UserUpdateAdmin(BaseModel):
    """Schema for updating user by admin"""
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = Field(None, pattern="^(USER|ADMIN|MODERATOR)$")
    status: Optional[str] = Field(None, pattern="^(ACTIVE|INACTIVE)$")
    accessibility_settings: Optional[dict] = None


class UserResponse(BaseModel):
    """Schema for user response"""
    id: int
    full_name: Optional[str] = None
    email: str
    role: str
    status: str
    last_login: Optional[datetime]
    created_at: datetime
    accessibility_settings: dict
    email_verified: bool

    class Config:
        from_attributes = True


class ActivityLogResponse(BaseModel):
    """Schema for activity log response"""
    id: int
    action: str
    timestamp: datetime
    ip_address: Optional[str]
    metadata: Optional[dict]

    class Config:
        from_attributes = True


class UserStatsResponse(BaseModel):
    """Schema for user statistics"""
    total: int
    active: int
    inactive: int
    admins: int
    moderators: int
    users: int


# ============================================
# HELPER FUNCTIONS
# ============================================

def verify_admin(current_user: User):
    """Verify that the current user is an admin"""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )


# ============================================
# USER MANAGEMENT ENDPOINTS
# ============================================

@router.get("/users", response_model=List[UserResponse])
def get_all_users(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all users with optional filtering.

    Requires ADMIN role.

    Query Parameters:
        skip: Number of records to skip (pagination)
        limit: Maximum number of records to return
        search: Search query for name or email
        role: Filter by role (USER, ADMIN, MODERATOR)
        status: Filter by status (ACTIVE, INACTIVE)

    Returns:
        List of users

    Raises:
        HTTPException 403: User is not an admin
    """
    verify_admin(current_user)

    # Build query
    query = db.query(User)

    # Apply filters
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                User.full_name.ilike(search_filter),
                User.email.ilike(search_filter)
            )
        )

    if role and role != "ALL":
        query = query.filter(User.role == role)

    if status and status != "ALL":
        query = query.filter(User.status == status)

    # Get users with pagination
    users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()

    return users


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific user by ID.

    Requires ADMIN role.

    Returns:
        User details

    Raises:
        HTTPException 403: User is not an admin
        HTTPException 404: User not found
    """
    verify_admin(current_user)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return user


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_update: UserUpdateAdmin,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a user's information.

    Requires ADMIN role.
    Admin cannot demote themselves.

    Args:
        user_id: ID of user to update
        user_update: Fields to update

    Returns:
        Updated user

    Raises:
        HTTPException 403: User is not an admin or trying to demote self
        HTTPException 404: User not found
        HTTPException 400: Email already taken
    """
    verify_admin(current_user)

    # Get user to update
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent admin from demoting themselves
    if user.id == current_user.id and user_update.role and user_update.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot change your own admin role"
        )

    # Update fields
    update_data = user_update.model_dump(exclude_unset=True)

    # Check if email is being changed and if it's already taken
    if "email" in update_data and update_data["email"] != user.email:
        existing_user = db.query(User).filter(User.email == update_data["email"]).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

    # Apply updates
    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    return user


@router.delete("/users/{user_id}")
def disable_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Disable a user account (soft delete).

    Requires ADMIN role.
    Admin cannot disable themselves.

    Args:
        user_id: ID of user to disable

    Returns:
        Success message

    Raises:
        HTTPException 403: User is not an admin or trying to disable self
        HTTPException 404: User not found
    """
    verify_admin(current_user)

    # Get user to disable
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent admin from disabling themselves
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot disable your own account"
        )

    # Set status to INACTIVE
    user.status = "INACTIVE"
    db.commit()

    return {"message": "User disabled successfully"}


@router.get("/users/{user_id}/activity", response_model=List[ActivityLogResponse])
def get_user_activity(
    user_id: int,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get activity logs for a specific user.

    Requires ADMIN role.

    Args:
        user_id: ID of user
        skip: Number of records to skip
        limit: Maximum number of records to return

    Returns:
        List of activity logs

    Raises:
        HTTPException 403: User is not an admin
        HTTPException 404: User not found
    """
    verify_admin(current_user)

    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Get activity logs from activity_logs table
    logs = db.execute(
        text("""
            SELECT id, action, timestamp, ip_address, meta_data
            FROM activity_logs
            WHERE user_id = :user_id
            ORDER BY timestamp DESC
            LIMIT :limit OFFSET :skip
        """),
        {"user_id": user_id, "limit": limit, "skip": skip}
    ).fetchall()

    # Convert to dict format
    return [
        {
            "id": log.id,
            "action": log.action,
            "timestamp": log.timestamp,
            "ip_address": log.ip_address,
            "metadata": log.meta_data
        }
        for log in logs
    ]


@router.get("/stats", response_model=UserStatsResponse)
def get_user_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get user statistics.

    Requires ADMIN role.

    Returns:
        User statistics including total, active, inactive counts by role

    Raises:
        HTTPException 403: User is not an admin
    """
    verify_admin(current_user)

    # Get counts
    total = db.query(func.count(User.id)).scalar()
    active = db.query(func.count(User.id)).filter(User.status == "ACTIVE").scalar()
    inactive = db.query(func.count(User.id)).filter(User.status == "INACTIVE").scalar()
    admins = db.query(func.count(User.id)).filter(User.role == "ADMIN").scalar()
    moderators = db.query(func.count(User.id)).filter(User.role == "MODERATOR").scalar()
    users = db.query(func.count(User.id)).filter(User.role == "USER").scalar()

    return {
        "total": total,
        "active": active,
        "inactive": inactive,
        "admins": admins,
        "moderators": moderators,
        "users": users
    }
