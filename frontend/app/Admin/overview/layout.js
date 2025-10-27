// Metadata for the Admin Overview page
export const metadata = {
  title: 'Overview',
  description: 'Admin dashboard overview - View system statistics, monitor platform usage, track user activity, and analyze gesture recognition performance metrics.',
  openGraph: {
    title: 'Admin Overview - AirClick Dashboard',
    description: 'View system statistics and monitor platform usage',
    url: '/Admin/overview',
  },
  twitter: {
    title: 'Admin Overview - AirClick Dashboard',
    description: 'View system statistics and monitor platform usage',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function OverviewLayout({ children }) {
  return children;
}
