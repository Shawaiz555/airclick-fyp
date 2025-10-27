// Root metadata configuration for the application
export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
  title: {
    template: '%s | AirClick',
    default: 'AirClick - Hand Gesture Control System',
  },
  description: 'Control your computer with hand gestures using AI-powered gesture recognition. AirClick enables touchless computer control with custom gestures and real-time tracking.',
  keywords: ['hand gesture control', 'AI gesture recognition', 'touchless control', 'hand tracking', 'gesture interface', 'computer control', 'accessibility'],
  authors: [{ name: 'AirClick Team' }],
  creator: 'AirClick',
  publisher: 'AirClick',
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
  verification: {
    // Add your verification codes here when available
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
    // bing: 'your-bing-verification-code',
  },
};
