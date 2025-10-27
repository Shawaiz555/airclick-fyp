import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientLayout from "./ClientLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Root metadata for the entire application
export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
  title: {
    template: '%s | AirClick',
    default: 'AirClick - Hand Gesture Control System',
  },
  description: 'Control your computer with hand gestures using AI-powered gesture recognition. AirClick enables touchless computer control with custom gestures and real-time tracking.',
  keywords: ['hand gesture control', 'AI gesture recognition', 'touchless control', 'hand tracking', 'gesture interface', 'computer control', 'accessibility', 'MediaPipe'],
  authors: [{ name: 'AirClick Team' }],
  creator: 'AirClick',
  publisher: 'AirClick',
  applicationName: 'AirClick',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'AirClick',
    title: 'AirClick - Hand Gesture Control System',
    description: 'Control your computer with hand gestures using AI-powered gesture recognition. AirClick enables touchless computer control with custom gestures and real-time tracking.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'AirClick - Hand Gesture Control System',
        type: 'image/jpeg',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AirClick - Hand Gesture Control System',
    description: 'Control your computer with hand gestures using AI-powered gesture recognition',
    images: ['/twitter-image.jpg'],
    creator: '@airclick',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' }, // SVG for modern browsers (scalable)
      { url: '/favicon.ico', sizes: 'any' }, // Fallback for older browsers
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'mask-icon', url: '/safari-pinned-tab.svg', color: '#a855f7' },
    ],
  },
  manifest: '/site.webmanifest',
};

// Viewport configuration (separate export required in Next.js 15)
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a2e' },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}