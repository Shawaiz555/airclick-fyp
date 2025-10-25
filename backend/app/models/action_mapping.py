"""
AirClick - Action Mapping Model
================================

SQLAlchemy model for the action_mappings table.
Stores admin-defined keyboard shortcuts with flexible key combinations.

Author: Muhammad Shawaiz
Project: AirClick FYP
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class ActionMapping(Base):
    """
    Action Mapping Model

    Represents a keyboard shortcut action that can be triggered by gestures.
    Admins create these actions, and users assign them to their custom gestures.

    Example:
        action = ActionMapping(
            action_id="ppt_next_slide",
            name="Next Slide",
            description="Advance to the next slide",
            app_context="POWERPOINT",
            category="NAVIGATION",
            keyboard_keys=["right"],
            icon="→",
            is_active=True
        )

    Attributes:
        id: Primary key
        action_id: Unique identifier used in code (e.g., "ppt_next_slide")
        name: User-friendly display name (e.g., "Next Slide")
        description: Detailed explanation of what the action does
        app_context: Application context (GLOBAL, POWERPOINT, WORD, BROWSER, MEDIA)
        category: Action category (NAVIGATION, EDITING, FORMATTING, MEDIA_CONTROL, SYSTEM)
        keyboard_keys: JSONB array of keys (e.g., ["ctrl", "p"] or ["win", "shift", "s"])
        icon: Emoji or unicode symbol (e.g., "→", "⏯", "💾")
        is_active: Soft delete flag (false = hidden from users)
        created_by: Foreign key to users table (admin who created this)
        created_at: Timestamp when action was created
        updated_at: Timestamp when action was last modified
    """

    __tablename__ = "action_mappings"

    # Primary Key
    id = Column(Integer, primary_key=True, index=True)

    # Unique Identifier (used in code and API calls)
    action_id = Column(String(100), unique=True, nullable=False, index=True)

    # Display Information
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    # Context and Category
    app_context = Column(String(50), nullable=False, index=True)
    category = Column(String(50), nullable=True, index=True)

    # Keyboard Shortcut (JSONB array for flexibility)
    # Examples: ["escape"], ["ctrl", "p"], ["win", "shift", "s"]
    keyboard_keys = Column(JSONB, nullable=False)

    # Visual Representation
    icon = Column(String(10), nullable=True)

    # Status (soft delete)
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    # Audit Fields
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    # Note: We don't create a back-reference to User to avoid circular imports
    # Access via: db.query(User).filter(User.id == action.created_by).first()

    def __repr__(self):
        """String representation for debugging"""
        return f"<ActionMapping(id={self.id}, action_id='{self.action_id}', name='{self.name}', context='{self.app_context}')>"

    def to_dict(self):
        """
        Convert model to dictionary for JSON serialization

        Returns:
            dict: Dictionary representation of the action mapping
        """
        return {
            "id": self.id,
            "action_id": self.action_id,
            "name": self.name,
            "description": self.description,
            "app_context": self.app_context,
            "category": self.category,
            "keyboard_keys": self.keyboard_keys,  # Already a list from JSONB
            "icon": self.icon,
            "is_active": self.is_active,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    @property
    def keyboard_shortcut_display(self):
        """
        Get formatted keyboard shortcut for display

        Returns:
            str: Human-readable keyboard shortcut (e.g., "Ctrl+P", "Win+Shift+S")
        """
        if not self.keyboard_keys:
            return ""

        # Capitalize first letter of each key and join with +
        keys = [key.capitalize() for key in self.keyboard_keys]
        return "+".join(keys)

    @property
    def num_keys(self):
        """
        Get number of keys in the keyboard shortcut

        Returns:
            int: Number of keys (e.g., 1 for ["escape"], 2 for ["ctrl", "p"])
        """
        return len(self.keyboard_keys) if self.keyboard_keys else 0

    @classmethod
    def get_by_action_id(cls, db, action_id: str):
        """
        Get action mapping by action_id

        Args:
            db: Database session
            action_id: Unique action identifier

        Returns:
            ActionMapping or None
        """
        return db.query(cls).filter(cls.action_id == action_id).first()

    @classmethod
    def get_by_context(cls, db, app_context: str, active_only: bool = True):
        """
        Get all action mappings for a specific context

        Args:
            db: Database session
            app_context: Application context (GLOBAL, POWERPOINT, WORD, etc.)
            active_only: If True, only return active actions

        Returns:
            list[ActionMapping]: List of action mappings
        """
        query = db.query(cls).filter(cls.app_context == app_context)
        if active_only:
            query = query.filter(cls.is_active == True)
        return query.order_by(cls.category, cls.name).all()

    @classmethod
    def get_by_category(cls, db, category: str, active_only: bool = True):
        """
        Get all action mappings for a specific category

        Args:
            db: Database session
            category: Action category (NAVIGATION, EDITING, etc.)
            active_only: If True, only return active actions

        Returns:
            list[ActionMapping]: List of action mappings
        """
        query = db.query(cls).filter(cls.category == category)
        if active_only:
            query = query.filter(cls.is_active == True)
        return query.order_by(cls.app_context, cls.name).all()

    @classmethod
    def search(cls, db, search_query: str, active_only: bool = True):
        """
        Search action mappings by name or description

        Args:
            db: Database session
            search_query: Search term
            active_only: If True, only return active actions

        Returns:
            list[ActionMapping]: List of matching action mappings
        """
        search_term = f"%{search_query}%"
        query = db.query(cls).filter(
            (cls.name.ilike(search_term)) |
            (cls.description.ilike(search_term)) |
            (cls.action_id.ilike(search_term))
        )
        if active_only:
            query = query.filter(cls.is_active == True)
        return query.order_by(cls.app_context, cls.name).all()

    @classmethod
    def get_all_active(cls, db):
        """
        Get all active action mappings

        Args:
            db: Database session

        Returns:
            list[ActionMapping]: List of all active action mappings
        """
        return db.query(cls).filter(cls.is_active == True).order_by(
            cls.app_context, cls.category, cls.name
        ).all()

    @classmethod
    def get_statistics(cls, db):
        """
        Get statistics about action mappings

        Args:
            db: Database session

        Returns:
            dict: Statistics including counts by context and category
        """
        from sqlalchemy import func as sql_func

        total = db.query(sql_func.count(cls.id)).scalar()
        active = db.query(sql_func.count(cls.id)).filter(cls.is_active == True).scalar()

        # Count by context
        by_context = db.query(
            cls.app_context,
            sql_func.count(cls.id).label('count')
        ).group_by(cls.app_context).all()

        # Count by category
        by_category = db.query(
            cls.category,
            sql_func.count(cls.id).label('count')
        ).group_by(cls.category).all()

        return {
            "total": total,
            "active": active,
            "inactive": total - active,
            "by_context": {ctx: cnt for ctx, cnt in by_context},
            "by_category": {cat: cnt for cat, cnt in by_category if cat}
        }
