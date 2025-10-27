// Metadata for the User Settings page
export const metadata = {
  title: 'Settings',
  description: 'Manage your AirClick account settings - Update your profile, change password, configure gesture preferences, and customize application settings.',
  openGraph: {
    title: 'Settings - AirClick Dashboard',
    description: 'Manage your AirClick account settings and preferences',
    url: '/User/settings',
  },
  twitter: {
    title: 'Settings - AirClick Dashboard',
    description: 'Manage your AirClick account settings and preferences',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function UserSettingsLayout({ children }) {
  return children;
}
