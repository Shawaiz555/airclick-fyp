"""
Email Configuration Diagnostic Tool

Run this script to check if your email configuration is correct.
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def check_email_config():
    """Check email configuration and print diagnostics"""

    print("=" * 60)
    print("EMAIL CONFIGURATION DIAGNOSTIC")
    print("=" * 60)
    print()

    # Check if variables are set
    username = os.getenv('MAIL_USERNAME')
    password = os.getenv('MAIL_PASSWORD')
    mail_from = os.getenv('MAIL_FROM')
    server = os.getenv('MAIL_SERVER')
    port = os.getenv('MAIL_PORT')

    # Print configuration
    print("Configuration Status:")
    print("-" * 60)
    print(f"MAIL_USERNAME: {username or '❌ NOT SET'}")
    print(f"MAIL_FROM:     {mail_from or '❌ NOT SET'}")
    print(f"MAIL_SERVER:   {server or '❌ NOT SET'}")
    print(f"MAIL_PORT:     {port or '❌ NOT SET'}")
    print()

    # Check password
    if password:
        pwd_len = len(password)
        has_spaces = ' ' in password

        print("Password Status:")
        print("-" * 60)
        print(f"Password length: {pwd_len} characters")
        print(f"Expected length: 16 characters (Gmail App Password)")
        print(f"Has spaces: {'❌ YES (REMOVE THEM!)' if has_spaces else '✅ NO'}")
        print(f"First 4 chars: {password[:4]}****")
        print(f"Last 4 chars:  ****{password[-4:]}")

        if pwd_len != 16:
            print()
            print("⚠️  WARNING: Password should be exactly 16 characters!")
            print("   Gmail App Passwords are always 16 characters.")
            print()

        if has_spaces:
            print()
            print("❌ ERROR: Password contains spaces!")
            print("   Remove all spaces from MAIL_PASSWORD in .env file")
            print(f"   Current: '{password}'")
            print(f"   Should be: '{password.replace(' ', '')}'")
            print()
    else:
        print("❌ MAIL_PASSWORD: NOT SET")
        print()

    # Overall status
    print("=" * 60)

    if all([username, password, mail_from, server, port]):
        if password and len(password) == 16 and ' ' not in password:
            print("✅ Email configuration looks correct!")
            print()
            print("Next steps:")
            print("1. Make sure 2-Step Verification is enabled on Gmail")
            print("2. Restart the backend server")
            print("3. Test by running: python test_email_send.py")
        else:
            print("⚠️  Email configuration needs fixes (see warnings above)")
    else:
        print("❌ Email configuration is incomplete!")
        print()
        print("Required in .env file:")
        print("  MAIL_USERNAME=your-email@gmail.com")
        print("  MAIL_PASSWORD=16-char-app-password-no-spaces")
        print("  MAIL_FROM=your-email@gmail.com")
        print("  MAIL_SERVER=smtp.gmail.com")
        print("  MAIL_PORT=587")

    print("=" * 60)
    print()

    # Additional checks
    if username and mail_from and username != mail_from:
        print("⚠️  Note: MAIL_USERNAME and MAIL_FROM are different")
        print(f"   This is usually fine, but make sure it's intentional")
        print()

    # Check if using Gmail
    if username and 'gmail.com' in username:
        print("📧 Gmail detected!")
        print()
        print("Required Gmail Setup:")
        print("1. Enable 2-Step Verification:")
        print("   https://myaccount.google.com/security")
        print()
        print("2. Generate App Password:")
        print("   https://myaccount.google.com/apppasswords")
        print("   - Select app: Mail")
        print("   - Select device: Other (Custom name)")
        print("   - Name it: AirClick Backend")
        print("   - Copy the 16-char password (remove spaces!)")
        print()

if __name__ == "__main__":
    check_email_config()
