import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

export default function ResetPassword() {
  const router = useRouter();
  const { token } = router.query;

  // mode: 'request' (no token) | 'reset' (token present)
  const [mode, setMode]       = useState('request');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);

  useEffect(() => {
    if (router.isReady) setMode(token ? 'reset' : 'request');
  }, [router.isReady, token]);

  // ── Request reset ──
  const handleRequest = async e => {
    e.preventDefault();
    if (!email.includes('@')) return setError('Enter a valid email address');
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/forgot-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(data.message);
      setDone(true);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ── Set new password ──
  const handleReset = async e => {
    e.preventDefault();
    if (password.length < 8) return setError('Password must be at least 8 characters');
    if (password !== confirm) return setError('Passwords do not match');
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/reset-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone(true);
      setTimeout(() => router.push('/login?reset=1'), 2000);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <>
      <Head><title>{mode === 'reset' ? 'Set new password' : 'Forgot password'} — MigrateBot</title></Head>
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>🚀</span>
            <span style={styles.logoBold}>Migrate</span><span style={styles.logoAmber}>Bot</span>
          </div>

          {done ? (
            <div style={styles.successBox}>
              <p style={{ margin: 0, fontSize: 15, color: '#059669', fontWeight: 600 }}>
                {mode === 'reset' ? '✓ Password updated! Redirecting to login…' : message}
              </p>
            </div>
          ) : mode === 'request' ? (
            <>
              <h1 style={styles.heading}>Forgot your password?</h1>
              <p style={styles.sub}>Enter your email and we'll send a reset link. It expires in 30 minutes.</p>
              {error && <div style={styles.errorBanner}>{error}</div>}
              <form onSubmit={handleRequest}>
                <label style={styles.label}>Email</label>
                <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                  placeholder="you@example.com" style={styles.input} />
                <button type="submit" disabled={loading} style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 style={styles.heading}>Set a new password</h1>
              <p style={styles.sub}>Choose a strong password for your MigrateBot account.</p>
              {error && <div style={styles.errorBanner}>{error}</div>}
              <form onSubmit={handleReset}>
                <div style={{ marginBottom: 16 }}>
                  <label style={styles.label}>New password</label>
                  <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                    placeholder="Min. 8 characters" autoComplete="new-password" style={styles.input} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={styles.label}>Confirm password</label>
                  <input type="password" value={confirm} onChange={e => { setConfirm(e.target.value); setError(''); }}
                    placeholder="Re-enter password" autoComplete="new-password" style={styles.input} />
                </div>
                <button type="submit" disabled={loading} style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Saving…' : 'Update password'}
                </button>
              </form>
            </>
          )}

          <p style={styles.footer}>
            <Link href="/login" style={styles.link}>Back to sign in</Link>
          </p>
        </div>
      </div>
    </>
  );
}

const C = {
  bg: '#F8F7F4', surface: '#FFFFFF', border: '#E5E2DA',
  ink: '#1A1814', inkMid: '#5C574E',
  amber: '#D97706', amberDark: '#B45309',
  red: '#DC2626', redBg: '#FEF2F2',
  greenBg: '#D1FAE5',
};

const styles = {
  page:        { minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif" },
  card:        { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '40px 36px', width: '100%', maxWidth: 420 },
  logo:        { display: 'flex', alignItems: 'center', marginBottom: 24 },
  logoIcon:    { width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg,${C.amber},${C.amberDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginRight: 8 },
  logoBold:    { fontSize: 18, fontWeight: 700, letterSpacing: '-0.025em', color: C.ink },
  logoAmber:   { fontSize: 18, fontWeight: 700, color: C.amber },
  heading:     { fontSize: 22, fontWeight: 700, color: C.ink, margin: '0 0 6px', letterSpacing: '-0.025em' },
  sub:         { fontSize: 14, color: C.inkMid, margin: '0 0 24px' },
  label:       { display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 },
  input:       { width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 14, color: C.ink, background: '#FAFAF9', outline: 'none', marginBottom: 0 },
  errorBanner: { background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.red, marginBottom: 16 },
  successBox:  { background: C.greenBg, border: '1px solid #6EE7B7', borderRadius: 8, padding: '16px 20px', marginBottom: 16 },
  btn:         { width: '100%', padding: 12, background: C.amber, color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8 },
  footer:      { textAlign: 'center', fontSize: 13, color: C.inkMid, marginTop: 20 },
  link:        { color: C.amber, fontWeight: 600, textDecoration: 'none' },
};
