/**
 * Google Sign-In Button Component
 *
 * This component provides a "Sign in with Google" button that integrates with
 * Google OAuth 2.0 for user authentication. It handles the OAuth flow and
 * communicates with the backend to create or login users.
 *
 * Features:
 * - One-click Google authentication
 * - Automatic account creation for new users
 * - Seamless login for existing users
 * - Error handling and loading states
 * - Mobile-responsive design
 *
 * Usage:
 *   <GoogleSignInButton onSuccess={handleSuccess} onError={handleError} />
 */

'use client';

import { GoogleLogin } from '@react-oauth/google';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import toast from 'react-hot-toast';

/**
 * GoogleSignInButton Component
 *
 * Renders a Google OAuth button and handles the authentication flow.
 *
 * @param {Object} props - Component props
 * @param {Function} props.onSuccess - Optional callback when login succeeds
 * @param {Function} props.onError - Optional callback when login fails
 * @param {string} props.text - Button text ("signin_with" or "signup_with")
 *
 * @returns {JSX.Element} Google Sign-In button
 */
export default function GoogleSignInButton({
  onSuccess,
  onError,
  text = "signin_with"  // "signin_with" or "signup_with"
}) {
  const router = useRouter();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Handle successful Google OAuth response
   *
   * This function is called when the user successfully authenticates with Google.
   * It receives a credential (JWT token) from Google and sends it to the backend
   * for verification and user creation/login.
   *
   * Flow:
   * 1. User clicks Google button
   * 2. Google popup opens
   * 3. User selects account and approves
   * 4. Google returns credential (JWT)
   * 5. Send credential to backend
   * 6. Backend verifies with Google
   * 7. Backend creates/logs in user
   * 8. Frontend receives JWT token
   * 9. Save to localStorage and redirect
   *
   * @param {Object} credentialResponse - Response from Google containing credential
   */
  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError(null);

    try {
      // credentialResponse.credential is the Google ID token (JWT)
      const { credential } = credentialResponse;

      // Send the Google credential to our backend for verification
      const response = await fetch('http://localhost:8000/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: credential,  // Google ID token
        }),
      });

      // Parse response
      const data = await response.json();

      // Check if authentication was successful
      if (!response.ok) {
        throw new Error(data.detail || 'Google authentication failed');
      }

      // Extract user data and JWT token
      const { access_token, user, is_new_user } = data;

      // Save authentication state using AuthContext
      // AuthContext login expects: login(userData, token)
      login(user, access_token);

      // Log success
      console.log('✅ Google sign-in successful:', {
        email: user.email,
        isNewUser: is_new_user,
      });

      // Call success callback if provided
      if (onSuccess) {
        onSuccess({ user, is_new_user });
      }

      // Redirect based on user role
      if (user.role === 'ADMIN') {
        router.push('/Admin/overview');
      } else {
        router.push('/User/home');
      }

    } catch (err) {
      // Handle errors
      console.error('❌ Google sign-in error:', err);
      const errorMessage = err.message || 'Failed to sign in with Google';
      setError(errorMessage);

      // Call error callback if provided
      if (onError) {
        onError(err);
      }

      // Show error to user
      toast.error(`Google Sign-In Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle Google OAuth errors
   *
   * Called when the OAuth flow fails (user closes popup, network error, etc.)
   *
   * @param {Object} error - Error object from Google OAuth
   */
  const handleGoogleError = (error) => {
    console.error('❌ Google OAuth error:', error);
    setError('Failed to sign in with Google. Please try again.');

    if (onError) {
      onError(error);
    }
  };

  return (
    <div className="google-signin-container">
      {/* Google OAuth Button */}
      <div className="google-button-wrapper">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          text={text}  // "signin_with" or "signup_with"
          theme="outline"  // "outline", "filled_blue", or "filled_black"
          size="large"  // "large", "medium", or "small"
          width="100%"
          logo_alignment="left"
          disabled={loading}
        />
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="loading-message">
          <p>Signing in with Google...</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {/* Styles */}
      <style jsx>{`
        .google-signin-container {
          width: 100%;
          margin: 10px 0;
        }

        .google-button-wrapper {
          display: flex;
          justify-content: center;
          width: 100%;
        }

        .loading-message {
          margin-top: 10px;
          text-align: center;
          color: #666;
          font-size: 14px;
        }

        .error-message {
          margin-top: 10px;
          padding: 10px;
          background-color: #fee;
          border: 1px solid #fcc;
          border-radius: 4px;
          color: #c00;
          font-size: 14px;
          text-align: center;
        }

        /* Responsive design */
        @media (max-width: 480px) {
          .google-button-wrapper {
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  );
}
