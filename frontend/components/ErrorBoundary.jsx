/**
 * frontend/components/ErrorBoundary.jsx
 * Gap 9 — React class-based error boundary.
 *
 * Catches any uncaught render / lifecycle error in its subtree and renders
 * a friendly fallback instead of a blank screen.
 *
 * Usage:
 *   // Wraps the whole app in _app.jsx:
 *   <ErrorBoundary>
 *     <Component {...pageProps} />
 *   </ErrorBoundary>
 *
 *   // Or scoped to a single risky component:
 *   <ErrorBoundary fallback={<p>Widget failed to load.</p>}>
 *     <SomeUnstableWidget />
 *   </ErrorBoundary>
 */
import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Forward to any external error tracker (Sentry, LogRocket, etc.) if configured
    if (typeof window !== 'undefined' && window.__errorTracker) {
      window.__errorTracker.captureException(error, { extra: errorInfo });
    }
    // Also log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
    }
  }

  handleReset() {
    this.setState({ hasError: false, error: null, errorInfo: null });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    // Allow a custom fallback to be passed in
    if (this.props.fallback) return this.props.fallback;

    const { error, errorInfo } = this.state;
    const isDev = process.env.NODE_ENV !== 'production';

    return (
      <div style={{
        minHeight: '100vh',
        background: '#F8F7F4',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, sans-serif',
        padding: '2rem',
      }}>
        <div style={{
          background: '#fff',
          border: '1px solid #E5E2DA',
          borderRadius: 16,
          padding: '2.5rem',
          maxWidth: 520,
          width: '100%',
          textAlign: 'center',
        }}>
          {/* Icon */}
          <div style={{ fontSize: 48, marginBottom: '1rem' }}>\uD83D\uDEA8</div>

          <h1 style={{
            fontFamily: 'Georgia, serif',
            fontSize: 22,
            fontWeight: 700,
            color: '#1A1814',
            marginBottom: '0.5rem',
          }}>
            Something went wrong
          </h1>

          <p style={{ color: '#6B6860', fontSize: 14, marginBottom: '1.5rem', lineHeight: 1.6 }}>
            An unexpected error occurred. Your data is safe — please try refreshing
            the page or navigating back to the dashboard.
          </p>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '9px 20px',
                background: '#D97706',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <button
              onClick={() => { window.location.href = '/dashboard'; }}
              style={{
                padding: '9px 20px',
                background: 'transparent',
                color: '#6B6860',
                border: '1px solid #E5E2DA',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Go to Dashboard
            </button>
          </div>

          {/* Dev-only stack trace */}
          {isDev && error && (
            <details style={{ marginTop: '1.5rem', textAlign: 'left' }}>
              <summary style={{
                cursor: 'pointer', fontSize: 12, color: '#9B9890',
                fontFamily: 'Courier New, monospace',
              }}>
                {error.toString()}
              </summary>
              {errorInfo && (
                <pre style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: '#DC2626',
                  background: '#FEE2E2',
                  borderRadius: 6,
                  padding: '0.75rem',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {errorInfo.componentStack}
                </pre>
              )}
            </details>
          )}
        </div>
      </div>
    );
  }
}
