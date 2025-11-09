'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clearTokenForElectron } from '@/utils/tokenSync';

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
    }
    setLoading(false);
  }, []);

  const login = (userData, token) => {
    setUser(userData);
    localStorage.setItem('currentUser', JSON.stringify(userData));
    localStorage.setItem('token', token);

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