/**
 * frontend/pages/register.jsx
 */
import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      toast.success('Account created!');
      router.push('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: '#1A1814', margin: 0 }}>Create Account</h1>
          <p style={{ color: '#6B6860', marginTop: 8 }}>Start migrating in minutes</p>
        </div>
        <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E2DA', padding: '2rem' }}>
          {[{ id: 'name', label: 'Full Name', type: 'text' }, { id: 'email', label: 'Email', type: 'email' }, { id: 'password', label: 'Password', type: 'password' }].map(f => (
            <div key={f.id} style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1A1814', marginBottom: 6 }}>{f.label}</label>
              <input type={f.type} value={form[f.id]} onChange={e => setForm(v => ({ ...v, [f.id]: e.target.value }))} required
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E2DA', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
            </div>
          ))}
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: loading ? '#E5E2DA' : '#D97706', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '1rem', color: '#6B6860', fontSize: 14 }}>Already have an account? <Link href="/login" style={{ color: '#D97706' }}>Sign in</Link></p>
      </div>
    </div>
  );
}
