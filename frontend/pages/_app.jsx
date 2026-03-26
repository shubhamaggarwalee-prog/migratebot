/**
 * frontend/pages/_app.jsx
 * Next.js app wrapper — global styles + auth context + error boundary.
 * Gap 9: Wrapped the app in <ErrorBoundary> so uncaught render errors
 *        never produce a blank screen.
 */
import '../styles/globals.css';
import { AuthProvider } from '../context/AuthContext';
import { Toaster }      from 'react-hot-toast';
import ErrorBoundary    from '../components/ErrorBoundary';

export default function App({ Component, pageProps }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Component {...pageProps} />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1A1814',
              color: '#F8F7F4',
              border: '1px solid #E5E2DA',
            },
          }}
        />
      </AuthProvider>
    </ErrorBoundary>
  );
}
