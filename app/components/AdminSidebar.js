'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Hand, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext'; // Make sure this path matches your project
import Image from 'next/image';

export default function AdminSidebar({ isOpen, onToggle }) {
  const [isMobile, setIsMobile] = useState(false);
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
      id: 'gestures',
      label: 'Gesture Profiles',
      href: '/Admin/gestures',
      icon: Hand
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
    if (pathname === '/Admin/gestures') return 'gestures';
    if (pathname === '/Admin/settings') return 'settings';
    return 'overview';
  };

  const activeTab = getActiveTab();

  const handleLogout = () => {
    if (confirm('Are you sure you want to log out?')) {
      logout();
    }
  };

  if (isMobile) {
    return (
      <div className="fixed top-2 right-4 z-50 w-full flex justify-end">
        <button
          onClick={onToggle}
          className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg hover:shadow-cyan-500/30 transition-all duration-300 transform hover:scale-105"
          aria-label="Toggle sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div
          aria-hidden={!isOpen}
          className={`fixed bg-gray-900/95 inset-0 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        >
          <nav className="relative p-0 h-full overflow-auto">
            <div className="p-6 border-b border-cyan-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center justify-center space-x-3">
                  <Image src="/assets/logos/airClickLogo.png" width={900} height={900} alt='Logo' className='w-36 h-36 rounded-full' />
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
              <button
                onClick={handleLogout}
                className="mt-4 w-full flex items-center space-x-3 px-4 py-2 font-bold rounded-lg bg-cyan-500 hover:bg-cyan-600 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span>Logout</span>
              </button>
            </div>
          </nav>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900/90 backdrop-blur-lg border-r overflow-y-auto thin-scrollbar border-cyan-500/20 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
      <div className="p-6 py-10 border-b border-cyan-500/20">
        <div className="flex items-center justify-center space-x-3">
          <Image src="/assets/logos/airClickLogo.png" width={900} height={900} alt='Logo' className='w-36 h-36 rounded-full' />
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
        <button
          onClick={handleLogout}
          className="mt-4 mx-2 w-auto flex items-center space-x-3 px-4 py-2 font-bold rounded-lg bg-cyan-500 hover:bg-cyan-600 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span>Logout</span>
        </button>
      </nav>
    </div>
  );
}