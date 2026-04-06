/**
 * frontend/pages/settings.jsx
 * Profile settings + Security (2FA) + Credentials + Notifications + Billing tab
 * Gap 4: Added Credentials tab.
 * Gap 6: Added Notifications tab wired to GET/PUT /api/notifications.
 * Task 15: Added Billing tab; billing.js return_url updated to /settings?tab=billing.
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuthStore } from '../lib/store';
import { post, get, patch, put } from '../lib/api';
import Term from '../components/Term';

const C = {
  amber: '#D97706', amberBg: '#FEF3C7', amberDark: '#B45309',
  ink: '#1A1814', inkMid: '#5C574E', inkLight: '#9B958A',
  border: '#E5E2DA', surface: '#F8F7F4',
  green: '#059669', greenBg: '#D1FAE5',
  red: '#DC2626', redBg: '#FEE2E2',
  blue: '#2563EB', blueBg: '#DBEAFE',
};

const TABS = ['Profile', 'Security', 'Credentials', 'Notifications', 'Billing', 'Danger Zone'];

// Deep-link tab name → index
const TAB_SLUGS = { profile: 0, security: 1, credentials: 2, notifications: 3, billing: 4, danger: 5 };

const CREDENTIAL_SERVICES = [
  { key: 'anthropic', label: 'Anthropic',  icon: '\ud83e\udd16', description: 'Used by the AI to read and understand your code.',          placeholder: 'sk-ant-api03-...', hint: 'console.anthropic.com \u2192 API Keys',                 link: 'https://console.anthropic.com/' },
  { key: 'supabase',  label: 'Supabase',   icon: '\ud83d\uddc4\ufe0f', description: 'Your app\u2019s database and authentication system.',       placeholder: 'sbp_...',          hint: 'app.supabase.com \u2192 Account \u2192 Access Tokens', link: 'https://app.supabase.com/account/tokens' },
  { key: 'vercel',    label: 'Vercel',     icon: '\u25b2',    description: 'Hosts your frontend so visitors can access your app.',  placeholder: 'vercel token...',  hint: 'vercel.com/account/tokens',                         link: 'https://vercel.com/account/tokens' },
  { key: 'railway',   label: 'Railway',    icon: '\ud83d\ude82', description: 'Runs your backend server logic.',                       placeholder: 'railway token...', hint: 'railway.app/account/tokens',                        link: 'https://railway.app/account/tokens' },
];

// ─── Shared toggle switch component ──────────────────────────────────────────────
function Toggle({ on, onChange, disabled }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => !disabled && onChange(!on)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none',
        background: on ? C.amber : C.border,
        position: 'relative', cursor: disabled ? 'default' : 'pointer',
        flexShrink: 0, transition: 'background .2s',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 3,
        left: on ? 23 : 3,
        width: 18, height: 18,
        borderRadius: '50%', background: '#fff',
        transition: 'left .18s',
        boxShadow: '0 1px 3px rgba(0,0,0,.2)',
      }} />
    </button>
  );
}

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
    } catch (e) { setMsg('Error: ' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ maxWidth: 460 }}>
      {[{ id: 'name', label: 'Name', type: 'text' }, { id: 'email', label: 'Email', type: 'email' }].map(f => (
        <div key={f.id} style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>{f.label}</label>
          <input type={f.type} value={form[f.id]} onChange={e => setForm(v => ({ ...v, [f.id]: e.target.value }))}
            style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
        </div>
      ))}
      <button onClick={save} disabled={saving} style={{ padding: '10px 22px', background: saving ? C.inkLight : C.amber, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}>
        {saving ? 'Saving\u2026' : 'Save Changes'}
      </button>
      {msg && <p style={{ marginTop: 10, fontSize: 13, color: msg.startsWith('\u2713') ? C.green : C.red }}>{msg}</p>}
    </div>
  );
}

// ─── Security tab ─────────────────────────────────────────────────────────────
function TabSecurity({ user }) {
  const [status, setStatus] = useState('idle');
  const [qrUri, setQrUri]   = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [code, setCode]     = useState('');
  const [error, setError]   = useState('');
  const [msg, setMsg]       = useState('');
  const twoFaEnabled = user?.two_fa_enabled;

  useEffect(() => { setStatus(twoFaEnabled ? 'enabled' : 'idle'); }, [twoFaEnabled]);

  const startSetup = async () => {
    setError(''); setMsg('');
    try { const res = await post('/api/auth/2fa/setup'); setQrUri(res.qrUri); setSecret(res.secret); setStatus('setup'); }
    catch (e) { setError(e.message); }
  };
  const confirm = async () => {
    if (code.length !== 6) { setError('Enter the 6-digit code from your authenticator app.'); return; }
    setError('');
    try { const res = await post('/api/auth/2fa/confirm', { code }); setBackupCodes(res.backupCodes || []); setStatus('confirmed'); setMsg('\u2713 Two-factor authentication enabled!'); }
    catch (e) { setError(e.message || 'Invalid code. Try again.'); }
  };
  const disable2fa = async () => {
    if (!window.confirm('Are you sure you want to disable two-factor authentication?')) return;
    setError(''); setMsg('');
    try { await post('/api/auth/2fa/disable', { code }); setStatus('idle'); setMsg('2FA disabled.'); setCode(''); }
    catch (e) { setError(e.message || 'Invalid code.'); }
  };
  const copyBackup = c => navigator.clipboard.writeText(c);
  const copyAllBackup = () => navigator.clipboard.writeText(backupCodes.join('\n'));

  return (
    <div style={{ maxWidth: 460 }}>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: '1.25rem', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: C.ink }}><Term id="2fa">Two-factor authentication</Term></div>
            <div style={{ fontSize: 13, color: C.inkMid, marginTop: 2 }}>Add a second layer of security to your account.</div>
          </div>
          <div style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: ['enabled','confirmed'].includes(status) ? '#D1FAE5' : '#FEE2E2', color: ['enabled','confirmed'].includes(status) ? C.green : C.red }}>
            {['enabled','confirmed'].includes(status) ? 'Enabled' : 'Disabled'}
          </div>
        </div>
      </div>
      {status === 'idle' && <><p style={{ fontSize: 13, color: C.inkMid, marginBottom: 12, lineHeight: 1.6 }}><Term id="2fa">2FA</Term> adds a second verification step when you sign in.</p><button onClick={startSetup} style={{ width: '100%', padding: '12px', background: C.amber, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Enable 2FA</button></>}
      {status === 'setup' && (
        <div>
          <p style={{ fontSize: 14, color: C.inkMid, marginBottom: 16 }}>Scan this QR code with <strong>Google Authenticator</strong> or any <Term id="totp">TOTP</Term> app.</p>
          <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, textAlign: 'center', marginBottom: 16 }}>
            {qrUri ? <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUri)}`} alt="2FA QR" width={180} height={180} style={{ imageRendering: 'pixelated' }} /> : <div style={{ width: 180, height: 180, background: C.surface, margin: '0 auto', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkLight }}>Loading\u2026</div>}
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, fontFamily: 'monospace', letterSpacing: '.1em', textAlign: 'center', marginBottom: 16, color: C.ink }}>{secret}</div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>Verification code</label>
          <input value={code} onChange={e => { setCode(e.target.value.replace(/\D/g,'').slice(0,6)); setError(''); }} placeholder="000000" maxLength={6} style={{ width: '100%', padding: '12px', border: `1px solid ${error ? C.red : C.border}`, borderRadius: 8, fontSize: 20, letterSpacing: '.25em', textAlign: 'center', boxSizing: 'border-box', marginBottom: 12 }} />
          {error && <p style={{ color: C.red, fontSize: 13, marginBottom: 8 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStatus('idle')} style={{ flex: 1, padding: 11, background: '#fff', color: C.ink, border: `1px solid ${C.border}`, borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={confirm} style={{ flex: 2, padding: 11, background: C.amber, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Verify & Enable</button>
          </div>
        </div>
      )}
      {status === 'confirmed' && backupCodes.length > 0 && (
        <div>
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <p style={{ fontWeight: 700, fontSize: 14, color: '#92400E', marginBottom: 8 }}>\u26a0\ufe0f Save your backup codes</p>
            <p style={{ fontSize: 13, color: C.inkMid, marginBottom: 12, lineHeight: 1.5 }}>Store these somewhere safe. Each code can only be used once if you lose access to your authenticator app.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
              {backupCodes.map(c => (
                <div key={c} onClick={() => copyBackup(c)} title="Click to copy" style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 10px', fontFamily: 'monospace', fontSize: 13, cursor: 'pointer', textAlign: 'center' }}>{c}</div>
              ))}
            </div>
            <button onClick={copyAllBackup} style={{ width: '100%', padding: 10, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Copy all backup codes</button>
          </div>
        </div>
      )}
      {status === 'enabled' && (
        <div>
          <p style={{ fontSize: 13, color: C.inkMid, marginBottom: 12, lineHeight: 1.6 }}>Two-factor authentication is active. Enter a code from your authenticator app to disable it.</p>
          <input value={code} onChange={e => { setCode(e.target.value.replace(/\D/g,'').slice(0,6)); setError(''); }} placeholder="000000" maxLength={6} style={{ width: '100%', padding: '12px', border: `1px solid ${error ? C.red : C.border}`, borderRadius: 8, fontSize: 20, letterSpacing: '.25em', textAlign: 'center', boxSizing: 'border-box', marginBottom: 12 }} />
          {error && <p style={{ color: C.red, fontSize: 13, marginBottom: 8 }}>{error}</p>}
          <button onClick={disable2fa} style={{ width: '100%', padding: 12, background: C.red, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Disable 2FA</button>
        </div>
      )}
      {msg && <p style={{ marginTop: 12, fontSize: 13, color: msg.startsWith('\u2713') ? C.green : C.red }}>{msg}</p>}
    </div>
  );
}

// ─── Credentials tab (Gap 4) ──────────────────────────────────────────────────
function TabCredentials() {
  const [creds, setCreds]   = useState({});
  const [saving, setSaving] = useState({});
  const [msgs, setMsgs]     = useState({});
  const [show, setShow]     = useState({});

  useEffect(() => {
    get('/api/credentials').then(d => {
      const map = {};
      (d.credentials || []).forEach(c => { map[c.service] = c.credential_value || ''; });
      setCreds(map);
    }).catch(() => {});
  }, []);

  const save = async key => {
    setSaving(s => ({ ...s, [key]: true })); setMsgs(m => ({ ...m, [key]: '' }));
    try {
      await post('/api/credentials', { service: key, credentialValue: creds[key] });
      setMsgs(m => ({ ...m, [key]: '\u2713 Saved' }));
    } catch (e) { setMsgs(m => ({ ...m, [key]: 'Error: ' + e.message })); }
    finally { setSaving(s => ({ ...s, [key]: false })); }
  };

  return (
    <div style={{ maxWidth: 520 }}>
      {CREDENTIAL_SERVICES.map(svc => (
        <div key={svc.key} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: '1.25rem', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 20 }}>{svc.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>{svc.label}</div>
              <div style={{ fontSize: 12, color: C.inkMid }}>{svc.description}</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.inkLight, marginBottom: 8 }}>
            {svc.hint} — <a href={svc.link} target="_blank" rel="noopener noreferrer" style={{ color: C.amber }}>Open \u2197</a>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type={show[svc.key] ? 'text' : 'password'}
                value={creds[svc.key] || ''}
                onChange={e => setCreds(c => ({ ...c, [svc.key]: e.target.value }))}
                placeholder={svc.placeholder}
                style={{ width: '100%', padding: '10px 36px 10px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
              />
              <button onClick={() => setShow(s => ({ ...s, [svc.key]: !s[svc.key] }))} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.inkLight, fontSize: 14, padding: 0 }}>
                {show[svc.key] ? '\ud83d\ude48' : '\ud83d\udc41\ufe0f'}
              </button>
            </div>
            <button onClick={() => save(svc.key)} disabled={saving[svc.key]} style={{ padding: '10px 16px', background: saving[svc.key] ? C.inkLight : C.amber, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: saving[svc.key] ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
              {saving[svc.key] ? '\u2026' : 'Save'}
            </button>
          </div>
          {msgs[svc.key] && <p style={{ marginTop: 8, fontSize: 12, color: msgs[svc.key].startsWith('\u2713') ? C.green : C.red }}>{msgs[svc.key]}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── Gap 6: Notifications tab ──────────────────────────────────────────────────

const NOTIF_GROUPS = [
  {
    label: 'Migration events',
    items: [
      { key: 'migration_complete', label: 'Migration complete', desc: 'Sent when your deployment finishes successfully.' },
      { key: 'migration_failed',   label: 'Migration failed',   desc: 'Sent if your deployment encounters an error.' },
    ],
  },
  {
    label: 'Billing',
    items: [
      { key: 'payment_confirmed', label: 'Payment confirmed', desc: 'Receipt sent immediately after payment.' },
      { key: 'refund_issued',     label: 'Refund issued',     desc: 'Notification when a refund is processed.' },
    ],
  },
  {
    label: 'Account',
    items: [
      { key: 'login_new_device',  label: 'New device sign-in', desc: 'Alert when your account is accessed from an unfamiliar device.' },
      { key: 'password_changed',  label: 'Password changed',   desc: 'Confirmation after a password reset.' },
    ],
  },
];

function TabNotifications() {
  const [prefs, setPrefs]   = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState('');

  useEffect(() => {
    get('/api/notifications').then(d => setPrefs(d.preferences || {})).catch(() => setPrefs({}));
  }, []);

  const toggle = key => setPrefs(p => ({ ...p, [key]: !p[key] }));

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      await put('/api/notifications', { preferences: prefs });
      setMsg('\u2713 Preferences saved');
    } catch (e) { setMsg('Error: ' + e.message); }
    finally { setSaving(false); }
  };

  if (!prefs) return <p style={{ color: C.inkLight, fontSize: 14 }}>Loading\u2026</p>;

  return (
    <div style={{ maxWidth: 520 }}>
      {NOTIF_GROUPS.map(group => (
        <div key={group.label} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.inkMid, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>{group.label}</h3>
          {group.items.map(item => (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 8 }}>
              <div style={{ paddingRight: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{item.label}</div>
                <div style={{ fontSize: 12, color: C.inkMid, marginTop: 2 }}>{item.desc}</div>
              </div>
              <Toggle on={!!prefs[item.key]} onChange={() => toggle(item.key)} />
            </div>
          ))}
        </div>
      ))}

      <button onClick={save} disabled={saving} style={{ padding: '11px 24px', background: saving ? C.inkLight : C.amber, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
        {saving ? 'Saving\u2026' : 'Save preferences'}
      </button>
      {msg && <p style={{ marginTop: 10, fontSize: 13, color: msg.startsWith('\u2713') ? C.green : C.red }}>{msg}</p>}

      {/* Unsubscribe note */}
      <p style={{ fontSize: 12, color: C.inkLight, marginTop: 14, lineHeight: 1.5 }}>
        All emails include an unsubscribe link. Transactional emails (migration complete/failed) cannot be disabled globally \u2014 they are only sent for your own migrations.
      </p>
    </div>
  );
}

// ─── Billing tab (Task 15) ───────────────────────────────────────────────────
function TabBilling() {
  const [invoices, setInvoices]   = useState([]);
  const [loading,  setLoading]    = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error,    setError]      = useState(null);

  useEffect(() => {
    get('/api/billing/invoices?limit=10')
      .then(d => setInvoices(d.invoices || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const { url } = await get('/api/billing/portal');
      window.location.href = url;
    } catch (e) {
      setError(e.message);
      setPortalLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>Billing &amp; Invoices</h2>
        <button onClick={openPortal} disabled={portalLoading}
          style={{ padding: '9px 18px', background: C.amber, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: portalLoading ? 'not-allowed' : 'pointer', opacity: portalLoading ? 0.7 : 1, fontSize: 14 }}>
          {portalLoading ? 'Opening\u2026' : 'Manage billing \u2192'}
        </button>
      </div>

      {error && <p style={{ color: C.red, fontSize: 13, marginBottom: 14 }}>{error}</p>}

      {loading ? (
        <p style={{ color: C.inkLight, fontSize: 14 }}>Loading invoices\u2026</p>
      ) : invoices.length === 0 ? (
        <p style={{ color: C.inkLight, fontSize: 14 }}>No invoices yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.border}`, textAlign: 'left' }}>
              <th style={{ padding: '8px 10px', color: C.inkMid, fontWeight: 600 }}>Date</th>
              <th style={{ padding: '8px 10px', color: C.inkMid, fontWeight: 600 }}>Repository</th>
              <th style={{ padding: '8px 10px', color: C.inkMid, fontWeight: 600 }}>Plan</th>
              <th style={{ padding: '8px 10px', color: C.inkMid, fontWeight: 600, textAlign: 'right' }}>Amount</th>
              <th style={{ padding: '8px 10px', color: C.inkMid, fontWeight: 600 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '10px 10px', color: C.inkMid }}>{new Date(inv.date).toLocaleDateString()}</td>
                <td style={{ padding: '10px 10px', color: C.ink, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.repoUrl}</td>
                <td style={{ padding: '10px 10px', color: C.inkMid, textTransform: 'capitalize' }}>{inv.plan}</td>
                <td style={{ padding: '10px 10px', color: C.ink, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  ${((inv.netCharged || 0) / 100).toFixed(2)}
                </td>
                <td style={{ padding: '10px 10px' }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: inv.status === 'success' ? C.greenBg : inv.status === 'refunded' ? C.blueBg : C.redBg,
                    color: inv.status === 'success' ? C.green : inv.status === 'refunded' ? C.blue : C.red,
                  }}>{inv.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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

  // Deep-link: /settings?tab=billing (or any other slug)
  useEffect(() => {
    const slug = router.query.tab;
    if (slug && TAB_SLUGS[slug] !== undefined) setTab(TAB_SLUGS[slug]);
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
          {tab === 3 && <TabNotifications />}
          {tab === 4 && <TabBilling />}
          {tab === 5 && <TabDanger onLogout={handleLogout} />}
        </div>
      </div>
    </>
  );
}
