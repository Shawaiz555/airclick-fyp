'use client';

import { useState } from 'react';
import UserSidebar from '../components/UserSidebar';
import UserHeader from '../components/UserHeader';
import { MaintenanceProvider, useMaintenance } from '../context/MaintenanceContext';

function MaintenanceBanner() {
  const { isMaintenanceMode } = useMaintenance();
  if (!isMaintenanceMode) return null;

  return (
    <div className="lg:ml-64 sticky top-0 z-40 flex items-center gap-3 px-4 py-3
      bg-amber-500/95 backdrop-blur-sm border-b border-amber-400/60 shadow-lg shadow-amber-500/20">
      {/* Icon */}
      <span className="flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </span>
      {/* Text */}
      <p className="text-amber-900 font-semibold text-sm">
        System is under maintenance. Gesture controls are temporarily disabled. Please check back later.
      </p>
    </div>
  );
}

function UserLayoutInner({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 text-white">
      <UserSidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Maintenance banner sits above the header */}
      <MaintenanceBanner />

      <UserHeader />

      <main className="transition-all duration-300">
        {children}
      </main>
    </div>
  );
}

export default function ClientUserLayout({ children }) {
  return (
    <MaintenanceProvider>
      <UserLayoutInner>{children}</UserLayoutInner>
    </MaintenanceProvider>
  );
}
