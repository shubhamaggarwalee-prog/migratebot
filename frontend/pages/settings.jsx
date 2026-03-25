/**
 * frontend/pages/settings.jsx
 * Profile settings + Security (2FA) tab.
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuthStore } from '../lib/store';
import { post, get } from '../lib/api';
import Term from '../components/Term';

const C = {
  amber: '#D97706', amberBg: '#FEF3C7', ink: '#1A1814',
  inkMid: '#5C574E', inkLight: '#9B958A', border: '#E5E2DA',
  surface: '#F8F7F4', green: '#059669', red: '#DC2626',
};

const TABS = ['Profile', 'Security', 'Danger Zone'];

// ─── Profile tab ─────────────────────────────────────────────────────────────
function TabProfile({ user }) {
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      await post('/api/auth/profile', form);
      setMsg('✓ Profile updated');
    } catch (e) {
      setMsg('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 460 }}>
      {[{ id: 'name', label: 'Name', type: 'text' }, { id: 'email', label: 'Email', type: 'email' }].map(f => (
        <div key={f.id} style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>{f.label}</label>
          <input
            type={f.type}
            value={form[f.id]}
            onChange={e => setForm(v => ({ ...v, [f.id]: e.target.value }))}
            style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
          />
        </div>
      ))}
      <button onClick={save} disabled={saving} style={{
        padding: '10px 22px', background: saving ? C.inkLight : C.amber, color: '#fff',
        border: 'none', borderRadius: 8, fontWeight: 600, cursor: saving ? 'default' : 'pointer',
      }}>{saving ? 'Saving…' : 'Save Changes'}</button>
      {msg && <p style={{ marginTop: 10, fontSize: 13, color: msg.startsWith('✓') ? C.green : C.red }}>{msg}</p>}
    </div>
  );
}

// ─── 2FA Security tab ────────────────────────────────────────────────────────
function TabSecurity({ user }) {
  const [status, setStatus] = useState('idle'); // idle | setup | confirm | enabled | disabling
  const [qrUri, setQrUri] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const twoFaEnabled = user?.two_fa_enabled;

  // Initialise status from user profile
  useEffect(() => { setStatus(twoFaEnabled ? 'enabled' : 'idle'); }, [twoFaEnabled]);

  const startSetup = async () => {
    setError(''); setMsg('');
    try {
      const res = await post('/api/auth/2fa/setup');
      setQrUri(res.qrUri);
      setSecret(res.secret);
      setStatus('setup');
    } catch (e) { setError(e.message); }
  };

  const confirm = async () => {
    if (code.length !== 6) { setError('Enter the 6-digit code from your authenticator app.'); return; }
    setError('');
    try {
      const res = await post('/api/auth/2fa/confirm', { code });
      setBackupCodes(res.backupCodes || []);
      setStatus('confirmed');
      setMsg('✓ Two-factor authentication enabled!');
    } catch (e) { setError(e.message || 'Invalid code. Try again.'); }
  };

  const disable2fa = async () => {
    if (!window.confirm('Are you sure you want to disable two-factor authentication?')) return;
    setError(''); setMsg('');
    try {
      await post('/api/auth/2fa/disable', { code });
      setStatus('idle');
      setMsg('2FA disabled.');
      setCode('');
    } catch (e) { setError(e.message || 'Invalid code.'); }
  };

  const copyBackup = (c) => { navigator.clipboard.writeText(c); };
  const copyAllBackup = () => navigator.clipboard.writeText(backupCodes.join('\n'));

  return (
    <div style={{ maxWidth: 460 }}>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: '1.25rem', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: C.ink }}>
              <Term id="2fa">Two-factor authentication</Term>
            </div>
            <div style={{ fontSize: 13, color: C.inkMid, marginTop: 2 }}>Add a second layer of security to your account.</div>
          </div>
          <div style={{
            padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
            background: (status === 'enabled' || status === 'confirmed') ? '#D1FAE5' : '#FEE2E2',
            color: (status === 'enabled' || status === 'confirmed') ? C.green : C.red,
          }}>{(status === 'enabled' || status === 'confirmed') ? 'Enabled' : 'Disabled'}</div>
        </div>
      </div>

      {/* IDLE — not set up */}
      {status === 'idle' && (
        <div>
          <p style={{ fontSize: 13, color: C.inkMid, marginBottom: 12, lineHeight: 1.6 }}>
            <Term id="2fa">Two-factor authentication (2FA)</Term> adds a second verification step when you sign in.
            Even if someone knows your password, they still can't access your account without your phone.
          </p>
          <button onClick={startSetup} style={{
            width: '100%', padding: '12px', background: C.amber, color: '#fff',
            border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', marginBottom: 12,
          }}>Enable <Term id="2fa">2FA</Term></button>
        </div>
      )}

      {/* SETUP — show QR code */}
      {status === 'setup' && (
        <div>
          <p style={{ fontSize: 14, color: C.inkMid, marginBottom: 16 }}>
            Scan this QR code with <strong>Google Authenticator</strong>, <strong>Authy</strong>, or any <Term id="totp">TOTP</Term> app.
          </p>
          {/* QR code rendered as img via qrUri data URL from backend */}
          <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, textAlign: 'center', marginBottom: 16 }}>
            {qrUri ? (
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUri)}`}
                alt="2FA QR code" width={180} height={180} style={{ imageRendering: 'pixelated' }} />
            ) : <div style={{ width: 180, height: 180, background: C.surface, margin: '0 auto', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkLight }}>Loading…</div>}
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, fontFamily: 'monospace', letterSpacing: '.1em', textAlign: 'center', marginBottom: 16, color: C.ink }}>
            {secret}
          </div>
          <p style={{ fontSize: 12, color: C.inkLight, marginBottom: 16 }}>Or enter the key above manually into your <Term id="totp">TOTP</Term> app.</p>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>
            <Term id="totp">Verification code</Term>
          </label>
          <input
            value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
            placeholder="000000" maxLength={6}
            style={{ width: '100%', padding: '12px', border: `1px solid ${error ? C.red : C.border}`, borderRadius: 8, fontSize: 20, letterSpacing: '.25em', textAlign: 'center', boxSizing: 'border-box', marginBottom: 12 }}
          />
          {error && <p style={{ color: C.red, fontSize: 13, marginBottom: 8 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStatus('idle')} style={{ flex: 1, padding: 11, background: '#fff', color: C.ink, border: `1px solid ${C.border}`, borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={confirm} style={{ flex: 2, padding: 11, background: C.amber, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Verify & Enable</button>
          </div>
        </div>
      )}

      {/* CONFIRMED — show backup codes */}
      {status === 'confirmed' && backupCodes.length > 0 && (
        <div>
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '1rem', marginBottom: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#92400E', marginBottom: 8 }}>⚠ Save your <Term id="backup-codes">backup codes</Term></p>
            <p style={{ fontSize: 13, color: '#78350F', marginBottom: 12 }}>
              Store these somewhere safe. Each <Term id="backup-codes">backup code</Term> can only be used once to sign in if you lose your <Term id="totp">authenticator app</Term>.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
              {backupCodes.map((c, i) => (
                <button key={i} onClick={() => copyBackup(c)} title="Click to copy" style={{
                  fontFamily: 'monospace', fontSize: 13, padding: '6px 10px', background: '#fff',
                  border: '1px solid #FDE68A', borderRadius: 6, cursor: 'pointer', color: C.ink, letterSpacing: '.06em',
                }}>{c}</button>
              ))}
            </div>
            <button onClick={copyAllBackup} style={{ width: '100%', padding: '8px', background: '#fff', border: '1px solid #FDE68A', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#92400E', cursor: 'pointer' }}>Copy all <Term id="backup-codes">backup codes</Term></button>
          </div>
          <button onClick={() => setStatus('enabled')} style={{ width: '100%', padding: 12, background: C.green, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>I've saved my codes ✓</button>
        </div>
      )}

      {/* ENABLED — manage / disable */}
      {status === 'enabled' && (
        <div>
          <p style={{ fontSize: 14, color: C.inkMid, marginBottom: 16 }}>
            <Term id="2fa">2FA</Term> is active. To disable, enter your current <Term id="totp">authenticator code</Term>.
          </p>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>Current <Term id="totp">code</Term></label>
          <input
            value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
            placeholder="000000" maxLength={6}
            style={{ width: '100%', padding: '12px', border: `1px solid ${error ? C.red : C.border}`, borderRadius: 8, fontSize: 20, letterSpacing: '.25em', textAlign: 'center', boxSizing: 'border-box', marginBottom: 12 }}
          />
          {error && <p style={{ color: C.red, fontSize: 13, marginBottom: 8 }}>{error}</p>}
          <button onClick={disable2fa} style={{ width: '100%', padding: 12, background: C.red, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Disable <Term id="2fa">2FA</Term></button>
        </div>
      )}

      {msg && <p style={{ marginTop: 12, fontSize: 13, color: msg.startsWith('✓') ? C.green : C.inkMid }}>{msg}</p>}
    </div>
  );
}

// ─── Danger Zone tab ─────────────────────────────────────────────────────────
function TabDanger({ onLogout }) {
  return (
    <div style={{ maxWidth: 460 }}>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FED7D7', padding: '1.5rem' }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: C.red, margin: '0 0 8px' }}>Sign out</h3>
        <p style={{ color: C.inkMid, fontSize: 14, marginBottom: 16 }}>Sign out of your account on this device.</p>
        <button onClick={onLogout} style={{ padding: '10px 22px', background: C.red, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Sign Out</button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [tab, setTab] = useState(0);

  const handleLogout = () => { logout(); router.push('/login'); };

  return (
    <>
      <Head><title>Settings — MigrateBot</title></Head>
      <div style={{ minHeight: '100vh', background: C.surface, padding: '40px 16px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: C.ink, marginBottom: 28 }}>Settings</h1>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 0, borderBottom: `2px solid ${C.border}`, marginBottom: 28 }}>
            {TABS.map((t, i) => (
              <button key={t} onClick={() => setTab(i)} style={{
                padding: '10px 20px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === i ? C.amber : 'transparent'}`,
                marginBottom: -2, fontWeight: tab === i ? 700 : 400, fontSize: 14,
                color: tab === i ? C.amber : C.inkMid, cursor: 'pointer',
              }}>{t}</button>
            ))}
          </div>

          {tab === 0 && <TabProfile user={user} />}
          {tab === 1 && <TabSecurity user={user} />}
          {tab === 2 && <TabDanger onLogout={handleLogout} />}
        </div>
      </div>
    </>
  );
}
