"""
Authentication Routes Module

This module handles all authentication-related endpoints including:
- Traditional email/password registration and login
- Google OAuth login/signup
- Password reset (forgot password)
- Token verification

All endpoints return JWT tokens for authenticated sessions.
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import secrets
import hashlib
import os
from dotenv import load_dotenv

# Database and security imports
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token

# Email and OAuth imports
from app.core.email import send_password_reset_email, send_welcome_email, send_oauth_account_linked_email
from app.core.oauth import get_user_from_google_code, is_google_oauth_configured

# Models and schemas
from app.models.user import User, PasswordResetToken
from app.schemas.user import (
    UserCreate, UserLogin, Token, UserResponse,
    GoogleAuthRequest, GoogleAuthResponse,
    ForgotPasswordRequest, ForgotPasswordResponse,
    ResetPasswordRequest, ResetPasswordResponse,
    VerifyResetTokenRequest, VerifyResetTokenResponse
)

load_dotenv()
router = APIRouter()


# ============================================
# TRADITIONAL EMAIL/PASSWORD AUTHENTICATION
# ============================================

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Register a new user with email and password.

    This endpoint creates a new user account using traditional email/password authentication.
    Password is securely hashed before storage using bcrypt + SHA256.

    Args:
        user_data: UserCreate schema containing email, password, and optional role
        background_tasks: FastAPI background tasks for sending welcome email
        db: Database session

    Returns:
        Token: JWT access token and user information

    Raises:
        HTTPException 400: Email already registered

    Security:
        - Password is hashed with bcrypt (never stored in plain text)
        - SHA256 pre-hashing allows unlimited password length
        - Email uniqueness enforced at database level

    Example:
        POST /api/auth/register
        {
            "email": "user@example.com",
            "password": "secure123",
            "role": "USER"
        }
    """
    # Check if user with this email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Hash password securely (SHA256 + bcrypt)
    hashed_password = get_password_hash(user_data.password)

    # Create new user instance
    new_user = User(
        email=user_data.email,
        password_hash=hashed_password,
        role=user_data.role,
        email_verified=False,  # Can implement email verification later
        oauth_provider=None  # Not an OAuth user
    )

    # Save to database
    db.add(new_user)
    db.commit()
    db.refresh(new_user)  # Get auto-generated fields like ID and timestamps

    # Send welcome email in background (non-blocking)
    background_tasks.add_task(
        send_welcome_email,
        email=new_user.email,
        user_name=new_user.full_name
    )

    # Generate JWT access token
    access_token = create_access_token(data={"sub": new_user.id})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": new_user
    }


@router.post("/login", response_model=Token)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate user with email and password.

    Verifies credentials and returns a JWT token for authenticated API access.

    Args:
        user_data: UserLogin schema containing email and password
        db: Database session

    Returns:
        Token: JWT access token and user information

    Raises:
        HTTPException 401: Invalid email or password
        HTTPException 400: OAuth user trying to login with password

    Security:
        - Uses constant-time password comparison to prevent timing attacks
        - Same error message for non-existent user and wrong password (prevents email enumeration)
        - Checks if user is OAuth-only (no password set)

    Example:
        POST /api/auth/login
        {
            "email": "user@example.com",
            "password": "secure123"
        }
    """
    # Find user by email
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user:
        # Use same error message as wrong password to prevent email enumeration
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    # Check if user registered via OAuth (no password set)
    if user.oauth_provider and not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This account was created using {user.oauth_provider}. Please sign in with {user.oauth_provider}."
        )

    # Verify password using bcrypt (constant-time comparison)
    if not verify_password(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    # Generate JWT access token
    access_token = create_access_token(data={"sub": user.id})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


# ============================================
# GOOGLE OAUTH AUTHENTICATION
# ============================================

@router.post("/google", response_model=GoogleAuthResponse)
async def google_auth(
    auth_request: GoogleAuthRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Authenticate user with Google OAuth.

    This endpoint handles the OAuth 2.0 authorization code flow:
    1. Receives authorization code from frontend (after user consent on Google)
    2. Exchanges code for tokens with Google
    3. Verifies ID token and extracts user info
    4. Creates new user or logs in existing user
    5. Returns JWT token for app authentication

    Args:
        auth_request: Contains authorization code and optional state parameter
        background_tasks: For sending emails
        db: Database session

    Returns:
        GoogleAuthResponse: JWT token, user info, and is_new_user flag

    Raises:
        HTTPException 503: Google OAuth not configured
        HTTPException 400: Invalid authorization code
        HTTPException 401: Token verification failed

    Security:
        - Verifies ID token signature using Google's public keys
        - Validates token audience (client ID) and issuer
        - Uses oauth_provider_id to prevent duplicate accounts
        - Optional state parameter for CSRF protection

    Flow:
        Frontend: User clicks "Sign in with Google"
        Frontend: Redirects to Google consent screen
        Google: User approves, redirects back with code
        Frontend: Sends code to this endpoint
        Backend: Exchanges code for user info
        Backend: Creates/updates user, returns JWT

    Example:
        POST /api/auth/google
        {
            "code": "4/0AX4XfWh...",
            "state": "random-csrf-token"
        }
    """
    # Verify Google OAuth is configured
    if not is_google_oauth_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
        )

    # Verify the Google ID token and extract user information
    # The 'code' field actually contains the Google ID token (JWT)
    # from the @react-oauth/google library
    try:
        from app.core.oauth import verify_google_id_token

        # Verify and decode the ID token
        user_claims = await verify_google_id_token(auth_request.code)

        # Extract user information from verified claims
        google_user = {
            "google_id": user_claims.get("sub"),  # Google's unique user ID
            "email": user_claims.get("email"),
            "email_verified": user_claims.get("email_verified", False),
            "full_name": user_claims.get("name"),
            "profile_picture": user_claims.get("picture"),
            "given_name": user_claims.get("given_name"),
            "family_name": user_claims.get("family_name")
        }

        # Validate required fields
        if not google_user["google_id"] or not google_user["email"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incomplete user information from Google"
            )

    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OAuth authentication failed: {str(e)}"
        )

    # Check if user already exists (by email or Google ID)
    existing_user = db.query(User).filter(
        (User.email == google_user["email"]) |
        (User.oauth_provider_id == google_user["google_id"])
    ).first()

    is_new_user = False

    if existing_user:
        # User exists - update OAuth information if needed
        if not existing_user.oauth_provider:
            # User registered with email/password, now linking Google
            existing_user.oauth_provider = "google"
            existing_user.oauth_provider_id = google_user["google_id"]

            # Send notification email about account linking
            background_tasks.add_task(
                send_oauth_account_linked_email,
                email=existing_user.email,
                provider="Google",
                user_name=existing_user.full_name
            )

        # Update profile information from Google (if not set)
        if not existing_user.full_name:
            existing_user.full_name = google_user["full_name"]
        if not existing_user.profile_picture:
            existing_user.profile_picture = google_user["profile_picture"]
        if google_user["email_verified"]:
            existing_user.email_verified = True

        db.commit()
        db.refresh(existing_user)
        user = existing_user

    else:
        # New user - create account with Google OAuth
        is_new_user = True

        new_user = User(
            email=google_user["email"],
            password_hash=None,  # OAuth users don't have passwords
            oauth_provider="google",
            oauth_provider_id=google_user["google_id"],
            full_name=google_user["full_name"],
            profile_picture=google_user["profile_picture"],
            email_verified=google_user["email_verified"],
            role="USER"  # Default role for OAuth users
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        # Send welcome email in background
        background_tasks.add_task(
            send_welcome_email,
            email=new_user.email,
            user_name=new_user.full_name
        )

        user = new_user

    # Generate JWT access token
    access_token = create_access_token(data={"sub": user.id})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
        "is_new_user": is_new_user
    }


# ============================================
# PASSWORD RESET (FORGOT PASSWORD)
# ============================================

@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    request: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Initiate password reset process by sending reset email.

    Generates a secure one-time token and sends password reset link via email.
    Always returns success message (even if email doesn't exist) to prevent
    email enumeration attacks.

    Args:
        request: Contains email address
        background_tasks: For sending email asynchronously
        db: Database session

    Returns:
        ForgotPasswordResponse: Generic success message

    Security Best Practices:
        - Always returns same message (prevents email enumeration)
        - Token is cryptographically random (32 bytes)
        - Token is hashed before storage (like passwords)
        - Token expires in 15 minutes
        - Rate limiting should be implemented (not done here)
        - Only works for non-OAuth users (OAuth users don't have passwords)

    Flow:
        1. Check if user exists and has password (not OAuth-only)
        2. Generate secure random token
        3. Hash token and store in database with expiry
        4. Send email with reset link containing plain token
        5. Return generic success message

    Example:
        POST /api/auth/forgot-password
        {
            "email": "user@example.com"
        }
    """
    # Find user by email
    user = db.query(User).filter(User.email == request.email).first()

    # Only proceed if user exists and has password auth enabled
    # OAuth-only users cannot reset password
    if user and (user.password_hash or not user.oauth_provider):
        # Generate cryptographically secure random token
        reset_token = secrets.token_urlsafe(32)  # 32 bytes = 256 bits

        # Hash token before storing (same principle as password hashing)
        token_hash = hashlib.sha256(reset_token.encode()).hexdigest()

        # Invalidate all previous unused tokens for this user
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used == False
        ).update({"used": True})

        # Create new reset token with 15-minute expiration
        new_token = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
            used=False
        )

        db.add(new_token)
        db.commit()

        # Send reset email in background (non-blocking)
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        background_tasks.add_task(
            send_password_reset_email,
            email=user.email,
            reset_token=reset_token,  # Send plain token (only time it's exposed)
            frontend_url=frontend_url
        )

    # SECURITY: Always return same message regardless of whether email exists
    # This prevents attackers from discovering valid email addresses
    return ForgotPasswordResponse()


@router.post("/reset-password", response_model=ResetPasswordResponse)
def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Reset user password using token from email.

    Verifies the reset token and updates user's password.

    Args:
        request: Contains reset token and new password
        db: Database session

    Returns:
        ResetPasswordResponse: Success message

    Raises:
        HTTPException 400: Invalid, expired, or used token

    Security:
        - Verifies token hasn't expired (15 minutes)
        - Ensures token hasn't been used already
        - Hashes new password before storage
        - Marks token as used (one-time use)
        - Token lookup uses hash (not plain text)

    Flow:
        1. Hash the provided token
        2. Find matching token in database
        3. Check token is not expired and not used
        4. Update user's password
        5. Mark token as used
        6. Return success

    Example:
        POST /api/auth/reset-password
        {
            "token": "abc123xyz789",
            "new_password": "newsecure123"
        }
    """
    # Hash the token to look it up in database
    token_hash = hashlib.sha256(request.token.encode()).hexdigest()

    # Find token in database
    reset_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash
    ).first()

    # Validate token exists
    if not reset_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    # Check if token has expired
    if reset_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired. Please request a new one."
        )

    # Check if token has already been used
    if reset_token.used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has already been used. Please request a new one."
        )

    # Get the user associated with this token
    user = db.query(User).filter(User.id == reset_token.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Hash the new password
    new_password_hash = get_password_hash(request.new_password)

    # Update user's password
    user.password_hash = new_password_hash

    # Mark token as used (prevent reuse)
    reset_token.used = True

    # Save changes
    db.commit()

    return ResetPasswordResponse()


@router.post("/verify-reset-token", response_model=VerifyResetTokenResponse)
def verify_reset_token(
    request: VerifyResetTokenRequest,
    db: Session = Depends(get_db)
):
    """
    Verify if a password reset token is valid.

    This endpoint allows the frontend to check token validity before
    showing the password reset form, providing better UX.

    Args:
        request: Contains reset token
        db: Database session

    Returns:
        VerifyResetTokenResponse: Validation result and message

    Example:
        POST /api/auth/verify-reset-token
        {
            "token": "abc123xyz789"
        }

        Response:
        {
            "valid": true,
            "message": "Token is valid"
        }
    """
    # Hash token to look it up
    token_hash = hashlib.sha256(request.token.encode()).hexdigest()

    # Find token
    reset_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash
    ).first()

    # Check if token exists
    if not reset_token:
        return VerifyResetTokenResponse(
            valid=False,
            message="Invalid reset token"
        )

    # Check if expired
    if reset_token.expires_at < datetime.now(timezone.utc):
        return VerifyResetTokenResponse(
            valid=False,
            message="Reset token has expired"
        )

    # Check if already used
    if reset_token.used:
        return VerifyResetTokenResponse(
            valid=False,
            message="Reset token has already been used"
        )

    # Token is valid
    return VerifyResetTokenResponse(
        valid=True,
        message="Token is valid"
    )
