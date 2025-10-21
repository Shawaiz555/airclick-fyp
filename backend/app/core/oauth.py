"""
Google OAuth 2.0 Configuration Module

This module handles Google OAuth authentication using the Authorization Code Flow.
It provides functions to exchange authorization codes for user information and
verify ID tokens for secure authentication.

Security Features:
- ID token verification using Google's public keys
- State parameter for CSRF protection
- Secure token exchange over HTTPS
- Audience and issuer validation

References:
- https://developers.google.com/identity/protocols/oauth2
- https://developers.google.com/identity/protocols/oauth2/web-server
"""

from authlib.integrations.starlette_client import OAuth
import httpx
import os
from dotenv import load_dotenv
from typing import Dict, Optional
from fastapi import HTTPException, status

# Load environment variables
load_dotenv()


# ============================================
# GOOGLE OAUTH CONFIGURATION
# ============================================

# OAuth 2.0 client configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")

# Google OAuth endpoints
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"  # Public keys for token verification

# OAuth scopes - requesting minimal permissions (best practice)
GOOGLE_SCOPES = [
    "openid",  # OpenID Connect for authentication
    "email",   # User's email address
    "profile"  # Basic profile info (name, picture)
]


# ============================================
# OAUTH CLIENT INITIALIZATION
# ============================================

# Initialize OAuth client using Authlib
oauth = OAuth()

# Register Google as OAuth provider
oauth.register(
    name="google",
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={
        "scope": " ".join(GOOGLE_SCOPES)
    }
)


# ============================================
# GOOGLE OAUTH FUNCTIONS
# ============================================

async def exchange_code_for_tokens(authorization_code: str) -> Dict[str, any]:
    """
    Exchange authorization code for access token and ID token.

    This function implements Step 2 of the OAuth 2.0 Authorization Code Flow:
    1. User grants permission on Google's consent screen
    2. Google redirects with authorization code
    3. Backend exchanges code for tokens (THIS FUNCTION)
    4. Backend verifies tokens and extracts user info

    Args:
        authorization_code (str): Code received from Google after user consent

    Returns:
        Dict containing:
            - access_token: Token to access Google APIs
            - id_token: JWT containing user identity
            - token_type: "Bearer"
            - expires_in: Token lifetime in seconds
            - scope: Granted scopes
            - refresh_token: (optional) For offline access

    Raises:
        HTTPException: If code is invalid or exchange fails

    Security Notes:
        - Code can only be used once
        - Code expires after 10 minutes
        - Exchange must happen over HTTPS in production
        - Client secret must never be exposed to frontend

    Example:
        >>> tokens = await exchange_code_for_tokens("4/0AX4...")
        >>> print(tokens["id_token"])
        "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
    """
    try:
        # Prepare token exchange request
        token_data = {
            "code": authorization_code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code"
        }

        # Make async HTTP request to Google's token endpoint
        async with httpx.AsyncClient() as client:
            response = await client.post(
                GOOGLE_TOKEN_URL,
                data=token_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )

            # Check if token exchange was successful
            if response.status_code != 200:
                error_detail = response.json().get("error_description", "Token exchange failed")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to exchange authorization code: {error_detail}"
                )

            # Parse and return tokens
            tokens = response.json()
            return tokens

    except httpx.RequestError as e:
        # Network or connection error
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to connect to Google OAuth service: {str(e)}"
        )
    except Exception as e:
        # Unexpected error
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Token exchange error: {str(e)}"
        )


async def verify_google_id_token(id_token: str) -> Dict[str, any]:
    """
    Verify and decode Google ID token (JWT) using Google's tokeninfo endpoint.

    Google ID tokens are JSON Web Tokens (JWTs) that contain user information.
    This function verifies the token using Google's official tokeninfo API,
    which validates signature, expiration, and authenticity.

    Args:
        id_token (str): JWT string from Google Sign-In

    Returns:
        Dict containing verified user claims:
            - sub: Google user ID (unique identifier)
            - email: User's email address
            - email_verified: Whether email is verified (string "true"/"false")
            - name: Full name
            - picture: Profile picture URL
            - given_name: First name
            - family_name: Last name
            - iat: Issued at timestamp
            - exp: Expiration timestamp
            - aud: Audience (your client ID)
            - iss: Issuer (Google)

    Raises:
        HTTPException: If token is invalid, expired, or verification fails

    Security Checks Performed:
        1. Token verification by Google's official API
        2. Expiration time validation
        3. Audience validation (client ID match)
        4. Issuer validation (Google)

    Example:
        >>> user_info = await verify_google_id_token(id_token)
        >>> print(user_info["email"])
        "user@gmail.com"
        >>> print(user_info["sub"])
        "1234567890"
    """
    try:
        # Use Google's tokeninfo endpoint for verification
        # This is the recommended approach for server-side verification
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": id_token}
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired Google ID token"
                )

            token_info = response.json()

            # Verify the audience (client ID) matches our application
            if token_info.get("aud") != GOOGLE_CLIENT_ID:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token was not issued for this application"
                )

            # Verify the issuer is Google
            issuer = token_info.get("iss")
            if issuer not in ["https://accounts.google.com", "accounts.google.com"]:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token was not issued by Google"
                )

            # Convert email_verified from string to boolean
            if "email_verified" in token_info:
                token_info["email_verified"] = token_info["email_verified"] in ["true", True]

            return token_info

    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to verify token with Google: {str(e)}"
        )
    except Exception as e:
        # Unexpected error during verification
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Token verification error: {str(e)}"
        )


async def get_google_user_info(access_token: str) -> Dict[str, any]:
    """
    Fetch user profile information from Google using access token.

    This is an alternative to parsing the ID token. Use this when you need
    the most up-to-date user information or additional profile details.

    Args:
        access_token (str): OAuth access token from token exchange

    Returns:
        Dict containing user profile:
            - sub: Google user ID
            - email: Email address
            - email_verified: Email verification status
            - name: Full name
            - given_name: First name
            - family_name: Last name
            - picture: Profile picture URL
            - locale: User's locale (e.g., "en")

    Raises:
        HTTPException: If access token is invalid or API call fails

    Example:
        >>> user_info = await get_google_user_info(access_token)
        >>> print(user_info["name"])
        "John Doe"
    """
    try:
        # Call Google's UserInfo endpoint
        async with httpx.AsyncClient() as client:
            response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"}
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid access token or expired"
                )

            user_info = response.json()
            return user_info

    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to fetch user info from Google: {str(e)}"
        )


async def get_user_from_google_code(authorization_code: str) -> Dict[str, any]:
    """
    Complete OAuth flow: Exchange code for tokens and extract user info.

    This is a convenience function that combines token exchange and
    user info extraction in a single call. Use this as the main entry
    point for Google OAuth login.

    Args:
        authorization_code (str): Authorization code from Google consent screen

    Returns:
        Dict containing:
            - google_id: Unique Google user ID (use as oauth_provider_id)
            - email: User's email address
            - email_verified: Email verification status
            - full_name: Full name
            - profile_picture: Profile picture URL
            - given_name: First name (optional)
            - family_name: Last name (optional)

    Raises:
        HTTPException: If any step of OAuth flow fails

    Workflow:
        1. Exchange authorization code for tokens
        2. Verify ID token signature and claims
        3. Extract and return user information

    Example:
        >>> user_data = await get_user_from_google_code(code)
        >>> print(user_data["email"])
        "user@gmail.com"
        >>> print(user_data["google_id"])
        "1234567890"

    Usage in Auth Endpoint:
        @router.post("/google")
        async def google_login(code: str):
            user_data = await get_user_from_google_code(code)
            # Create or update user in database
            # Generate JWT token
            # Return to frontend
    """
    try:
        # Step 1: Exchange authorization code for tokens
        tokens = await exchange_code_for_tokens(authorization_code)

        # Step 2: Verify and decode ID token
        id_token = tokens.get("id_token")
        if not id_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No ID token received from Google"
            )

        user_claims = await verify_google_id_token(id_token)

        # Step 3: Extract relevant user information
        user_data = {
            "google_id": user_claims.get("sub"),  # Google's unique user ID
            "email": user_claims.get("email"),
            "email_verified": user_claims.get("email_verified", False),
            "full_name": user_claims.get("name"),
            "profile_picture": user_claims.get("picture"),
            "given_name": user_claims.get("given_name"),
            "family_name": user_claims.get("family_name")
        }

        # Validate required fields
        if not user_data["google_id"] or not user_data["email"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incomplete user information from Google"
            )

        return user_data

    except HTTPException:
        # Re-raise HTTP exceptions from child functions
        raise
    except Exception as e:
        # Catch any unexpected errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Google OAuth flow error: {str(e)}"
        )


# ============================================
# UTILITY FUNCTIONS
# ============================================

def is_google_oauth_configured() -> bool:
    """
    Check if Google OAuth is properly configured.

    Returns:
        bool: True if client ID and secret are set in environment

    Example:
        >>> if not is_google_oauth_configured():
        ...     raise Exception("Google OAuth not configured!")
    """
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)


def get_google_auth_url(state: str = None) -> str:
    """
    Generate Google OAuth authorization URL for frontend redirect.

    The frontend should redirect users to this URL to initiate OAuth flow.

    Args:
        state (str, optional): CSRF protection token (recommended)

    Returns:
        str: Full Google authorization URL

    Example:
        >>> url = get_google_auth_url(state="random-csrf-token")
        >>> print(url)
        "https://accounts.google.com/o/oauth2/v2/auth?client_id=..."

    Frontend Usage:
        window.location.href = authUrl;
    """
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(GOOGLE_SCOPES),
        "access_type": "online",  # Use "offline" if you need refresh tokens
        "prompt": "select_account"  # Always show account picker
    }

    if state:
        params["state"] = state  # CSRF protection

    # Build query string
    query_string = "&".join([f"{k}={v}" for k, v in params.items()])
    return f"https://accounts.google.com/o/oauth2/v2/auth?{query_string}"
