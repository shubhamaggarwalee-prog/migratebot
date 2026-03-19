/**
 * pages/setup.jsx
 *
 * One-click MigrateBot deployment wizard
 * Accepts 5 API keys → streams real-time logs → redirects to dashboard
 */

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';

const KEYS = [
  { id: 'supabaseToken', label: 'Supabase Access Token', href: 'https://app.supabase.com/account/tokens', placeholder: 'sbp_...' },
  { id: 'stripeKey', label: 'Stripe Secret Key', href: 'https://dashboard.stripe.com/apikeys', placeholder: 'sk_test_...' },
  { id: 'railwayToken', label: 'Railway API Token', href: 'https://railway.app/account/tokens', placeholder: 'railway_...' },
  { id: 'vercelToken', label: 'Vercel API Token', href: 'https://vercel.com/account/tokens', placeholder: 'vercel_...' },
  { id: 'anthropicKey', label: 'Anthropic API Key', href: 'https://console.anthropic.com/account/keys', placeholder: 'sk-ant-...' },
];

export default function Setup() {
  const router = useRouter();
  const [values, setValues] = useState({});
  const [status, setStatus] = useState('input'); // input | deploying | success | error
  const [logs, setLogs] = useState([]);
  const [urls, setUrls] = useState({ frontend: '', backend: '', database: '' });
  const logsEndRef = useRef(null);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const handleDeploy = async () => {
    for (const k of KEYS) {
      if (!values[k.id]) { alert(`Please enter your ${k.label}`); return; }
    }
    setStatus('deploying');
    setLogs([]);

    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const entry = JSON.parse(line);
            setLogs(prev => [...prev, entry]);
            if (entry.message.startsWith('Frontend:')) setUrls(u => ({ ...u, frontend: entry.message.split(': ')[1] }));
            if (entry.message.startsWith('Backend:')) setUrls(u => ({ ...u, backend: entry.message.split(':  ')[1] }));
            if (entry.message.startsWith('Database:')) setUrls(u => ({ ...u, database: entry.message.split(': ')[1] }));
            if (entry.message.includes('Deployment complete')) setStatus('success');
            if (entry.message.includes('✗ Error')) setStatus('error');
          } catch (_) {}
        }
      }
    } catch (err) {
      setLogs(prev => [...prev, { message: `Network error: ${err.message}`, type: 'error' }]);
      setStatus('error');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F4', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: 600 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>⚡</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, color: '#1A1814', margin: 0 }}>MigrateBot Setup</h1>
          <p style={{ color: '#6B6860', marginTop: 8 }}>One-click production deployment — under 5 minutes</p>
        </div>

        {/* INPUT FORM */}
        {(status === 'input') && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E2DA', padding: '2rem' }}>
            <p style={{ color: '#6B6860', marginBottom: '1.5rem', fontSize: 14 }}>Enter your 5 API keys below. Click the <strong>?</strong> links to get each one.</p>
            {KEYS.map(k => (
              <div key={k.id} style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: '#1A1814', marginBottom: 6 }}>
                  {k.label}
                  <a href={k.href} target="_blank" rel="noreferrer" style={{ color: '#D97706', textDecoration: 'none', fontWeight: 400 }}>Get key →</a>
                </label>
                <input
                  type="password"
                  placeholder={k.placeholder}
                  value={values[k.id] || ''}
                  onChange={e => setValues(v => ({ ...v, [k.id]: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E2DA', borderRadius: 8, fontSize: 14, background: '#FAFAF8', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
            ))}
            <button
              onClick={handleDeploy}
              style={{ width: '100%', padding: '12px', background: '#D97706', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: '0.5rem' }}
            >
              🚀 Deploy to Production
            </button>
            <p style={{ fontSize: 12, color: '#9B9890', textAlign: 'center', marginTop: 12 }}>Creates Supabase + Stripe + Railway + Vercel automatically</p>
          </div>
        )}

        {/* DEPLOYING / SUCCESS / ERROR — Terminal Log */}
        {(status === 'deploying' || status === 'success' || status === 'error') && (
          <div style={{ background: '#111', borderRadius: 12, padding: '1.5rem', minHeight: 320 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: '#6B6860', fontFamily: 'monospace' }}>// deployment log</span>
              {status === 'deploying' && <span style={{ fontSize: 12, color: '#D97706' }}>● running...</span>}
              {status === 'success' && <span style={{ fontSize: 12, color: '#059669' }}>● complete!</span>}
              {status === 'error' && <span style={{ fontSize: 12, color: '#DC2626' }}>● failed</span>}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 1.8, maxHeight: 360, overflowY: 'auto' }}>
              {logs.map((l, i) => (
                <div key={i} style={{ color: l.type === 'success' ? '#4ade80' : l.type === 'error' ? '#f87171' : '#a3a3a3' }}>
                  {l.message}
                </div>
              ))}
              {status === 'deploying' && <div style={{ color: '#D97706' }}>▌</div>}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

        {/* SUCCESS URLS */}
        {status === 'success' && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E2DA', padding: '1.5rem', marginTop: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem', color: '#1A1814', fontSize: 16 }}>🎉 MigrateBot is Live!</h3>
            {urls.frontend && <UrlRow label="Frontend" url={urls.frontend} />}
            {urls.backend && <UrlRow label="Backend" url={urls.backend} />}
            {urls.database && <UrlRow label="Database" url={urls.database} />}
            <div style={{ display: 'flex', gap: 10, marginTop: '1.5rem' }}>
              <button onClick={() => router.push('/dashboard')} style={{ flex: 1, padding: '10px', background: '#D97706', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Go to Dashboard →</button>
              {urls.frontend && <button onClick={() => window.open(urls.frontend)} style={{ flex: 1, padding: '10px', background: '#F8F7F4', color: '#1A1814', border: '1px solid #E5E2DA', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Visit Site ↗</button>}
            </div>
          </div>
        )}

        {/* ERROR RETRY */}
        {status === 'error' && (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button onClick={() => { setStatus('input'); setLogs([]); }} style={{ padding: '10px 24px', background: '#F8F7F4', color: '#1A1814', border: '1px solid #E5E2DA', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Try Again</button>
          </div>
        )}

      </div>
    </div>
  );
}

function UrlRow({ label, url }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F0EDE6' }}>
      <span style={{ fontSize: 13, color: '#6B6860', minWidth: 70 }}>{label}</span>
      <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#D97706', textDecoration: 'none', flex: 1, margin: '0 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</a>
      <button onClick={copy} style={{ fontSize: 12, padding: '4px 10px', background: copied ? '#059669' : '#F0EDE6', color: copied ? '#fff' : '#1A1814', border: 'none', borderRadius: 6, cursor: 'pointer' }}>{copied ? '✓' : 'Copy'}</button>
    </div>
  );
}
