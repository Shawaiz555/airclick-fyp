'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import Link from 'next/link';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('USER');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      // Validation
      if (!name || !email || !password || !confirmPassword) {
        throw new Error('Please fill in all fields');
      }
      
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }
      
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock successful signup
      setSuccess('Account created successfully!');
      
      // Auto-login after signup
      setTimeout(() => {
        login({
          name,
          email,
          role,
          id: Date.now().toString()
        });
      }, 1500);
      
    } catch (err) {
      setError(err.message || 'Failed to create account');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center my-8">
          <h1 className="text-3xl lg:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500 mb-2">
            Create an Account
          </h1>
          <p className="text-purple-200">Join AirClick and start controlling your devices with gestures</p>
        </div>

        <div className="bg-gray-800/30 backdrop-blur-lg rounded-2xl p-8 border border-purple-500/20 shadow-2xl">
          {error && (
            <div className="mb-6 p-3 bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-300 text-center">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-6 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-300 text-center">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8 py-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2 text-purple-200">
                Full Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-700/50 border border-purple-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-400"
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2 text-purple-200">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-700/50 border border-purple-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-400"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2 text-purple-200">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-700/50 border border-purple-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-400"
                placeholder="••••••••"
                required
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2 text-purple-200">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-gray-700/50 border border-purple-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-400"
                placeholder="••••••••"
                required
              />
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium mb-2 text-purple-200">
                Account Type
              </label>
              <div className="space-y-3">
                <label className="flex items-center p-4 bg-gray-700/30 rounded-xl border border-purple-500/20 hover:border-purple-500/40 cursor-pointer transition-all">
                  <input
                    type="radio"
                    name="role"
                    value="USER"
                    checked={role === 'USER'}
                    onChange={() => setRole('USER')}
                    className="mr-3 h-5 w-5 text-purple-500"
                  />
                  <div>
                    <p className="font-medium text-purple-200">User Account</p>
                    <p className="text-sm text-gray-400">Control your devices with gestures</p>
                  </div>
                </label>
                
                <label className="flex items-center p-4 bg-gray-700/30 rounded-xl border border-purple-500/20 hover:border-purple-500/40 cursor-pointer transition-all">
                  <input
                    type="radio"
                    name="role"
                    value="ADMIN"
                    checked={role === 'ADMIN'}
                    onChange={() => setRole('ADMIN')}
                    className="mr-3 h-5 w-5 text-purple-500"
                  />
                  <div>
                    <p className="font-medium text-purple-200">Admin Account</p>
                    <p className="text-sm text-gray-400">Manage users and system settings</p>
                  </div>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || success}
              className="w-full py-2 px-6 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl font-bold text-lg hover:from-purple-600 hover:to-pink-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-50 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Account...
                </>
              ) : success ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Account Created!
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Account
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-400">
              Already have an account?{' '}
              <Link href="/login" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}