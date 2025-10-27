// Metadata for the Admin Settings page
export const metadata = {
  title: 'Admin Settings',
  description: 'Configure AirClick platform settings - Manage system preferences, security settings, API configurations, and application parameters.',
  openGraph: {
    title: 'Admin Settings - AirClick Dashboard',
    description: 'Configure AirClick platform settings and preferences',
    url: '/Admin/settings',
  },
  twitter: {
    title: 'Admin Settings - AirClick Dashboard',
    description: 'Configure AirClick platform settings and preferences',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminSettingsLayout({ children }) {
  return children;
}
