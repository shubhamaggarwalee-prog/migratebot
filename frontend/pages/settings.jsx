/**
 * frontend/pages/settings.jsx
 * Profile settings + Security (2FA) + Credentials tab
 * Gap 4: Added Credentials tab to update API keys at any time.
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuthStore } from '../lib/store';
import { post, get, patch } from '../lib/api';
import Term from '../components/Term';

const C = {
  amber: '#D97706', amberBg: '#FEF3C7', amberDark: '#B45309',
  ink: '#1A1814', inkMid: '#5C574E', inkLight: '#9B958A',
  border: '#E5E2DA', surface: '#F8F7F4',
  green: '#059669', greenBg: '#D1FAE5',
  red: '#DC2626', redBg: '#FEE2E2',
};

const TABS = ['Profile', 'Security', 'Credentials', 'Danger Zone'];

const CREDENTIAL_SERVICES = [
  {
    key: 'anthropic',
    label: 'Anthropic',
    icon: '\ud83e\udd16',
    description: 'Used by the AI to read and understand your code.',
    placeholder: 'sk-ant-api03-...',
    hint: 'console.anthropic.com \u2192 API Keys',
    link: 'https://console.anthropic.com/',
  },
  {
    key: 'supabase',
    label: 'Supabase',
    icon: '\ud83d\uddc4\ufe0f',
    description: 'Your app\u2019s database and authentication system.',
    placeholder: 'sbp_...',
    hint: 'app.supabase.com \u2192 Account \u2192 Access Tokens',
    link: 'https://app.supabase.com/account/tokens',
  },
  {
    key: 'vercel',
    label: 'Vercel',
    icon: '\u25b2',
    description: 'Hosts your frontend so visitors can access your app.',
    placeholder: 'vercel token...',
    hint: 'vercel.com/account/tokens',
    link: 'https://vercel.com/account/tokens',
  },
  {
    key: 'railway',
    label: 'Railway',
    icon: '\ud83d\ude82',
    description: 'Runs your backend server logic.',
    placeholder: 'railway token...',
    hint: 'railway.app/account/tokens',
    link: 'https://railway.app/account/tokens',
  },
];

// ─── Profile tab ─────────────────────────────────────────────────────────────
function TabProfile({ user }) {
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      await post('/api/auth/profile', form);
      setMsg('\u2713 Profile updated');
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
      }}>{saving ? 'Saving\u2026' : 'Save Changes'}</button>
      {msg && <p style={{ marginTop: 10, fontSize: 13, color: msg.startsWith('\u2713') ? C.green : C.red }}>{msg}</p>}
    </div>
  );
}

// ─── 2FA Security tab ────────────────────────────────────────────────────────
function TabSecurity({ user }) {
  const [status, setStatus] = useState('idle');
  const [qrUri, setQrUri] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const twoFaEnabled = user?.two_fa_enabled;

  useEffect(() => { setStatus(twoFaEnabled ? 'enabled' : 'idle'); }, [twoFaEnabled]);

  const startSetup = async () => {
    setError(''); setMsg('');
    try {
      const res = await post('/api/auth/2fa/setup');
      setQrUri(res.qrUri); setSecret(res.secret); setStatus('setup');
    } catch (e) { setError(e.message); }
  };

  const confirm = async () => {
    if (code.length !== 6) { setError('Enter the 6-digit code from your authenticator app.'); return; }
    setError('');
    try {
      const res = await post('/api/auth/2fa/confirm', { code });
      setBackupCodes(res.backupCodes || []);
      setStatus('confirmed'); setMsg('\u2713 Two-factor authentication enabled!');
    } catch (e) { setError(e.message || 'Invalid code. Try again.'); }
  };

  const disable2fa = async () => {
    if (!window.confirm('Are you sure you want to disable two-factor authentication?')) return;
    setError(''); setMsg('');
    try {
      await post('/api/auth/2fa/disable', { code });
      setStatus('idle'); setMsg('2FA disabled.'); setCode('');
    } catch (e) { setError(e.message || 'Invalid code.'); }
  };

  const copyBackup = (c) => navigator.clipboard.writeText(c);
  const copyAllBackup = () => navigator.clipboard.writeText(backupCodes.join('\n'));

  return (
    <div style={{ maxWidth: 460 }}>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: '1.25rem', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: C.ink }}><Term id="2fa">Two-factor authentication</Term></div>
            <div style={{ fontSize: 13, color: C.inkMid, marginTop: 2 }}>Add a second layer of security to your account.</div>
          </div>
          <div style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: (status === 'enabled' || status === 'confirmed') ? '#D1FAE5' : '#FEE2E2', color: (status === 'enabled' || status === 'confirmed') ? C.green : C.red }}>
            {(status === 'enabled' || status === 'confirmed') ? 'Enabled' : 'Disabled'}
          </div>
        </div>
      </div>
      {status === 'idle' && (
        <div>
          <p style={{ fontSize: 13, color: C.inkMid, marginBottom: 12, lineHeight: 1.6 }}><Term id="2fa">Two-factor authentication (2FA)</Term> adds a second verification step when you sign in.</p>
          <button onClick={startSetup} style={{ width: '100%', padding: '12px', background: C.amber, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>Enable <Term id="2fa">2FA</Term></button>
        </div>
      )}
      {status === 'setup' && (
        <div>
          <p style={{ fontSize: 14, color: C.inkMid, marginBottom: 16 }}>Scan this QR code with <strong>Google Authenticator</strong>, <strong>Authy</strong>, or any <Term id="totp">TOTP</Term> app.</p>
          <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, textAlign: 'center', marginBottom: 16 }}>
            {qrUri ? <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUri)}`} alt="2FA QR code" width={180} height={180} style={{ imageRendering: 'pixelated' }} /> : <div style={{ width: 180, height: 180, background: C.surface, margin: '0 auto', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkLight }}>Loading\u2026</div>}
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, fontFamily: 'monospace', letterSpacing: '.1em', textAlign: 'center', marginBottom: 16, color: C.ink }}>{secret}</div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}><Term id="totp">Verification code</Term></label>
          <input value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} placeholder="000000" maxLength={6} style={{ width: '100%', padding: '12px', border: `1px solid ${error ? C.red : C.border}`, borderRadius: 8, fontSize: 20, letterSpacing: '.25em', textAlign: 'center', boxSizing: 'border-box', marginBottom: 12 }} />
          {error && <p style={{ color: C.red, fontSize: 13, marginBottom: 8 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStatus('idle')} style={{ flex: 1, padding: 11, background: '#fff', color: C.ink, border: `1px solid ${C.border}`, borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={confirm} style={{ flex: 2, padding: 11, background: C.amber, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Verify & Enable</button>
          </div>
        </div>
      )}
      {status === 'confirmed' && backupCodes.length > 0 && (
        <div>
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '1rem', marginBottom: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#92400E', marginBottom: 8 }}>⚠ Save your <Term id="backup-codes">backup codes</Term></p>
            <p style={{ fontSize: 13, color: '#78350F', marginBottom: 12 }}>Each <Term id="backup-codes">backup code</Term> can only be used once.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
              {backupCodes.map((c, i) => <button key={i} onClick={() => copyBackup(c)} title="Click to copy" style={{ fontFamily: 'monospace', fontSize: 13, padding: '6px 10px', background: '#fff', border: '1px solid #FDE68A', borderRadius: 6, cursor: 'pointer', color: C.ink, letterSpacing: '.06em' }}>{c}</button>)}
            </div>
            <button onClick={copyAllBackup} style={{ width: '100%', padding: '8px', background: '#fff', border: '1px solid #FDE68A', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#92400E', cursor: 'pointer' }}>Copy all</button>
          </div>
          <button onClick={() => setStatus('enabled')} style={{ width: '100%', padding: 12, background: C.green, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>I\u2019ve saved my codes \u2713</button>
        </div>
      )}
      {status === 'enabled' && (
        <div>
          <p style={{ fontSize: 14, color: C.inkMid, marginBottom: 16 }}><Term id="2fa">2FA</Term> is active. To disable, enter your current code.</p>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>Current code</label>
          <input value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} placeholder="000000" maxLength={6} style={{ width: '100%', padding: '12px', border: `1px solid ${error ? C.red : C.border}`, borderRadius: 8, fontSize: 20, letterSpacing: '.25em', textAlign: 'center', boxSizing: 'border-box', marginBottom: 12 }} />
          {error && <p style={{ color: C.red, fontSize: 13, marginBottom: 8 }}>{error}</p>}
          <button onClick={disable2fa} style={{ width: '100%', padding: 12, background: C.red, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Disable <Term id="2fa">2FA</Term></button>
        </div>
      )}
      {msg && <p style={{ marginTop: 12, fontSize: 13, color: msg.startsWith('\u2713') ? C.green : C.inkMid }}>{msg}</p>}
    </div>
  );
}

// ─── Gap 4: Credentials tab ──────────────────────────────────────────────────
function TabCredentials() {
  const [values,  setValues]  = useState({});
  const [show,    setShow]    = useState({});
  const [saving,  setSaving]  = useState({});
  const [saved,   setSaved]   = useState({});
  const [errors,  setErrors]  = useState({});
  const [statuses, setStatuses] = useState({});  // 'ok' | 'missing' per service

  // Load which credentials are already set (backend returns boolean per service, never the raw token)
  useEffect(() => {
    get('/api/credentials/status')
      .then(res => setStatuses(res.statuses || {}))
      .catch(() => {});
  }, []);

  const toggleShow = key => setShow(s => ({ ...s, [key]: !s[key] }));

  const saveKey = async (serviceKey) => {
    const val = (values[serviceKey] || '').trim();
    if (!val) { setErrors(e => ({ ...e, [serviceKey]: 'Please paste your new API key.' })); return; }
    setErrors(e => ({ ...e, [serviceKey]: '' }));
    setSaving(s => ({ ...s, [serviceKey]: true }));
    try {
      await patch('/api/credentials', { service: serviceKey, token: val });
      setSaved(s => ({ ...s, [serviceKey]: true }));
      setStatuses(s => ({ ...s, [serviceKey]: 'ok' }));
      setValues(v => ({ ...v, [serviceKey]: '' })); // clear input after save
      setTimeout(() => setSaved(s => ({ ...s, [serviceKey]: false })), 3000);
    } catch (e) {
      setErrors(err => ({ ...err, [serviceKey]: e.message || 'Failed to save. Try again.' }));
    } finally {
      setSaving(s => ({ ...s, [serviceKey]: false }));
    }
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <p style={{ fontSize: 14, color: C.inkMid, marginBottom: 20, lineHeight: 1.6 }}>
        Your API keys are stored encrypted (AES-256) and are never shown in plain text.
        Update any key here at any time — changes apply to all future migrations.
      </p>

      {CREDENTIAL_SERVICES.map(svc => {
        const isSet = statuses[svc.key] === 'ok';
        return (
          <div key={svc.key} style={{
            background: '#fff', borderRadius: 12,
            border: `1px solid ${C.border}`,
            borderLeft: `4px solid ${isSet ? C.green : C.amber}`,
            padding: '16px 18px', marginBottom: 14,
          }}>
            {/* Service header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{svc.icon}</span>
                <span style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>{svc.label}</span>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                background: isSet ? C.greenBg : C.amberBg,
                color: isSet ? C.green : C.amberDark,
              }}>
                {isSet ? '\u2713 Connected' : '\u26a0 Not set'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: C.inkMid, marginBottom: 12, lineHeight: 1.5 }}>
              {svc.description}{' '}
              <a href={svc.link} target="_blank" rel="noreferrer" style={{ color: C.amber }}>
                Get key \u2197
              </a>{' — '}{svc.hint}
            </div>

            {/* Input row */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type={show[svc.key] ? 'text' : 'password'}
                value={values[svc.key] || ''}
                onChange={e => setValues(v => ({ ...v, [svc.key]: e.target.value }))}
                placeholder={isSet ? 'Paste new key to replace\u2026' : svc.placeholder}
                style={{
                  flex: 1, padding: '10px 12px',
                  border: `1.5px solid ${errors[svc.key] ? C.red : C.border}`,
                  borderRadius: 8, fontSize: 13,
                  fontFamily: 'monospace', outline: 'none',
                }}
              />
              <button
                onClick={() => toggleShow(svc.key)}
                title={show[svc.key] ? 'Hide' : 'Show'}
                style={{ padding: '8px 12px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
              >
                {show[svc.key] ? '\ud83d\ude48' : '\ud83d\udc41\ufe0f'}
              </button>
              <button
                onClick={() => saveKey(svc.key)}
                disabled={saving[svc.key] || !values[svc.key]?.trim()}
                style={{
                  padding: '10px 18px',
                  background: saved[svc.key] ? C.green : saving[svc.key] || !values[svc.key]?.trim() ? C.border : C.amber,
                  color: '#fff', border: 'none', borderRadius: 8,
                  fontWeight: 700, fontSize: 13,
                  cursor: saving[svc.key] || !values[svc.key]?.trim() ? 'default' : 'pointer',
                  minWidth: 72, transition: 'background .15s',
                }}
              >
                {saved[svc.key] ? '\u2713 Saved' : saving[svc.key] ? '\u2026' : 'Update'}
              </button>
            </div>
            {errors[svc.key] && <p style={{ fontSize: 12, color: C.red, marginTop: 6 }}>{errors[svc.key]}</p>}
          </div>
        );
      })}
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

  // Allow deep-linking to the Credentials tab, e.g. /settings?tab=credentials
  useEffect(() => {
    if (router.query.tab === 'credentials') setTab(2);
  }, [router.query.tab]);

  const handleLogout = () => { logout(); router.push('/login'); };

  return (
    <>
      <Head><title>Settings \u2014 MigrateBot</title></Head>
      <div style={{ minHeight: '100vh', background: C.surface, padding: '40px 16px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: C.ink, marginBottom: 28 }}>Settings</h1>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 0, borderBottom: `2px solid ${C.border}`, marginBottom: 28, overflowX: 'auto' }}>
            {TABS.map((t, i) => (
              <button key={t} onClick={() => setTab(i)} style={{
                padding: '10px 20px', background: 'none', border: 'none',
                borderBottom: `2px solid ${tab === i ? C.amber : 'transparent'}`,
                marginBottom: -2, fontWeight: tab === i ? 700 : 400, fontSize: 14,
                color: tab === i ? C.amber : C.inkMid, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>{t}</button>
            ))}
          </div>

          {tab === 0 && <TabProfile user={user} />}
          {tab === 1 && <TabSecurity user={user} />}
          {tab === 2 && <TabCredentials />}
          {tab === 3 && <TabDanger onLogout={handleLogout} />}
        </div>
      </div>
    </>
  );
}
