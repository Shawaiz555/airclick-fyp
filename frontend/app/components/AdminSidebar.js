'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext'; // Make sure this path matches your project
import Image from 'next/image';
import toast from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';

export default function AdminSidebar({ isOpen, onToggle }) {
  const [isMobile, setIsMobile] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const pathname = usePathname();
  const { logout } = useAuth();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const navItems = [
    {
      id: 'overview',
      label: 'Overview',
      href: '/Admin/overview',
      icon: Home
    },
    {
      id: 'users',
      label: 'User Management',
      href: '/Admin/users',
      icon: Users
    },
    {
      id: 'action-mappings',
      label: 'Action Mappings',
      href: '/Admin/action-mappings',
      icon: ({className}) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    },
    {
      id: 'settings',
      label: 'Settings',
      href: '/Admin/settings',
      icon: Settings
    }
  ];

  const getActiveTab = () => {
    if (pathname === '/Admin/overview') return 'overview';
    if (pathname === '/Admin/users') return 'users';
    if (pathname === '/Admin/action-mappings') return 'action-mappings';
    if (pathname === '/Admin/settings') return 'settings';
    return 'overview';
  };

  const activeTab = getActiveTab();

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };

  if (isMobile) {
    return (
      <>
        <div className="fixed top-4 right-4 z-50">
          <button
            onClick={onToggle}
            className="group relative p-3 rounded-2xl bg-gray-800/30 backdrop-blur-lg border border-cyan-500/30 shadow-xl hover:shadow-cyan-500/50 transition-all duration-300 transform hover:scale-105 hover:border-cyan-500/50"
            aria-label="Toggle sidebar"
          >
            {/* Animated Gradient Background */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

            {/* Menu Icon with Animation */}
            <div className="relative z-10 flex flex-col gap-1.5">
              <span className={`block h-0.5 w-6 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-300 ${isOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
              <span className={`block h-0.5 w-6 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-300 ${isOpen ? 'opacity-0' : ''}`}></span>
              <span className={`block h-0.5 w-6 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-300 ${isOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
            </div>

            {/* Glow Effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-300"></div>
          </button>

          <div
            aria-hidden={!isOpen}
            className={`fixed bg-gray-900/95 inset-0 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          >
            <nav className="relative p-0 h-full overflow-auto">
              <div className="p-4 border-b border-cyan-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center justify-center space-x-2">
                    <Image src="/assets/logos/airClickLogo.png" width={900} height={900} alt='Logo' className='w-40 h-42 rounded-full' />
                  </div>

                  <button
                    onClick={onToggle}
                    aria-label="Close sidebar"
                    className="ml-4 p-2 rounded-md text-cyan-500"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 8.586l4.95-4.95a1 1 0 111.414 1.414L11.414 10l4.95 4.95a1 1 0 11-1.414 1.414L10 11.414l-4.95 4.95a1 1 0 11-1.414-1.414L8.586 10 3.636 5.05A1 1 0 015.05 3.636L10 8.586z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 flex flex-col h-full">
                <ul className="space-y-2 flex-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-300 ${isActive ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white' : 'hover:bg-gray-800/50'}`}
                          onClick={() => {
                            if (isMobile) {
                              onToggle();
                            }
                          }}
                        >
                          <Icon className={isActive ? 'h-5 w-5 text-white' : 'h-5 w-5 text-cyan-500'} />
                          <span className={isActive ? 'text-white' : 'text-cyan-200'}>{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>

                {/* Logout Button - Mobile */}
                <div className='w-full flex justify-center'>
                  <div className='w-[80%] flex justify-center lg:w-[60%]'>
                    <button
                      onClick={handleLogout}
                      className="mt-4 w-auto hover:cursor-pointer flex items-center space-x-3 px-8 py-2 font-bold rounded-lg bg-cyan-500 hover:bg-cyan-600 transition-colors"
                    >
                      <LogOut className="h-5 w-5" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              </div>
            </nav>
          </div>
        </div>
        <ConfirmModal
          isOpen={showLogoutConfirm}
          onClose={() => setShowLogoutConfirm(false)}
          onConfirm={confirmLogout}
          title="Confirm Logout"
          message="Are you sure you want to log out?"
          confirmText="Logout"
          cancelText="Cancel"
        />
      </>
    );
  }

  return (
    <>
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900/90 backdrop-blur-lg border-r overflow-y-auto thin-scrollbar border-cyan-500/20 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="p-4 py-10 border-b border-cyan-500/20">
          <div className="flex items-center justify-center space-x-3">
            <Image src="/assets/logos/airClickLogo.png" width={900} height={900} alt='Logo' className='w-40 h-42 rounded-full' />
          </div>
        </div>

        <nav className="p-2 py-8 flex flex-col h-full">
          <ul className="space-y-2 flex-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-300 ${isActive ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30' : 'hover:bg-gray-800/50'}`}
                    onClick={() => {
                      if (isMobile) {
                        onToggle();
                      }
                    }}
                  >
                    <Icon className="h-5 w-5 text-current" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Logout Button - Desktop */}
          <div className='w-full flex justify-center'>
            <div className='w-[80%] flex justify-center lg:w-[60%]'>
              <button
                onClick={handleLogout}
                className="mt-4 w-auto hover:cursor-pointer flex items-center space-x-3 px-8 py-2 font-bold rounded-lg bg-cyan-500 hover:bg-cyan-600 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </nav>
      </div>
      <ConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={confirmLogout}
        title="Confirm Logout"
        message="Are you sure you want to log out?"
        confirmText="Logout"
        cancelText="Cancel"
      />
    </>
  );
}