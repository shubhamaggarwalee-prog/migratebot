import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

export default function VerifyEmail() {
  const router = useRouter();
  const { token } = router.query;

  const [status, setStatus] = useState('loading'); // loading | success | already | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!router.isReady) return;
    if (!token) { setStatus('error'); setMessage('No verification token found in URL.'); return; }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/email/verify`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.alreadyVerified) return setStatus('already');
        if (data.success)         return setStatus('success');
        setStatus('error'); setMessage(data.error || 'Verification failed.');
      })
      .catch(() => { setStatus('error'); setMessage('Network error. Please try again.'); });
  }, [router.isReady, token]);

  const icons = { loading: '⏳', success: '✅', already: '✓', error: '⚠️' };
  const colors = { loading: '#D97706', success: '#059669', already: '#059669', error: '#DC2626' };

  return (
    <>
      <Head><title>Verify email — MigrateBot</title></Head>
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>🚀</span>
            <span style={styles.logoBold}>Migrate</span><span style={styles.logoAmber}>Bot</span>
          </div>

          <div style={{ textAlign: 'center', padding: '16px 0 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{icons[status]}</div>
            <h1 style={{ ...styles.heading, color: colors[status] }}>
              {status === 'loading' && 'Verifying your email…'}
              {status === 'success' && 'Email verified!'}
              {status === 'already' && 'Already verified'}
              {status === 'error'   && 'Verification failed'}
            </h1>
            <p style={styles.sub}>
              {status === 'loading' && 'Hold tight, this only takes a second.'}
              {status === 'success' && 'Your email has been confirmed. Your account is fully active.'}
              {status === 'already' && 'Your email is already verified. You can close this tab.'}
              {status === 'error'   && (message || 'Something went wrong. The link may have expired.')}
            </p>
          </div>

          {status === 'success' && (
            <Link href="/dashboard" style={styles.btn}>Go to dashboard</Link>
          )}
          {status === 'error' && (
            <Link href="/settings" style={styles.btnOutline}>Resend verification email</Link>
          )}
          {status === 'already' && (
            <Link href="/dashboard" style={styles.btn}>Go to dashboard</Link>
          )}
        </div>
      </div>
    </>
  );
}

const C = {
  bg: '#F8F7F4', surface: '#FFFFFF', border: '#E5E2DA',
  ink: '#1A1814', inkMid: '#5C574E',
  amber: '#D97706', amberDark: '#B45309',
};

const styles = {
  page:       { minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif" },
  card:       { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '40px 36px', width: '100%', maxWidth: 400, textAlign: 'center' },
  logo:       { display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  logoIcon:   { width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg,${C.amber},${C.amberDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginRight: 8 },
  logoBold:   { fontSize: 18, fontWeight: 700, color: C.ink },
  logoAmber:  { fontSize: 18, fontWeight: 700, color: C.amber },
  heading:    { fontSize: 22, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.025em' },
  sub:        { fontSize: 14, color: C.inkMid, margin: '0 0 24px', lineHeight: 1.6 },
  btn:        { display: 'inline-block', width: '100%', boxSizing: 'border-box', padding: 12, background: C.amber, color: '#fff', borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: 'none', textAlign: 'center' },
  btnOutline: { display: 'inline-block', width: '100%', boxSizing: 'border-box', padding: 12, background: 'transparent', color: C.ink, border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: 'none', textAlign: 'center' },
};
