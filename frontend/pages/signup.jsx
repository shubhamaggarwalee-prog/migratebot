import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

export default function Signup() {
  const router = useRouter();
  const [form, setForm]     = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const validate = () => {
    const e = {};
    if (!form.name.trim())              e.name     = 'Name is required';
    if (!form.email.includes('@'))      e.email    = 'Valid email is required';
    if (form.password.length < 8)       e.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirm) e.confirm  = 'Passwords do not match';
    return e;
  };

  const handleChange = e => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setErrors(er => ({ ...er, [e.target.name]: '' }));
    setApiError('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) return setErrors(errs);
    setLoading(true);
    try {
      const res  = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      router.push('/login?registered=1');
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head><title>Create account — MigrateBot</title></Head>
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>🚀</span>
            <span style={styles.logoBold}>Migrate</span><span style={styles.logoAmber}>Bot</span>
          </div>
          <h1 style={styles.heading}>Create your account</h1>
          <p style={styles.sub}>Deploy your first app in under 3 minutes.</p>

          {apiError && <div style={styles.errorBanner}>{apiError}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <Field label="Full name" name="name" type="text" value={form.name}
              onChange={handleChange} error={errors.name} placeholder="Jane Smith" />
            <Field label="Email" name="email" type="email" value={form.email}
              onChange={handleChange} error={errors.email} placeholder="you@example.com" />
            <Field label="Password" name="password" type="password" value={form.password}
              onChange={handleChange} error={errors.password} placeholder="Min. 8 characters" />
            <Field label="Confirm password" name="confirm" type="password" value={form.confirm}
              onChange={handleChange} error={errors.confirm} placeholder="Re-enter password" />

            <button type="submit" disabled={loading} style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p style={styles.footer}>
            Already have an account?{' '}
            <Link href="/login" style={styles.link}>Sign in</Link>
          </p>
        </div>
      </div>
    </>
  );
}

function Field({ label, name, type, value, onChange, error, placeholder }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={styles.label}>{label}</label>
      <input
        name={name} type={type} value={value} onChange={onChange}
        placeholder={placeholder} autoComplete={type === 'password' ? 'new-password' : undefined}
        style={{ ...styles.input, ...(error ? styles.inputError : {}) }}
      />
      {error && <p style={styles.fieldError}>{error}</p>}
    </div>
  );
}

const C = {
  bg: '#F8F7F4', surface: '#FFFFFF', border: '#E5E2DA',
  ink: '#1A1814', inkMid: '#5C574E', inkLight: '#9B958A',
  amber: '#D97706', amberDark: '#B45309', red: '#DC2626', redBg: '#FEF2F2',
};

const styles = {
  page:       { minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif" },
  card:       { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '40px 36px', width: '100%', maxWidth: 420 },
  logo:       { display: 'flex', alignItems: 'center', marginBottom: 24 },
  logoIcon:   { width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg,${C.amber},${C.amberDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginRight: 8 },
  logoBold:   { fontSize: 18, fontWeight: 700, letterSpacing: '-0.025em', color: C.ink },
  logoAmber:  { fontSize: 18, fontWeight: 700, color: C.amber },
  heading:    { fontSize: 22, fontWeight: 700, color: C.ink, margin: '0 0 6px', letterSpacing: '-0.025em' },
  sub:        { fontSize: 14, color: C.inkMid, margin: '0 0 24px' },
  label:      { display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 },
  input:      { width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 14, color: C.ink, background: '#FAFAF9', outline: 'none' },
  inputError: { borderColor: C.red },
  fieldError: { margin: '4px 0 0', fontSize: 12, color: C.red },
  errorBanner:{ background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.red, marginBottom: 16 },
  btn:        { width: '100%', padding: '12px', background: C.amber, color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8 },
  footer:     { textAlign: 'center', fontSize: 13, color: C.inkMid, marginTop: 20 },
  link:       { color: C.amber, fontWeight: 600, textDecoration: 'none' },
};
