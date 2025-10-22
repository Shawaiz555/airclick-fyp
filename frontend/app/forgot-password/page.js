/**
 * Forgot Password Page - Themed to match AirClick design
 *
 * Allows users to request a password reset email with a secure token.
 * Features consistent gradient theme, glassmorphism, and smooth animations.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const router = useRouter();

  // Form state
  const [email, setEmail] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /**
   * Handle form submission
   * Sends password reset request to backend API
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate email format (client-side)
      if (!email || !email.includes('@')) {
        throw new Error('Please enter a valid email address');
      }

      // Send reset request to backend
      const response = await fetch('http://localhost:8000/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to send reset email');
      }

      // Show success message
      toast.success(`Password reset email sent to ${email}. Please check your inbox (and spam folder).`, {
        duration: 6000,
      });
      console.log('✅ Password reset email sent to:', email);

      // Reset form
      setEmail('');

    } catch (err) {
      console.error('❌ Forgot password error:', err);
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center my-8">
          <h1 className="text-3xl lg:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 mb-4">
            Forgot Password
          </h1>
          <p className="text-purple-200">
            Enter your email to receive a password reset link
          </p>
        </div>

        <div className="bg-gray-800/30 backdrop-blur-lg rounded-2xl p-8 border border-cyan-500/20 shadow-2xl">
          <div>
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
                {/* Email Input */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2 text-cyan-200">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    disabled={loading}
                    autoFocus
                    className="w-full bg-gray-700/50 border border-cyan-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-6 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-bold text-lg hover:from-cyan-600 hover:to-blue-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending Reset Link...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send Reset Link
                    </div>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-gray-800/30 text-gray-400">OR</span>
                </div>
              </div>

              {/* Back to Login Link */}
              <div className="text-center">
                <p className="text-gray-400">
                  Remember your password?{' '}
                  <Link href="/login" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                    Back to Login
                  </Link>
                </p>
              </div>

              {/* Security Note */}
              <div className="mt-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <div className="text-sm text-purple-200">
                    <p className="font-semibold text-yellow-300 mb-1">Security Note</p>
                    <p>For your protection, we dont reveal whether an email address is registered in our system.</p>
                  </div>
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
