"""
Email Service Module using FastAPI-Mail

This module handles all email sending functionality including:
- Password reset emails
- Welcome emails for new users
- Email verification (future enhancement)

Uses fastapi-mail for async SMTP operations with Gmail or other providers.
"""

from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from pydantic import EmailStr
from typing import List
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


# ============================================
# EMAIL CONFIGURATION
# ============================================

# Configure email connection settings from environment variables
# Supports Gmail, SendGrid, AWS SES, or any SMTP server
conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),  # Your email address
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),  # App password (not regular password!)
    MAIL_FROM=os.getenv("MAIL_FROM"),  # Sender email address
    MAIL_PORT=int(os.getenv("MAIL_PORT", 587)),  # SMTP port (587 for TLS, 465 for SSL)
    MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.gmail.com"),  # SMTP server
    MAIL_STARTTLS=True,  # Use TLS encryption
    MAIL_SSL_TLS=False,  # Don't use SSL (we use STARTTLS instead)
    USE_CREDENTIALS=True,  # Authenticate with username/password
    VALIDATE_CERTS=True  # Verify SSL certificates for security
)

# Initialize FastMail instance
fm = FastMail(conf)


# ============================================
# EMAIL SENDING FUNCTIONS
# ============================================

async def send_password_reset_email(
    email: EmailStr,
    reset_token: str,
    frontend_url: str
) -> bool:
    """
    Send password reset email with secure token link.

    This function creates and sends a professionally formatted HTML email
    containing a password reset link. The link includes a one-time token
    that expires in 15 minutes.

    Args:
        email (EmailStr): Recipient's email address (validated by Pydantic)
        reset_token (str): Secure random token for password reset
        frontend_url (str): Base URL of frontend application

    Returns:
        bool: True if email sent successfully, False otherwise

    Security Notes:
        - Token is only sent via email (never logged or stored in plain text)
        - Link expires after 15 minutes
        - Token can only be used once
        - Always use HTTPS in production for reset links

    Example:
        >>> await send_password_reset_email(
        ...     "user@example.com",
        ...     "abc123xyz789",
        ...     "https://airclick.app"
        ... )
        True
    """
    # Construct reset link with token as query parameter
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"

    # HTML email template with professional styling
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {{
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
            }}
            .container {{
                max-width: 600px;
                margin: 30px auto;
                background-color: #ffffff;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }}
            .header {{
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                text-align: center;
            }}
            .header h1 {{
                margin: 0;
                font-size: 28px;
            }}
            .content {{
                padding: 40px 30px;
            }}
            .button {{
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white !important;
                padding: 14px 32px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: bold;
                margin: 20px 0;
                transition: transform 0.2s;
            }}
            .button:hover {{
                transform: translateY(-2px);
            }}
            .link-box {{
                background-color: #f8f9fa;
                padding: 15px;
                border-radius: 6px;
                word-break: break-all;
                margin: 20px 0;
                border-left: 4px solid #667eea;
            }}
            .warning {{
                background-color: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
            }}
            .footer {{
                background-color: #f8f9fa;
                color: #666;
                font-size: 13px;
                padding: 20px 30px;
                text-align: center;
            }}
            .footer a {{
                color: #667eea;
                text-decoration: none;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔐 Password Reset Request</h1>
            </div>
            <div class="content">
                <p>Hello,</p>
                <p>We received a request to reset the password for your <strong>AirClick</strong> account.</p>
                <p>Click the button below to create a new password:</p>

                <div style="text-align: center;">
                    <a href="{reset_link}" class="button">Reset My Password</a>
                </div>

                <p>Or copy and paste this link into your browser:</p>
                <div class="link-box">
                    <a href="{reset_link}" style="color: #667eea;">{reset_link}</a>
                </div>

                <div class="warning">
                    <strong>⏱️ Important:</strong> This link will expire in <strong>15 minutes</strong> for your security.
                </div>

                <p><strong>Didn't request a password reset?</strong></p>
                <p>If you didn't make this request, you can safely ignore this email. Your password will remain unchanged.</p>
            </div>
            <div class="footer">
                <p><strong>AirClick</strong> - Hand Gesture Control System</p>
            </div>
        </div>
    </body>
    </html>
    """

    # Create message schema
    message = MessageSchema(
        subject="Reset Your AirClick Password",
        recipients=[email],  # List of recipient email addresses
        body=html_content,
        subtype="html"  # Send as HTML email
    )

    try:
        # Send email asynchronously
        await fm.send_message(message)
        print(f"✅ Password reset email sent successfully to {email}")
        return True
    except Exception as e:
        # Log error but don't expose details to caller (security)
        print(f"❌ Error sending email to {email}: {str(e)}")
        return False


async def send_welcome_email(
    email: EmailStr,
    user_name: str = None
) -> bool:
    """
    Send welcome email to newly registered users.

    Sends a friendly onboarding email when a user successfully creates
    an account (either via email/password or OAuth).

    Args:
        email (EmailStr): New user's email address
        user_name (str, optional): User's name for personalization

    Returns:
        bool: True if email sent successfully, False otherwise

    Example:
        >>> await send_welcome_email("newuser@example.com", "John Doe")
        True
    """
    # Personalize greeting based on whether we have user's name
    greeting = f"Hi {user_name}" if user_name else "Hello"

    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            body {{
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f4f4f4;
            }}
            .container {{
                max-width: 600px;
                margin: 30px auto;
                background-color: #ffffff;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }}
            .header {{
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 40px 30px;
                text-align: center;
            }}
            .content {{
                padding: 40px 30px;
            }}
            .feature-box {{
                background-color: #f8f9fa;
                padding: 20px;
                border-radius: 6px;
                margin: 15px 0;
                border-left: 4px solid #667eea;
            }}
            .footer {{
                background-color: #f8f9fa;
                padding: 20px;
                text-align: center;
                color: #666;
                font-size: 13px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎉 Welcome to AirClick!</h1>
            </div>
            <div class="content">
                <p>{greeting},</p>
                <p>Thank you for joining <strong>AirClick</strong> - the future of hands-free computer control!</p>

                <p>Your account has been created successfully. Here's what you can do now:</p>

                <div class="feature-box">
                    <strong>✋ Create Custom Gestures</strong><br>
                    Define your own hand gestures to control applications
                </div>

                <div class="feature-box">
                    <strong>⚙️ Configure Settings</strong><br>
                    Customize accessibility and gesture sensitivity
                </div>

                <div class="feature-box">
                    <strong>📊 Track Activity</strong><br>
                    Monitor your gesture usage and performance
                </div>

                <p>Ready to get started? Log in to your account and create your first gesture!</p>

                <p>If you have any questions or need assistance, feel free to reach out.</p>

                <p>Happy gesturing! 👋</p>
            </div>
            <div class="footer">
                <p><strong>AirClick Team</strong></p>
                <p>This is an automated email, please do not reply.</p>
            </div>
        </div>
    </body>
    </html>
    """

    message = MessageSchema(
        subject="Welcome to AirClick - Get Started!",
        recipients=[email],
        body=html_content,
        subtype="html"
    )

    try:
        await fm.send_message(message)
        print(f"✅ Welcome email sent to {email}")
        return True
    except Exception as e:
        print(f"❌ Error sending welcome email to {email}: {str(e)}")
        return False


async def send_oauth_account_linked_email(
    email: EmailStr,
    provider: str,
    user_name: str = None
) -> bool:
    """
    Send notification when OAuth account is linked.

    Informs users when they successfully sign in with a new OAuth provider
    for security awareness.

    Args:
        email (EmailStr): User's email address
        provider (str): OAuth provider name (e.g., "Google", "GitHub")
        user_name (str, optional): User's name

    Returns:
        bool: True if email sent successfully, False otherwise

    Example:
        >>> await send_oauth_account_linked_email(
        ...     "user@example.com",
        ...     "Google",
        ...     "John Doe"
        ... )
        True
    """
    greeting = f"Hi {user_name}" if user_name else "Hello"

    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            body {{
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
            }}
            .container {{
                max-width: 600px;
                margin: 30px auto;
                background-color: #ffffff;
                border-radius: 8px;
                padding: 30px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }}
            .info-box {{
                background-color: #e7f3ff;
                border-left: 4px solid #2196F3;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <h2>🔗 {provider} Account Connected</h2>
            <p>{greeting},</p>
            <p>Your AirClick account has been successfully linked with your <strong>{provider}</strong> account.</p>

            <div class="info-box">
                <strong>What this means:</strong><br>
                You can now sign in to AirClick using your {provider} account for faster and more secure access.
            </div>

            <p><strong>Didn't authorize this?</strong></p>
            <p>If you didn't link your {provider} account, please contact support immediately and change your password.</p>

            <p>Stay secure,<br>The AirClick Team</p>
        </div>
    </body>
    </html>
    """

    message = MessageSchema(
        subject=f"{provider} Account Linked - AirClick",
        recipients=[email],
        body=html_content,
        subtype="html"
    )

    try:
        await fm.send_message(message)
        print(f"✅ OAuth linked notification sent to {email}")
        return True
    except Exception as e:
        print(f"❌ Error sending OAuth notification to {email}: {str(e)}")
        return False


# ============================================
# UTILITY FUNCTIONS
# ============================================

def is_email_configured() -> bool:
    """
    Check if email service is properly configured.

    Returns:
        bool: True if all required environment variables are set

    Example:
        >>> if not is_email_configured():
        ...     print("Email service not configured!")
    """
    required_vars = ["MAIL_USERNAME", "MAIL_PASSWORD", "MAIL_FROM"]
    return all(os.getenv(var) for var in required_vars)
