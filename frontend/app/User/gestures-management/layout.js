// Metadata for the Gestures Management page
export const metadata = {
  title: 'Gesture Management',
  description: 'Create and manage custom hand gestures - Record new gestures, edit existing ones, test gesture recognition, and customize your gesture library.',
  openGraph: {
    title: 'Gesture Management - AirClick',
    description: 'Create and manage custom hand gestures',
    url: '/User/gestures-management',
  },
  twitter: {
    title: 'Gesture Management - AirClick',
    description: 'Create and manage custom hand gestures',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function GesturesManagementLayout({ children }) {
  return children;
}
