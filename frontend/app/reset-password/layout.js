// Metadata for the reset password page
export const metadata = {
  title: 'Reset Password',
  description: 'Create a new password for your AirClick account. Enter your new password to regain access to your account.',
  openGraph: {
    title: 'Reset Password - AirClick',
    description: 'Create a new password for your AirClick account',
    url: '/reset-password',
  },
  twitter: {
    title: 'Reset Password - AirClick',
    description: 'Create a new password for your AirClick account',
  },
  robots: {
    index: false, // Don't index password reset pages
    follow: false,
  },
};

export default function ResetPasswordLayout({ children }) {
  return children;
}
