import ClientAdminLayout from './ClientAdminLayout';

// Metadata for the Admin section
export const metadata = {
  title: {
    template: '%s | Admin Dashboard - AirClick',
    default: 'Admin Dashboard',
  },
  description: 'Administer AirClick platform - manage users, configure gesture mappings, monitor system performance, and customize application settings.',
  openGraph: {
    title: 'Admin Dashboard - AirClick',
    description: 'Administer AirClick platform - manage users and system settings',
    url: '/Admin',
  },
  twitter: {
    title: 'Admin Dashboard - AirClick',
    description: 'Administer AirClick platform - manage users and system settings',
  },
  robots: {
    index: false, // Don't index admin pages
    follow: false,
  },
};

export default function AdminLayout({ children }) {
  return <ClientAdminLayout>{children}</ClientAdminLayout>;
}
