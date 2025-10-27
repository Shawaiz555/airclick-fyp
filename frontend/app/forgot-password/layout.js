// Metadata for the forgot password page
export const metadata = {
  title: 'Forgot Password',
  description: 'Reset your AirClick account password. Enter your email address to receive password reset instructions.',
  openGraph: {
    title: 'Forgot Password - AirClick',
    description: 'Reset your AirClick account password',
    url: '/forgot-password',
  },
  twitter: {
    title: 'Forgot Password - AirClick',
    description: 'Reset your AirClick account password',
  },
  robots: {
    index: false, // Don't index password reset pages
    follow: false,
  },
};

export default function ForgotPasswordLayout({ children }) {
  return children;
}
