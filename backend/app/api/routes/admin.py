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
from datetime import datetime, timedelta

# Database and security imports
from app.core.database import get_db
from app.core.deps import get_current_user

# Models
from app.models.user import User
from app.models.gesture import Gesture, ActivityLog
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


class MonthlyUserGrowth(BaseModel):
    """Schema for monthly user growth data"""
    month_start: str
    month_label: str
    user_count: int


class MonthlyAccuracyData(BaseModel):
    """Schema for monthly gesture accuracy data"""
    month_start: str
    month_label: str
    avg_accuracy: float


class OverviewStats(BaseModel):
    """Schema for overview dashboard statistics"""
    total_users: int
    active_users: int
    average_gesture_accuracy: float
    total_false_triggers: int


class ActivityLogForAdmin(BaseModel):
    """Schema for activity log in admin dashboard"""
    id: int
    user_id: int
    user_email: Optional[str]
    action: str
    timestamp: datetime
    meta_data: Optional[dict]

    class Config:
        from_attributes = True


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


@router.get("/overview-stats", response_model=OverviewStats)
def get_overview_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive overview statistics for admin dashboard.

    Requires ADMIN role.

    Returns:
        - Total users count
        - Active users count (logged in within last 30 days)
        - Average gesture accuracy across all gestures
        - Total false triggers count

    Raises:
        HTTPException 403: User is not an admin
    """
    verify_admin(current_user)

    # Total users
    total_users = db.query(func.count(User.id)).scalar() or 0

    # Active users (logged in within last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    active_users = db.query(func.count(User.id)).filter(
        User.last_login >= thirty_days_ago
    ).scalar() or 0

    # Average gesture accuracy (average of all gestures' accuracy_score)
    avg_accuracy_result = db.query(func.avg(Gesture.accuracy_score)).filter(
        Gesture.accuracy_score.isnot(None)
    ).scalar()
    average_gesture_accuracy = float(avg_accuracy_result) if avg_accuracy_result else 0.0

    # Total false triggers (sum of all gestures' false_trigger_count)
    total_false_triggers_result = db.query(func.sum(Gesture.false_trigger_count)).scalar()
    total_false_triggers = int(total_false_triggers_result) if total_false_triggers_result else 0

    return {
        "total_users": total_users,
        "active_users": active_users,
        "average_gesture_accuracy": average_gesture_accuracy,
        "total_false_triggers": total_false_triggers
    }


@router.get("/monthly-user-growth", response_model=List[MonthlyUserGrowth])
def get_monthly_user_growth(
    months: int = 6,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get monthly user growth data for the specified number of months.

    Requires ADMIN role.

    Args:
        months: Number of months to retrieve (default: 6)

    Returns:
        List of monthly user counts with month labels

    Raises:
        HTTPException 403: User is not an admin
    """
    verify_admin(current_user)

    monthly_data = []

    # Get current date
    now = datetime.utcnow()

    for i in range(months - 1, -1, -1):
        # Calculate month boundaries
        # Go back i months from current month
        if now.month - i <= 0:
            # Handle year boundary
            target_month = 12 + (now.month - i)
            target_year = now.year - 1
        else:
            target_month = now.month - i
            target_year = now.year

        # First day of target month
        month_start = datetime(target_year, target_month, 1)

        # First day of next month
        if target_month == 12:
            month_end = datetime(target_year + 1, 1, 1)
        else:
            month_end = datetime(target_year, target_month + 1, 1)

        # Count users created in this month
        user_count = db.query(func.count(User.id)).filter(
            User.created_at >= month_start,
            User.created_at < month_end
        ).scalar() or 0

        # Format month label (e.g., "Jan", "Feb", "Mar")
        month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        month_label = month_names[target_month - 1]

        monthly_data.append({
            "month_start": month_start.strftime("%Y-%m-%d"),
            "month_label": month_label,
            "user_count": user_count
        })

    return monthly_data


@router.get("/monthly-gesture-accuracy", response_model=List[MonthlyAccuracyData])
def get_monthly_gesture_accuracy(
    months: int = 6,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get monthly average gesture accuracy for the specified number of months.

    Requires ADMIN role.

    Args:
        months: Number of months to retrieve (default: 6)

    Returns:
        List of monthly average accuracy scores

    Raises:
        HTTPException 403: User is not an admin
    """
    verify_admin(current_user)

    monthly_data = []

    # Get current date
    now = datetime.utcnow()

    for i in range(months - 1, -1, -1):
        # Calculate month boundaries
        if now.month - i <= 0:
            target_month = 12 + (now.month - i)
            target_year = now.year - 1
        else:
            target_month = now.month - i
            target_year = now.year

        # First day of target month
        month_start = datetime(target_year, target_month, 1)

        # First day of next month
        if target_month == 12:
            month_end = datetime(target_year + 1, 1, 1)
        else:
            month_end = datetime(target_year, target_month + 1, 1)

        # Calculate average accuracy for gestures updated in this month
        avg_accuracy = db.query(func.avg(Gesture.accuracy_score)).filter(
            Gesture.accuracy_score.isnot(None),
            Gesture.updated_at >= month_start,
            Gesture.updated_at < month_end
        ).scalar()

        # If no data for this month, use 0
        avg_accuracy_value = float(avg_accuracy) if avg_accuracy else 0.0

        # Format month label (e.g., "Jan", "Feb", "Mar")
        month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        month_label = month_names[target_month - 1]

        monthly_data.append({
            "month_start": month_start.strftime("%Y-%m-%d"),
            "month_label": month_label,
            "avg_accuracy": avg_accuracy_value
        })

    return monthly_data


@router.get("/recent-activity", response_model=List[ActivityLogForAdmin])
def get_recent_activity(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get recent activity logs from all users.

    Requires ADMIN role.

    Args:
        limit: Maximum number of logs to return (default: 50)

    Returns:
        List of recent activity logs with user information

    Raises:
        HTTPException 403: User is not an admin
    """
    verify_admin(current_user)

    # Get activity logs with user email joined
    logs = db.query(
        ActivityLog.id,
        ActivityLog.user_id,
        ActivityLog.action,
        ActivityLog.timestamp,
        ActivityLog.meta_data,
        User.email.label("user_email")
    ).join(
        User, ActivityLog.user_id == User.id
    ).order_by(
        ActivityLog.timestamp.desc()
    ).limit(limit).all()

    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "user_email": log.user_email,
            "action": log.action,
            "timestamp": log.timestamp,
            "meta_data": log.meta_data
        }
        for log in logs
    ]


# ============================================
# ADMIN SETTINGS ENDPOINTS
# ============================================

# Import admin settings schemas
from app.schemas.admin_settings import (
    AdminSettings,
    AdminSettingsUpdate,
    AdminSettingsResponse,
    AdminSettingsUpdateResponse,
    DEFAULT_ADMIN_SETTINGS
)
import json
import os
import logging

logger = logging.getLogger(__name__)

# Settings file path (stored in user home directory)
ADMIN_SETTINGS_FILE = os.path.join(os.path.expanduser("~"), ".airclick-admin-settings.json")


def load_admin_settings() -> AdminSettings:
    """
    Load admin settings from file.
    Returns default settings if file doesn't exist or is invalid.
    """
    try:
        if os.path.exists(ADMIN_SETTINGS_FILE):
            with open(ADMIN_SETTINGS_FILE, 'r') as f:
                data = json.load(f)
                return AdminSettings(**data)
    except Exception as e:
        logger.warning(f"Error loading admin settings: {e}")

    return DEFAULT_ADMIN_SETTINGS.model_copy()


def save_admin_settings(settings: AdminSettings) -> bool:
    """
    Save admin settings to file.
    """
    try:
        with open(ADMIN_SETTINGS_FILE, 'w') as f:
            json.dump(settings.model_dump(), f, indent=2)
        return True
    except Exception as e:
        logger.error(f"Error saving admin settings: {e}")
        return False


def apply_admin_settings_to_runtime(settings: AdminSettings) -> bool:
    """
    Apply admin settings to the running gesture control system.
    """
    try:
        from app.services.gesture_matcher import get_gesture_matcher
        from app.services.hybrid_state_machine import get_hybrid_state_machine

        # Apply gesture system settings
        gesture_matcher = get_gesture_matcher()
        gesture_matcher.similarity_threshold = settings.gesture_system.global_similarity_threshold

        state_machine = get_hybrid_state_machine()
        state_machine.stationary_duration_threshold = settings.gesture_system.stationary_duration_threshold
        state_machine.collection_frame_count = settings.gesture_system.gesture_collection_frames
        state_machine.idle_cooldown_duration = settings.gesture_system.gesture_cooldown_duration

        logger.info(f"Applied admin settings to runtime: threshold={settings.gesture_system.global_similarity_threshold}")
        return True

    except Exception as e:
        logger.error(f"Error applying admin settings to runtime: {e}")
        return False


@router.get("/settings", response_model=AdminSettingsResponse)
def get_admin_settings(
    current_user: User = Depends(get_current_user)
):
    """
    Get current admin system settings.

    Requires ADMIN role.

    Returns:
        Current admin settings
    """
    verify_admin(current_user)

    settings = load_admin_settings()

    return AdminSettingsResponse(
        settings=settings,
        message="Settings retrieved successfully"
    )


@router.put("/settings", response_model=AdminSettingsUpdateResponse)
def update_admin_settings(
    settings_update: AdminSettingsUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    Update admin system settings.

    Requires ADMIN role.

    Args:
        settings_update: Fields to update

    Returns:
        Updated settings
    """
    verify_admin(current_user)

    # Load current settings
    current_settings = load_admin_settings()

    # Merge with updates
    if settings_update.system:
        current_settings.system = settings_update.system
    if settings_update.defaults:
        current_settings.defaults = settings_update.defaults
    if settings_update.gesture_system:
        current_settings.gesture_system = settings_update.gesture_system

    # Save to file
    if not save_admin_settings(current_settings):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save settings"
        )

    # Apply to runtime
    applied = apply_admin_settings_to_runtime(current_settings)

    return AdminSettingsUpdateResponse(
        settings=current_settings,
        message="Settings updated successfully",
        applied_to_runtime=applied
    )


@router.post("/settings/reset", response_model=AdminSettingsUpdateResponse)
def reset_admin_settings(
    current_user: User = Depends(get_current_user)
):
    """
    Reset admin settings to defaults.

    Requires ADMIN role.

    Returns:
        Default settings
    """
    verify_admin(current_user)

    # Get default settings
    default_settings = DEFAULT_ADMIN_SETTINGS.model_copy()

    # Save to file
    if not save_admin_settings(default_settings):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save settings"
        )

    # Apply to runtime
    applied = apply_admin_settings_to_runtime(default_settings)

    return AdminSettingsUpdateResponse(
        settings=default_settings,
        message="Settings reset to defaults",
        applied_to_runtime=applied
    )
