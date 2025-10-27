// Metadata for the Admin Action Mappings page
export const metadata = {
  title: 'Action Mappings',
  description: 'Manage keyboard action mappings - Configure keyboard shortcuts, define gesture-to-action mappings, and customize system-wide gesture controls.',
  openGraph: {
    title: 'Action Mappings - Admin Dashboard',
    description: 'Manage keyboard action mappings and gesture controls',
    url: '/Admin/action-mappings',
  },
  twitter: {
    title: 'Action Mappings - Admin Dashboard',
    description: 'Manage keyboard action mappings and gesture controls',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function ActionMappingsLayout({ children }) {
  return children;
}
