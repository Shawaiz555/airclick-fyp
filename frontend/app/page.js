import LoginPage from "./login/page";

// Metadata for the home/index page
export const metadata = {
  title: 'Welcome',
  description: 'Sign in to AirClick to start controlling your computer with hand gestures. Experience touchless computer control powered by AI gesture recognition.',
  openGraph: {
    title: 'Welcome to AirClick',
    description: 'Sign in to AirClick to start controlling your computer with hand gestures',
    url: '/',
  },
  twitter: {
    title: 'Welcome to AirClick',
    description: 'Sign in to AirClick to start controlling your computer with hand gestures',
  },
};

export default function index() {
  return (
    <div>
      <LoginPage/>
    </div>
  );
}
