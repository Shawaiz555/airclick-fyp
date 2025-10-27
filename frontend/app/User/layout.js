import ClientUserLayout from './ClientUserLayout';

// Metadata for the User section
export const metadata = {
  title: {
    template: '%s | AirClick Dashboard',
    default: 'Dashboard',
  },
  description: 'Your AirClick dashboard - Control your computer with hand gestures, create custom gestures, manage settings, and personalize your gesture control experience.',
  openGraph: {
    title: 'AirClick Dashboard',
    description: 'Control your computer with hand gestures and manage your settings',
    url: '/User',
  },
  twitter: {
    title: 'AirClick Dashboard',
    description: 'Control your computer with hand gestures and manage your settings',
  },
  robots: {
    index: false, // Don't index user dashboard pages
    follow: false,
  },
};

export default function UserLayout({ children }) {
  return <ClientUserLayout>{children}</ClientUserLayout>;
}