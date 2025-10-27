// Metadata for the Admin Users Management page
export const metadata = {
  title: 'User Management',
  description: 'Manage AirClick users - View all registered users, update user roles and permissions, suspend or activate accounts, and monitor user activity.',
  openGraph: {
    title: 'User Management - Admin Dashboard',
    description: 'Manage AirClick users, roles, and permissions',
    url: '/Admin/users',
  },
  twitter: {
    title: 'User Management - Admin Dashboard',
    description: 'Manage AirClick users, roles, and permissions',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function UsersLayout({ children }) {
  return children;
}
