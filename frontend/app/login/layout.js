// Metadata for the login page
export const metadata = {
  title: 'Login',
  description: 'Sign in to your AirClick account to access hand gesture control features. Secure authentication with email or Google account.',
  openGraph: {
    title: 'Login to AirClick',
    description: 'Sign in to your AirClick account to access hand gesture control features',
    url: '/login',
  },
  twitter: {
    title: 'Login to AirClick',
    description: 'Sign in to your AirClick account to access hand gesture control features',
  },
  robots: {
    index: false, // Don't index login page
    follow: true,
  },
};

export default function LoginLayout({ children }) {
  return children;
}
