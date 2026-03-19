/**
 * frontend/pages/settings.jsx
 */
import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '' });

  const handleLogout = () => { logout(); router.push('/login'); };

  return (
    <Layout>
      <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: '#1A1814', marginBottom: '2rem' }}>Settings</h1>
      <div style={{ maxWidth: 500 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E2DA', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1A1814', margin: '0 0 1.25rem' }}>Profile</h2>
          {[{ id: 'name', label: 'Name' }, { id: 'email', label: 'Email' }].map(f => (
            <div key={f.id} style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1A1814', marginBottom: 6 }}>{f.label}</label>
              <input value={form[f.id]} onChange={e => setForm(v => ({ ...v, [f.id]: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E2DA', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
          ))}
          <button onClick={() => toast.success('Profile updated!')} style={{ padding: '10px 20px', background: '#D97706', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Save Changes</button>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FED7D7', padding: '1.5rem' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#DC2626', margin: '0 0 0.75rem' }}>Danger Zone</h2>
          <p style={{ color: '#6B6860', fontSize: 14, marginBottom: '1rem' }}>Sign out of your account.</p>
          <button onClick={handleLogout} style={{ padding: '10px 20px', background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Sign Out</button>
        </div>
      </div>
    </Layout>
  );
}
