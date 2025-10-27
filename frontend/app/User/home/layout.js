// Metadata for the User Home page
export const metadata = {
  title: 'Hand Tracking',
  description: 'Real-time hand gesture tracking and control - Use your webcam to control your computer with hand gestures powered by MediaPipe AI technology.',
  openGraph: {
    title: 'Hand Tracking - AirClick',
    description: 'Real-time hand gesture tracking and control with AI',
    url: '/User/home',
  },
  twitter: {
    title: 'Hand Tracking - AirClick',
    description: 'Real-time hand gesture tracking and control with AI',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function UserHomeLayout({ children }) {
  return children;
}
