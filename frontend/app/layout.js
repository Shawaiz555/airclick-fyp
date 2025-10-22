'use client';

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from 'react-hot-toast';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <GoogleOAuthProvider clientId={googleClientId}>
          <AuthProvider>
            {children}
            <Toaster
              position="top-center"
              toastOptions={{
                duration: 3000,
                style: {
                  background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
                  color: '#fff',
                  border: '1px solid rgba(34, 211, 238, 0.4)',
                  borderRadius: '12px',
                  padding: '16px 24px',
                  fontSize: '15px',
                  fontWeight: '500',
                  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3), 0 0 20px rgba(34, 211, 238, 0.1)',
                  backdropFilter: 'blur(10px)',
                  minWidth: '340px',
                  maxWidth: '500px',
                },
                success: {
                  iconTheme: {
                    primary: '#10b981',
                    secondary: '#fff',
                  },
                  style: {
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3), 0 0 20px rgba(16, 185, 129, 0.2)',
                  },
                },
                error: {
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                  style: {
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3), 0 0 20px rgba(239, 68, 68, 0.2)',
                  },
                },
                loading: {
                  iconTheme: {
                    primary: '#3b82f6',
                    secondary: '#fff',
                  },
                  style: {
                    border: '1px solid rgba(59, 130, 246, 0.4)',
                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3), 0 0 20px rgba(59, 130, 246, 0.2)',
                  },
                },
              }}
            />
          </AuthProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}