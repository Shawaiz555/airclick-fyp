'use client';

import { useState, useEffect, useRef } from 'react';
import { User, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from './ConfirmModal';
import toast from 'react-hot-toast';

export default function UserHeader() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const { logout } = useAuth();
  const dropdownRef = useRef(null);

  useEffect(() => {
    // Get user data from localStorage
    const user = localStorage.getItem('currentUser');
    if (user) {
      try {
        setCurrentUser(JSON.parse(user));
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }

    // Add event listener when dropdown is open
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    // Cleanup event listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully!');
    setShowLogoutModal(false);
  };

  if (!currentUser) {
    return null; // Don't render header if no user data
  }

  return (
    <>
      <div className="lg:ml-64 bg-transparent backdrop-blur-md border-b border-cyan-500/20 sticky top-0 z-30">
        <div className="px-4 md:px-6 py-2 flex justify-end items-center">
          <div className="relative" ref={dropdownRef}>
            {/* User Info Button */}
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-4 px-12 py-3 hover:cursor-pointer rounded-lg border border-cyan-500/30 transition-all duration-200 hover:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              {/* User Icon */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>

              {/* User Email - Hidden on mobile */}
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-md font-medium text-white">
                  {currentUser.full_name || 'User'}
                </span>
                <span className="text-sm text-cyan-300">
                  {currentUser.email}
                </span>
              </div>

              {/* Dropdown Arrow */}
              <svg
                className={`w-4 h-4 text-cyan-300 transition-transform duration-200 hover:cursor-pointer ${showDropdown ? 'rotate-180 hover:cursor-pointer' : ''
                  }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-73 bg-gray-800/95 backdrop-blur-lg rounded-lg border border-cyan-500/30 shadow-2xl z-20">
                  {/* User Info Section */}
                  <div className="px-4 py-3 border-b border-cyan-500/20">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center">
                        <User className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {currentUser.full_name || 'User'}
                        </p>
                        <p className="text-xs text-cyan-300 truncate">
                          {currentUser.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">Role:</span>
                      <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded">
                        {currentUser.role || 'USER'}
                      </span>
                    </div>
                  </div>

                {/* Logout Button */}
                <div className='w-full flex justify-center'>
                  <div className='w-[80%] flex justify-center py-3 lg:w-[60%]'>
                    <button
                      onClick={handleLogout}
                      className="w-auto hover:cursor-pointer flex items-center space-x-3 px-8 py-2 font-bold rounded-lg bg-cyan-500 hover:bg-cyan-600 transition-colors"
                    >
                      <LogOut className="h-5 w-5" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        title="Confirm Logout"
        message="Are you sure you want to logout?"
        confirmText="Logout"
        cancelText="Cancel"
      />
    </>
  );
}
