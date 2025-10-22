/**
 * Reset Password Page - Themed to match AirClick design
 *
 * Allows users to set a new password using a reset token from email.
 * Features consistent gradient theme, glassmorphism, and smooth animations.
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

/**
 * Reset Password Form Component
 * Separated to use Suspense boundary for useSearchParams
 */
function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get token from URL query parameter
  const token = searchParams.get('token');

  // Form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [tokenError, setTokenError] = useState('');

  /**
   * Verify token on component mount
   */
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setTokenError('No reset token provided. Please check your email link.');
        setVerifying(false);
        return;
      }

      try {
        const response = await fetch('http://localhost:8000/api/auth/verify-reset-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (data.valid) {
          setTokenValid(true);
        } else {
          setTokenError(data.message || 'Invalid or expired reset token');
        }
      } catch (err) {
        console.error('Token verification error:', err);
        setTokenError('Unable to verify reset token. Please try again.');
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  /**
   * Validate password requirements
   */
  const validatePassword = (password) => {
    if (password.length < 6) {
      return { valid: false, message: 'Password must be at least 6 characters' };
    }
    return { valid: true, message: '' };
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate passwords match
      if (newPassword !== confirmPassword) {
        throw new Error('Passwords do not match');
      }

      // Validate password strength
      const validation = validatePassword(newPassword);
      if (!validation.valid) {
        throw new Error(validation.message);
      }

      // Send reset request to backend
      const response = await fetch('http://localhost:8000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to reset password');
      }

      // Success!
      toast.success('Password reset successful! Redirecting to login...', {
        duration: 3000,
      });
      console.log('✅ Password reset successful');

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login');
      }, 3000);

    } catch (err) {
      console.error('❌ Password reset error:', err);
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Loading state while verifying token
  if (verifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-4">
        <div className="bg-gray-800/30 backdrop-blur-lg rounded-2xl p-12 border border-cyan-500/20 shadow-2xl">
          <div className="flex flex-col items-center gap-4">
            <svg className="animate-spin h-12 w-12 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-purple-200 text-lg">Verifying reset link...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state if token is invalid
  if (tokenError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="text-center my-8">
            <h1 className="text-3xl lg:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-rose-400 to-red-500 mb-4">
              Invalid Reset Link
            </h1>
            <p className="text-purple-200">The password reset link is invalid or has expired</p>
          </div>

          <div className="bg-gray-800/30 backdrop-blur-lg rounded-2xl p-8 border border-rose-500/20 shadow-2xl">
            <div className="space-y-6">
              {/* Error Icon */}
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-gradient-to-br from-rose-400 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>

              {/* Error Message */}
              <div className="text-center">
                <p className="text-rose-300 mb-4">{tokenError}</p>
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-sm text-purple-200">
                  <p className="mb-2">This could happen if:</p>
                  <ul className="text-left space-y-1 ml-4">
                    <li>• The link has expired (links are valid for 15 minutes)</li>
                    <li>• The link has already been used</li>
                    <li>• The link was copied incorrectly</li>
                  </ul>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Link
                  href="/forgot-password"
                  className="flex-1 py-3 px-6 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-bold text-center hover:from-cyan-600 hover:to-blue-700 transition-all duration-300 shadow-lg"
                >
                  Request New Link
                </Link>
                <Link
                  href="/login"
                  className="flex-1 py-3 px-6 bg-gray-700/50 border border-cyan-500/30 rounded-xl font-bold text-center hover:bg-gray-700/70 transition-all duration-300"
                >
                  Back to Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Form state - show password reset form
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center my-8">
          <h1 className="text-3xl lg:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
            Reset Password
          </h1>
          <p className="text-purple-200">Enter your new password below</p>
        </div>

        <div className="bg-gray-800/30 backdrop-blur-lg rounded-2xl p-8 border border-cyan-500/20 shadow-2xl">
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-300 text-center flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6 py-6">
            {/* New Password Field */}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium mb-2 text-cyan-200">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                  required
                  disabled={loading}
                  minLength={6}
                  autoFocus
                  className="w-full bg-gray-700/50 border border-cyan-500/30 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-400 disabled:opacity-50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-cyan-400 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2 text-cyan-200">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  required
                  disabled={loading}
                  minLength={6}
                  className="w-full bg-gray-700/50 border border-cyan-500/30 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-400 disabled:opacity-50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-cyan-400 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="bg-gray-700/30 rounded-xl p-4 border border-purple-500/20">
              <p className="font-semibold text-purple-300 mb-3 text-sm">Password Requirements:</p>
              <ul className="space-y-2 text-sm">
                <li className={`flex items-center gap-2 ${newPassword.length >= 6 ? 'text-green-400' : 'text-gray-400'}`}>
                  {newPassword.length >= 6 ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  At least 6 characters
                </li>
                <li className={`flex items-center gap-2 ${newPassword && confirmPassword && newPassword === confirmPassword ? 'text-green-400' : 'text-gray-400'}`}>
                  {newPassword && confirmPassword && newPassword === confirmPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  Passwords match
                </li>
              </ul>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || newPassword !== confirmPassword || newPassword.length < 6}
              className="w-full py-3 px-6 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-bold text-lg hover:from-cyan-600 hover:to-blue-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Resetting Password...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  Reset Password
                </div>
              )}
            </button>
          </form>

          {/* Back to Login Link */}
          <div className="text-center mt-6">
            <Link href="/login" className="text-cyan-400 hover:text-cyan-300 text-sm transition-colors inline-flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Main Page Component with Suspense
 * Wraps the form in Suspense to handle useSearchParams
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center">
        <div className="text-purple-200 text-lg">Loading...</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
