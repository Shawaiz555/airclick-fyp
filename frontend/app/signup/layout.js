// Metadata for the signup page
export const metadata = {
  title: 'Sign Up',
  description: 'Create a free AirClick account to start controlling your computer with hand gestures. Quick registration with email or Google account.',
  openGraph: {
    title: 'Sign Up for AirClick',
    description: 'Create a free AirClick account to start controlling your computer with hand gestures',
    url: '/signup',
  },
  twitter: {
    title: 'Sign Up for AirClick',
    description: 'Create a free AirClick account to start controlling your computer with hand gestures',
  },
  robots: {
    index: false, // Don't index signup page
    follow: true,
  },
};

export default function SignupLayout({ children }) {
  return children;
}
