'use client';

import { AuthProvider } from "./context/AuthContext";
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from 'react-hot-toast';

export default function ClientLayout({ children }) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.95) 0%, rgba(168, 85, 247, 0.95) 100%)',
              color: '#ffffff',
              border: '1px solid rgba(168, 85, 247, 0.5)',
              borderRadius: '12px',
              padding: '16px 24px',
              fontSize: '15px',
              fontWeight: '500',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(168, 85, 247, 0.3)',
              backdropFilter: 'blur(12px)',
              minWidth: '340px',
              maxWidth: '500px',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#ffffff',
              },
              style: {
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(5, 150, 105, 0.95) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.6)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(16, 185, 129, 0.4)',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#ffffff',
              },
              style: {
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(220, 38, 38, 0.95) 100%)',
                border: '1px solid rgba(239, 68, 68, 0.6)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(239, 68, 68, 0.4)',
              },
            },
            loading: {
              iconTheme: {
                primary: '#06b6d4',
                secondary: '#ffffff',
              },
              style: {
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.95) 0%, rgba(8, 145, 178, 0.95) 100%)',
                border: '1px solid rgba(6, 182, 212, 0.6)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(6, 182, 212, 0.4)',
              },
            },
          }}
        />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
