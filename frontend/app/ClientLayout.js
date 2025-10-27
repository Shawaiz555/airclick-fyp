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
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'linear-gradient(135deg, var(--surface-dark) 0%, var(--surface-darker) 100%)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-accent)',
              borderRadius: '12px',
              padding: '16px 24px',
              fontSize: '15px',
              fontWeight: '500',
              boxShadow: '0 10px 40px var(--shadow-dark), 0 0 20px var(--shadow-cyan)',
              backdropFilter: 'blur(10px)',
              minWidth: '340px',
              maxWidth: '500px',
            },
            success: {
              iconTheme: {
                primary: 'var(--success)',
                secondary: 'var(--text-primary)',
              },
              style: {
                border: '1px solid rgba(16, 185, 129, 0.4)',
                boxShadow: '0 10px 40px var(--shadow-dark), 0 0 20px rgba(16, 185, 129, 0.2)',
              },
            },
            error: {
              iconTheme: {
                primary: 'var(--error)',
                secondary: 'var(--text-primary)',
              },
              style: {
                border: '1px solid rgba(239, 68, 68, 0.4)',
                boxShadow: '0 10px 40px var(--shadow-dark), 0 0 20px rgba(239, 68, 68, 0.2)',
              },
            },
            loading: {
              iconTheme: {
                primary: 'var(--info)',
                secondary: 'var(--text-primary)',
              },
              style: {
                border: '1px solid var(--border-accent)',
                boxShadow: '0 10px 40px var(--shadow-dark), 0 0 20px var(--shadow-blue)',
              },
            },
          }}
        />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
