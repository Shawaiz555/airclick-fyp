'use client';

import { useState } from 'react';
import UserSidebar from '../components/UserSidebar';

export default function ClientUserLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 text-white">
      {/* Render Sidebar */}
      <UserSidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* Mobile Overlay - Click to close sidebar */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content - Shifted right when sidebar is open */}
      <main className={`transition-all duration-300 p-4 md:p-2`}>
        {children}
      </main>
    </div>
  );
}
