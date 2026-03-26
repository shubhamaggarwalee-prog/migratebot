/**
 * frontend/components/CredentialRetry.jsx
 * Gap 4: Shown on a failed migration detail page.
 *
 * - Detects which credential likely caused the failure (from error_message)
 * - Lets the user update just that one key (or any key)
 * - POSTs the updated key to /api/credentials (PATCH, per-service)
 * - Then POSTs to /api/migrations/:id/retry to re-run the migration
 * - No need to start a brand new migration and pay again
 */
import { useState } from 'react';
import { apiClient } from '../lib/api';

const C = {
  amber: '#D97706', amberBg: '#FEF3C7', amberDark: '#B45309',
  ink: '#1A1814', inkMid: '#5C574E', inkLight: '#9B958A',
  border: '#E5E2DA', surface: '#F8F7F4',
  green: '#059669', greenBg: '#D1FAE5',
  red: '#DC2626', redBg: '#FEE2E2',
  blue: '#2563EB', blueBg: '#DBEAFE',
};

const SERVICES = [
  {
    key: 'anthropic',
    label: 'Anthropic',
    icon: '\ud83e\udd16',
    placeholder: 'sk-ant-api03-...',
    hint: 'Get it at console.anthropic.com \u2192 API Keys',
    link: 'https://console.anthropic.com/',
    errorKeywords: ['anthropic', 'claude', 'api key', 'sk-ant'],
  },
  {
    key: 'supabase',
    label: 'Supabase',
    icon: '\ud83d\uddc4\ufe0f',
    placeholder: 'sbp_...',
    hint: 'Get it at app.supabase.com \u2192 Account \u2192 Access Tokens',
    link: 'https://app.supabase.com/account/tokens',
    errorKeywords: ['supabase', 'database', 'postgres', 'sbp_'],
  },
  {
    key: 'vercel',
    label: 'Vercel',
    icon: '\u25b2',
    placeholder: 'vercel token...',
    hint: 'Get it at vercel.com/account/tokens',
    link: 'https://vercel.com/account/tokens',
    errorKeywords: ['vercel', 'deployment', 'frontend', 'vercel token'],
  },
  {
    key: 'railway',
    label: 'Railway',
    icon: '\ud83d\ude82',
    placeholder: 'railway token...',
    hint: 'Get it at railway.app/account/tokens',
    link: 'https://railway.app/account/tokens',
    errorKeywords: ['railway', 'backend', 'server', 'railway token'],
  },
];

// Guess which service caused the error from the error message text
function guessService(errorMessage) {
  if (!errorMessage) return null;
  const lower = errorMessage.toLowerCase();
  for (const s of SERVICES) {
    if (s.errorKeywords.some(k => lower.includes(k))) return s.key;
  }
  return null;
}

export default function CredentialRetry({ migrationId, errorMessage, onRetryStarted }) {
  const guessed = guessService(errorMessage);
  const [open,        setOpen]        = useState(false);
  const [activeKey,   setActiveKey]   = useState(guessed || 'anthropic');
  const [values,      setValues]      = useState({});
  const [show,        setShow]        = useState({});
  const [saving,      setSaving]      = useState(false);
  const [retrying,    setRetrying]    = useState(false);
  const [savedKeys,   setSavedKeys]   = useState([]);
  const [error,       setError]       = useState('');
  const [successMsg,  setSuccessMsg]  = useState('');

  const activeService = SERVICES.find(s => s.key === activeKey);

  const updateValue = (key, val) => setValues(v => ({ ...v, [key]: val }));
  const toggleShow  = (key) => setShow(s => ({ ...s, [key]: !s[key] }));

  const saveKey = async (serviceKey) => {
    const val = (values[serviceKey] || '').trim();
    if (!val) { setError('Please paste your new API key before saving.'); return; }
    setError(''); setSaving(true); setSuccessMsg('');
    try {
      await apiClient.patch('/api/credentials', { service: serviceKey, token: val });
      setSavedKeys(prev => [...new Set([...prev, serviceKey])]);
      setSuccessMsg(`\u2713 ${SERVICES.find(s => s.key === serviceKey)?.label} key updated.`);
    } catch (e) {
      setError(e.message || 'Failed to save key. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const retryMigration = async () => {
    setError(''); setRetrying(true);
    try {
      await apiClient.post(`/api/migrations/${migrationId}/retry`);
      if (onRetryStarted) onRetryStarted();
    } catch (e) {
      setError(e.message || 'Failed to start retry. Please try again.');
      setRetrying(false);
    }
  };

  return (
    <div style={{ marginBottom: '1.5rem' }}>

      {/* Collapsed trigger */}
      {!open && (
        <div style={{
          background: C.redBg, border: `2px solid ${C.red}`,
          borderRadius: 12, padding: '16px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>\ud83d\udd11</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.red, marginBottom: 2 }}>
                Fix & retry this migration
              </div>
              <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.5 }}>
                Update a credential and re-run — no need to pay again.
                {guessed && (
                  <span> The error suggests the <strong>{SERVICES.find(s => s.key === guessed)?.label}</strong> key may need updating.</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setOpen(true)}
            style={{
              flexShrink: 0, padding: '10px 20px',
              background: C.red, color: '#fff',
              border: 'none', borderRadius: 8,
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            Fix & Retry \u2192
          </button>
        </div>
      )}

      {/* Expanded panel */}
      {open && (
        <div style={{ background: '#fff', borderRadius: 14, border: `2px solid ${C.red}`, overflow: 'hidden' }}>

          {/* Header */}
          <div style={{
            background: C.redBg, padding: '14px 20px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>\ud83d\udd11</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>Fix a credential & retry</div>
                <div style={{ fontSize: 12, color: C.inkMid }}>Update any wrong key, then retry your migration — free.</div>
              </div>
            </div>
            <button
              onClick={() => { setOpen(false); setError(''); setSuccessMsg(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.inkLight, fontSize: 20 }}
            >\u00d7</button>
          </div>

          <div style={{ padding: '20px 24px' }}>

            {/* Error hint */}
            {errorMessage && (
              <div style={{
                background: C.redBg, border: `1px solid ${C.red}33`,
                borderRadius: 8, padding: '10px 14px',
                fontSize: 13, color: C.red, marginBottom: 18, lineHeight: 1.5,
              }}>
                <strong>Error:</strong> {errorMessage}
              </div>
            )}

            {/* Service selector tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
              {SERVICES.map(s => (
                <button
                  key={s.key}
                  onClick={() => { setActiveKey(s.key); setError(''); setSuccessMsg(''); }}
                  style={{
                    padding: '7px 14px', borderRadius: 20,
                    border: `1.5px solid ${activeKey === s.key ? C.amber : C.border}`,
                    background: activeKey === s.key ? C.amberBg : '#fff',
                    color: activeKey === s.key ? C.amberDark : C.inkMid,
                    fontWeight: activeKey === s.key ? 700 : 400,
                    fontSize: 13, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    position: 'relative',
                  }}
                >
                  <span>{s.icon}</span> {s.label}
                  {savedKeys.includes(s.key) && (
                    <span style={{
                      width: 7, height: 7, background: C.green,
                      borderRadius: '50%', display: 'inline-block',
                    }} />
                  )}
                  {s.key === guessed && !savedKeys.includes(s.key) && (
                    <span style={{
                      width: 7, height: 7, background: C.red,
                      borderRadius: '50%', display: 'inline-block',
                    }} />
                  )}
                </button>
              ))}
            </div>

            {/* Active service key input */}
            {activeService && (
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 12, padding: '16px 18px', marginBottom: 18,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18 }}>{activeService.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>{activeService.label}</span>
                  {savedKeys.includes(activeService.key) && (
                    <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>\u2713 Saved</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: C.inkMid, marginBottom: 12 }}>
                  {activeService.hint}{' '}
                  <a href={activeService.link} target="_blank" rel="noreferrer" style={{ color: C.amber }}>Get key \u2197</a>
                </div>

                <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6 }}>
                  New {activeService.label} API Key
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type={show[activeService.key] ? 'text' : 'password'}
                    value={values[activeService.key] || ''}
                    onChange={e => { updateValue(activeService.key, e.target.value); setError(''); }}
                    placeholder={activeService.placeholder}
                    style={{
                      flex: 1, padding: '10px 12px',
                      border: `1.5px solid ${C.border}`, borderRadius: 8,
                      fontSize: 13, fontFamily: 'monospace', outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => toggleShow(activeService.key)}
                    title={show[activeService.key] ? 'Hide' : 'Show'}
                    style={{ padding: '8px 12px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
                  >
                    {show[activeService.key] ? '\ud83d\ude48' : '\ud83d\udc41\ufe0f'}
                  </button>
                  <button
                    onClick={() => saveKey(activeService.key)}
                    disabled={saving || !values[activeService.key]?.trim()}
                    style={{
                      padding: '10px 18px',
                      background: saving || !values[activeService.key]?.trim() ? C.border : C.amber,
                      color: '#fff', border: 'none', borderRadius: 8,
                      fontWeight: 700, fontSize: 13,
                      cursor: saving || !values[activeService.key]?.trim() ? 'default' : 'pointer',
                    }}
                  >
                    {saving ? '\u2026' : 'Save'}
                  </button>
                </div>
              </div>
            )}

            {/* Feedback messages */}
            {error      && <div style={{ background: C.redBg, border: `1px solid ${C.red}33`, borderRadius: 8, padding: '10px 14px', color: C.red, fontSize: 13, marginBottom: 14 }}>{error}</div>}
            {successMsg && <div style={{ background: C.greenBg, border: `1px solid ${C.green}33`, borderRadius: 8, padding: '10px 14px', color: C.green, fontSize: 13, marginBottom: 14 }}>{successMsg}</div>}

            {/* Retry button */}
            <div style={{
              borderTop: `1px solid ${C.border}`, paddingTop: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
            }}>
              <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.5 }}>
                {savedKeys.length > 0
                  ? <span>\u2705 {savedKeys.length} credential{savedKeys.length > 1 ? 's' : ''} updated. Ready to retry.</span>
                  : <span>Update at least one key above, then retry.</span>}
              </div>
              <button
                onClick={retryMigration}
                disabled={retrying || savedKeys.length === 0}
                style={{
                  flexShrink: 0, padding: '12px 24px',
                  background: retrying || savedKeys.length === 0 ? C.border : C.green,
                  color: '#fff', border: 'none', borderRadius: 10,
                  fontWeight: 700, fontSize: 14,
                  cursor: retrying || savedKeys.length === 0 ? 'default' : 'pointer',
                  boxShadow: savedKeys.length > 0 && !retrying ? '0 4px 14px rgba(5,150,105,.25)' : 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {retrying ? 'Starting\u2026' : '\u{1F501} Retry Migration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
