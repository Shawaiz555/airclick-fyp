'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clearTokenForElectron, saveTokenForElectron } from '@/utils/tokenSync';

const AuthContext = createContext();

const isOAuthUser = (user) => {
    return user && user.oauth_provider && !user.password_hash;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in (from localStorage)
    const savedUser = localStorage.getItem('currentUser');
    const savedToken = localStorage.getItem('token');
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));

      // Sync token to file system for Electron overlay
      console.log('🔄 Syncing token to file system...');
      saveTokenForElectron(savedToken)
        .then(() => console.log('✅ Token synced successfully'))
        .catch(err => {
          console.error('❌ Failed to sync token on startup:', err);
          console.error('Error details:', err.message, err.stack);
        });
    }
    setLoading(false);
  }, []);

  const login = async (userData, token) => {
    setUser(userData);
    localStorage.setItem('currentUser', JSON.stringify(userData));
    localStorage.setItem('token', token);

    // Save token for Electron overlay
    console.log('🔄 Saving token for Electron overlay...');
    try {
      await saveTokenForElectron(token);
      console.log('✅ Token saved for Electron overlay');
    } catch (err) {
      console.error('❌ Failed to save token for Electron:', err);
      console.error('Error details:', err.message, err.stack);
    }

    // Redirect based on role
    if (userData.role === 'ADMIN') {
      router.push('/Admin/overview');
    } else if (userData.role === 'USER') {
      router.push('/User/home');
    }
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem('currentUser');

    // Clear token from both localStorage and Electron overlay
    await clearTokenForElectron();

    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return {
    ...context,
    isOAuthUser: isOAuthUser(context.user),
  };
}