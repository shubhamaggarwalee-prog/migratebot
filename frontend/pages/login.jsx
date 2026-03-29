/**
 * frontend/pages/login.jsx
 */
import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const sessionExpired = router.query.reason === 'session_expired';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {sessionExpired && (
          <div role="alert" style={{ marginBottom: '1.25rem', padding: '12px 16px', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, color: '#92400E', fontSize: 14 }}>
            Your session has expired. Please sign in again.
          </div>
        )}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: '#1A1814', margin: 0 }}>Welcome back</h1>
          <p style={{ color: '#6B6860', marginTop: 8 }}>Sign in to MigrateBot</p>
        </div>
        <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E2DA', padding: '2rem' }}>
          {[{ id: 'email', label: 'Email', type: 'email' }, { id: 'password', label: 'Password', type: 'password' }].map(f => (
            <div key={f.id} style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1A1814', marginBottom: 6 }}>{f.label}</label>
              <input type={f.type} value={form[f.id]} onChange={e => setForm(v => ({ ...v, [f.id]: e.target.value }))} required
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E2DA', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
            </div>
          ))}
          <div style={{ textAlign: 'right', marginTop: '-0.75rem', marginBottom: '1.25rem' }}>
            <Link href="/forgot-password" style={{ fontSize: 13, color: '#D97706' }}>Forgot password?</Link>
          </div>
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: loading ? '#E5E2DA' : '#D97706', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '1rem', color: '#6B6860', fontSize: 14 }}>No account? <Link href="/register" style={{ color: '#D97706' }}>Register</Link></p>
      </div>
    </div>
  );
}
