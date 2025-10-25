"""
AirClick - Action Mappings API Routes
======================================

RESTful API endpoints for managing action mappings (keyboard shortcuts).
Admin-only routes for creating, updating, and deleting actions.
Public routes for listing and searching actions.

Author: Muhammad Shawaiz
Project: AirClick FYP
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.user import User
from app.models.action_mapping import ActionMapping
from app.schemas.action_mapping import (
    ActionMappingCreate,
    ActionMappingUpdate,
    ActionMappingResponse,
    ActionMappingListResponse,
    ActionMappingFilter,
    ActionMappingStatistics,
    ActionMappingDetailResponse,
    AppContext,
    ActionCategory
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================
# PUBLIC ENDPOINTS (All authenticated users)
# ============================================================

@router.get("/", response_model=ActionMappingListResponse)
def get_all_action_mappings(
    app_context: Optional[str] = Query(None, description="Filter by application context"),
    category: Optional[str] = Query(None, description="Filter by category"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    search: Optional[str] = Query(None, max_length=100, description="Search term"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all action mappings with optional filters.

    **Accessible by:** All authenticated users

    **Query Parameters:**
    - app_context: Filter by context (GLOBAL, POWERPOINT, WORD)
    - category: Filter by category (NAVIGATION, EDITING, etc.)
    - is_active: Filter by status (true/false)
    - search: Search in name, description, or action_id

    **Returns:**
    - total: Total number of matching actions
    - actions: List of action mappings
    """
    query = db.query(ActionMapping)

    # Apply filters
    if app_context:
        query = query.filter(ActionMapping.app_context == app_context.upper())

    if category:
        query = query.filter(ActionMapping.category == category.upper())

    if is_active is not None:
        query = query.filter(ActionMapping.is_active == is_active)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (ActionMapping.name.ilike(search_term)) |
            (ActionMapping.description.ilike(search_term)) |
            (ActionMapping.action_id.ilike(search_term))
        )

    # Order by context, category, name
    actions = query.order_by(
        ActionMapping.app_context,
        ActionMapping.category,
        ActionMapping.name
    ).all()

    logger.info(f"User {current_user.email} fetched {len(actions)} action mappings")

    return {
        "total": len(actions),
        "actions": actions
    }


@router.get("/context/{context}", response_model=List[ActionMappingResponse])
def get_actions_by_context(
    context: AppContext,
    active_only: bool = Query(True, description="Only return active actions"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all action mappings for a specific application context.

    **Accessible by:** All authenticated users

    **Use Case:** User recording gesture needs to see available actions for selected context

    **Path Parameters:**
    - context: Application context (GLOBAL, POWERPOINT, WORD)

    **Query Parameters:**
    - active_only: If true, only return active actions (default: true)

    **Returns:**
    - List of action mappings for the specified context
    """
    actions = ActionMapping.get_by_context(
        db=db,
        app_context=context.value,
        active_only=active_only
    )

    logger.info(
        f"User {current_user.email} fetched {len(actions)} actions "
        f"for context '{context.value}' (active_only={active_only})"
    )

    return actions


@router.get("/category/{category}", response_model=List[ActionMappingResponse])
def get_actions_by_category(
    category: ActionCategory,
    active_only: bool = Query(True, description="Only return active actions"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all action mappings for a specific category.

    **Accessible by:** All authenticated users

    **Path Parameters:**
    - category: Action category (NAVIGATION, EDITING, FORMATTING, etc.)

    **Query Parameters:**
    - active_only: If true, only return active actions (default: true)

    **Returns:**
    - List of action mappings for the specified category
    """
    actions = ActionMapping.get_by_category(
        db=db,
        category=category.value,
        active_only=active_only
    )

    logger.info(
        f"User {current_user.email} fetched {len(actions)} actions "
        f"for category '{category.value}'"
    )

    return actions


@router.get("/statistics", response_model=ActionMappingStatistics)
def get_action_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get statistics about action mappings.

    **Accessible by:** All authenticated users

    **Returns:**
    - total: Total number of actions
    - active: Number of active actions
    - inactive: Number of inactive actions
    - by_context: Count by application context
    - by_category: Count by category
    """
    stats = ActionMapping.get_statistics(db)

    logger.info(f"User {current_user.email} fetched action statistics")

    return stats


@router.get("/{action_id}", response_model=ActionMappingDetailResponse)
def get_action_mapping(
    action_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific action mapping by action_id.

    **Accessible by:** All authenticated users

    **Path Parameters:**
    - action_id: Unique action identifier (e.g., "ppt_next_slide")

    **Returns:**
    - Action mapping details with computed fields
    """
    action = ActionMapping.get_by_action_id(db, action_id)

    if not action:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Action mapping '{action_id}' not found"
        )

    logger.info(f"User {current_user.email} fetched action '{action_id}'")

    # Convert to dict and add computed fields
    action_dict = action.to_dict()
    action_dict['keyboard_shortcut_display'] = action.keyboard_shortcut_display
    action_dict['num_keys'] = action.num_keys

    return action_dict


# ============================================================
# ADMIN-ONLY ENDPOINTS
# ============================================================

@router.post("/", response_model=ActionMappingResponse, status_code=status.HTTP_201_CREATED)
def create_action_mapping(
    action_data: ActionMappingCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Create a new action mapping.

    **Accessible by:** Admins only

    **Request Body:**
    - action_id: Unique identifier (lowercase, underscores)
    - name: Display name
    - description: Detailed description
    - app_context: Application context
    - category: Action category
    - keyboard_keys: Array of keys (e.g., ["ctrl", "p"])
    - icon: Emoji or unicode symbol
    - is_active: Active status

    **Returns:**
    - Created action mapping

    **Raises:**
    - 400: If action_id already exists
    - 403: If user is not admin
    """
    logger.info(f"Admin {current_user.email} creating action '{action_data.action_id}'")

    # Check if action_id already exists
    existing = ActionMapping.get_by_action_id(db, action_data.action_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Action mapping with action_id '{action_data.action_id}' already exists"
        )

    # Create new action mapping
    new_action = ActionMapping(
        action_id=action_data.action_id,
        name=action_data.name,
        description=action_data.description,
        app_context=action_data.app_context,
        category=action_data.category,
        keyboard_keys=action_data.keyboard_keys,
        icon=action_data.icon,
        is_active=action_data.is_active,
        created_by=current_user.id
    )

    db.add(new_action)
    db.commit()
    db.refresh(new_action)

    logger.info(
        f"✅ Admin {current_user.email} created action '{action_data.action_id}' "
        f"with keys {action_data.keyboard_keys}"
    )

    return new_action


@router.put("/{action_id}", response_model=ActionMappingResponse)
def update_action_mapping(
    action_id: str,
    action_data: ActionMappingUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Update an existing action mapping.

    **Accessible by:** Admins only

    **Path Parameters:**
    - action_id: Unique action identifier

    **Request Body:**
    - Any fields to update (all optional)

    **Returns:**
    - Updated action mapping

    **Raises:**
    - 404: If action_id not found
    - 403: If user is not admin
    """
    logger.info(f"Admin {current_user.email} updating action '{action_id}'")

    # Get existing action
    action = ActionMapping.get_by_action_id(db, action_id)
    if not action:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Action mapping '{action_id}' not found"
        )

    # Update fields if provided
    update_data = action_data.dict(exclude_unset=True)

    for field, value in update_data.items():
        setattr(action, field, value)

    db.commit()
    db.refresh(action)

    logger.info(
        f"✅ Admin {current_user.email} updated action '{action_id}' "
        f"(fields: {list(update_data.keys())})"
    )

    return action


@router.delete("/{action_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_action_mapping(
    action_id: str,
    hard_delete: bool = Query(False, description="Permanently delete (true) or soft delete (false)"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Delete an action mapping (soft delete by default).

    **Accessible by:** Admins only

    **Path Parameters:**
    - action_id: Unique action identifier

    **Query Parameters:**
    - hard_delete: If true, permanently delete from database. If false, just set is_active=false

    **Returns:**
    - 204 No Content on success

    **Raises:**
    - 404: If action_id not found
    - 403: If user is not admin
    """
    logger.info(
        f"Admin {current_user.email} deleting action '{action_id}' "
        f"(hard_delete={hard_delete})"
    )

    # Get existing action
    action = ActionMapping.get_by_action_id(db, action_id)
    if not action:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Action mapping '{action_id}' not found"
        )

    if hard_delete:
        # Permanently delete from database
        db.delete(action)
        logger.warning(f"🗑️ Admin {current_user.email} permanently deleted action '{action_id}'")
    else:
        # Soft delete (set is_active = false)
        action.is_active = False
        logger.info(f"✅ Admin {current_user.email} soft-deleted action '{action_id}'")

    db.commit()

    return None


@router.post("/{action_id}/activate", response_model=ActionMappingResponse)
def activate_action_mapping(
    action_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Activate a soft-deleted action mapping.

    **Accessible by:** Admins only

    **Path Parameters:**
    - action_id: Unique action identifier

    **Returns:**
    - Activated action mapping

    **Raises:**
    - 404: If action_id not found
    - 403: If user is not admin
    """
    logger.info(f"Admin {current_user.email} activating action '{action_id}'")

    action = ActionMapping.get_by_action_id(db, action_id)
    if not action:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Action mapping '{action_id}' not found"
        )

    action.is_active = True
    db.commit()
    db.refresh(action)

    logger.info(f"✅ Admin {current_user.email} activated action '{action_id}'")

    return action


@router.post("/{action_id}/deactivate", response_model=ActionMappingResponse)
def deactivate_action_mapping(
    action_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Deactivate an action mapping (soft delete).

    **Accessible by:** Admins only

    **Path Parameters:**
    - action_id: Unique action identifier

    **Returns:**
    - Deactivated action mapping

    **Raises:**
    - 404: If action_id not found
    - 403: If user is not admin
    """
    logger.info(f"Admin {current_user.email} deactivating action '{action_id}'")

    action = ActionMapping.get_by_action_id(db, action_id)
    if not action:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Action mapping '{action_id}' not found"
        )

    action.is_active = False
    db.commit()
    db.refresh(action)

    logger.info(f"✅ Admin {current_user.email} deactivated action '{action_id}'")

    return action


# ============================================================
# UTILITY ENDPOINTS
# ============================================================

@router.get("/validate/action-id/{action_id}")
def validate_action_id(
    action_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Check if an action_id is available (not already taken).

    **Accessible by:** All authenticated users

    **Path Parameters:**
    - action_id: Action ID to validate

    **Returns:**
    - available: true if action_id is not taken, false otherwise
    - message: Description message
    """
    existing = ActionMapping.get_by_action_id(db, action_id)

    return {
        "action_id": action_id,
        "available": existing is None,
        "message": "Action ID is available" if existing is None else "Action ID already exists"
    }
