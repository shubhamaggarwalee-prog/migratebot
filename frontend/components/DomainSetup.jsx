/**
 * frontend/components/DomainSetup.jsx
 * Gap 3: In-product guided domain setup wizard.
 *
 * Shown on the migration detail page for completed migrations.
 * Walks the user through:
 *   Step 1 — Enter their domain name
 *   Step 2 — Add it to Vercel via the MigrateBot API (POST /api/migrations/:id/domain)
 *   Step 3 — Shows the exact DNS records (CNAME + A Record) to copy into their registrar
 *   Step 4 — Verify the domain is live (GET /api/migrations/:id/domain/verify)
 *
 * No login to Vercel needed — the user's stored Vercel token is used server-side.
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

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: C.inkLight, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 8, padding: '9px 12px',
      }}>
        <code style={{ flex: 1, fontSize: 13, color: C.ink, wordBreak: 'break-all', fontFamily: 'monospace' }}>{value}</code>
        <button
          onClick={copy}
          style={{
            flexShrink: 0, padding: '4px 12px',
            background: copied ? C.green : C.amber,
            color: '#fff', border: 'none', borderRadius: 6,
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            transition: 'background .15s',
          }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

function StepDot({ n, active, done }) {
  const bg    = done ? C.green : active ? C.amber : C.border;
  const color = done || active ? '#fff' : C.inkLight;
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      background: bg, color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: 13, flexShrink: 0,
      transition: 'background .2s',
    }}>
      {done ? '✓' : n}
    </div>
  );
}

export default function DomainSetup({ migrationId }) {
  const [open,    setOpen]    = useState(false);
  const [step,    setStep]    = useState(1);
  const [domain,  setDomain]  = useState('');
  const [dns,     setDns]     = useState(null);   // { cname, aRecord, vercelDomain }
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const isValidDomain = d => /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(d.trim());

  // Step 2 — add domain to Vercel via backend
  const addDomain = async () => {
    if (!isValidDomain(domain)) {
      setError('Please enter a valid domain name, e.g. myapp.com');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await apiClient.post(`/api/migrations/${migrationId}/domain`, {
        domain: domain.trim().toLowerCase(),
      });
      // Backend returns Vercel's DNS config
      setDns({
        cname:         res.cname         || 'cname.vercel-dns.com',
        aRecord:       res.aRecord       || '76.76.21.21',
        vercelDomain:  res.vercelDomain  || domain.trim(),
      });
      setStep(3);
    } catch (e) {
      setError(e.message || 'Failed to add domain. Please check the domain name and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 4 — verify DNS propagation
  const verifyDomain = async () => {
    setVerifying(true);
    setError('');
    try {
      const res = await apiClient.get(`/api/migrations/${migrationId}/domain/verify?domain=${encodeURIComponent(domain)}`);
      if (res.verified) {
        setVerified(true);
        setStep(4);
      } else {
        setError('Domain not yet verified. DNS changes can take up to 30 minutes to propagate. Try again shortly.');
      }
    } catch (e) {
      setError(e.message || 'Could not check domain status. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const reset = () => {
    setStep(1); setDomain(''); setDns(null);
    setError(''); setVerified(false); setLoading(false);
  };

  const STEPS = ['Enter domain', 'Add to Vercel', 'Copy DNS records', 'Verify'];

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {/* Collapsed trigger */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            width: '100%', padding: '14px 20px',
            background: '#fff', border: `2px solid ${C.blue}`,
            borderRadius: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 24 }}>🌐</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>Add a custom domain</div>
            <div style={{ fontSize: 12, color: C.inkMid, marginTop: 2 }}>
              Replace <code style={{ background: C.surface, padding: '1px 5px', borderRadius: 4 }}>yourapp.vercel.app</code> with your own address like <code style={{ background: C.surface, padding: '1px 5px', borderRadius: 4 }}>myapp.com</code> — guided, no technical knowledge needed
            </div>
          </div>
          <span style={{ color: C.blue, fontSize: 18, flexShrink: 0 }}>▼</span>
        </button>
      )}

      {/* Expanded wizard */}
      {open && (
        <div style={{
          background: '#fff', borderRadius: 14,
          border: `2px solid ${C.blue}`,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            background: C.blueBg, padding: '14px 20px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🌐</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>Add a custom domain</div>
                <div style={{ fontSize: 11, color: C.inkMid }}>
                  Step {step} of {STEPS.length} — {STEPS[step - 1]}
                </div>
              </div>
            </div>
            <button
              onClick={() => { setOpen(false); reset(); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.inkLight, fontSize: 20 }}
            >×</button>
          </div>

          {/* Step progress */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 0,
            padding: '14px 20px', borderBottom: `1px solid ${C.border}`,
            overflowX: 'auto',
          }}>
            {STEPS.map((label, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <StepDot n={i + 1} active={step === i + 1} done={step > i + 1 || (i === 3 && verified)} />
                  <span style={{ fontSize: 10, color: step === i + 1 ? C.amber : C.inkLight, fontWeight: step === i + 1 ? 700 : 400, whiteSpace: 'nowrap' }}>{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ width: 40, height: 2, background: step > i + 1 ? C.green : C.border, margin: '0 6px', marginBottom: 18, flexShrink: 0 }} />
                )}
              </div>
            ))}
          </div>

          {/* Step body */}
          <div style={{ padding: '22px 24px' }}>

            {/* Error */}
            {error && (
              <div style={{ background: C.redBg, border: `1px solid ${C.red}33`, borderRadius: 8, padding: '10px 14px', color: C.red, fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            {/* ── Step 1: Enter domain ── */}
            {step === 1 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: C.ink, marginBottom: 6 }}>📝 What domain do you want to use?</div>
                <p style={{ fontSize: 13, color: C.inkMid, marginBottom: 18, lineHeight: 1.6 }}>
                  This is the web address you want people to type to reach your app.
                  If you don’t have one yet, you can buy one at <a href="https://domains.google" target="_blank" rel="noreferrer" style={{ color: C.amber }}>Google Domains</a> or <a href="https://www.namecheap.com" target="_blank" rel="noreferrer" style={{ color: C.amber }}>Namecheap</a> for around $10–15/year.
                </p>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6 }}>
                  Your domain name
                </label>
                <input
                  type="text"
                  value={domain}
                  onChange={e => { setDomain(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && domain && setStep(2)}
                  placeholder="e.g. myapp.com or app.mybusiness.com"
                  style={{
                    width: '100%', padding: '11px 14px',
                    border: `1.5px solid ${C.border}`, borderRadius: 8,
                    fontSize: 15, outline: 'none', fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
                  <button
                    onClick={() => {
                      if (!domain.trim()) { setError('Please enter a domain name.'); return; }
                      if (!isValidDomain(domain)) { setError('That doesn’t look like a valid domain. Example: myapp.com'); return; }
                      setError(''); setStep(2);
                    }}
                    style={{ padding: '11px 28px', background: C.blue, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 2: Confirm + add to Vercel ── */}
            {step === 2 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: C.ink, marginBottom: 6 }}>✔️ Confirm your domain</div>
                <p style={{ fontSize: 13, color: C.inkMid, marginBottom: 16, lineHeight: 1.6 }}>
                  We’ll add <strong>{domain}</strong> to your Vercel project now using your stored Vercel token.
                  This takes about 5 seconds. You won’t need to log in to Vercel.
                </p>
                <div style={{
                  background: C.blueBg, border: `1px solid ${C.blue}33`,
                  borderRadius: 10, padding: '12px 16px', marginBottom: 20,
                  display: 'flex', gap: 12, alignItems: 'center',
                }}>
                  <span style={{ fontSize: 22 }}>🌐</span>
                  <span style={{ fontWeight: 700, fontSize: 16, color: C.blue }}>{domain}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    onClick={() => { setStep(1); setError(''); }}
                    style={{ background: 'none', border: 'none', color: C.inkMid, cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}
                  >
                    ← Change domain
                  </button>
                  <button
                    onClick={addDomain}
                    disabled={loading}
                    style={{ padding: '11px 28px', background: loading ? C.border : C.blue, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: loading ? 'default' : 'pointer' }}
                  >
                    {loading ? 'Adding…' : 'Add domain →'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 3: DNS records ── */}
            {step === 3 && dns && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: C.ink, marginBottom: 6 }}>📋 Copy these two settings into your domain registrar</div>
                <p style={{ fontSize: 13, color: C.inkMid, marginBottom: 16, lineHeight: 1.6 }}>
                  Log in to where you bought your domain (e.g. Google Domains, Namecheap, GoDaddy), find the <strong>DNS Settings</strong> section, and add these two records exactly as shown.
                </p>

                <div style={{
                  background: C.amberBg, border: `1px solid ${C.amber}44`,
                  borderRadius: 10, padding: '14px 16px', marginBottom: 18,
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.amberDark, marginBottom: 12 }}>📌 Record 1 — CNAME (points your domain to Vercel)</div>
                  <CopyField label="Type" value="CNAME" />
                  <CopyField label="Name / Host" value="www" />
                  <CopyField label="Value / Points to" value={dns.cname} />
                </div>

                <div style={{
                  background: C.blueBg, border: `1px solid ${C.blue}33`,
                  borderRadius: 10, padding: '14px 16px', marginBottom: 18,
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.blue, marginBottom: 12 }}>📌 Record 2 — A Record (root domain, e.g. myapp.com without www)</div>
                  <CopyField label="Type" value="A" />
                  <CopyField label="Name / Host" value="@" />
                  <CopyField label="Value / IP Address" value={dns.aRecord} />
                </div>

                <div style={{
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: '10px 14px', fontSize: 13,
                  color: C.inkMid, lineHeight: 1.6, marginBottom: 20,
                }}>
                  ⏳ <strong>DNS changes take 10–30 minutes</strong> to take effect globally (sometimes up to 24 hours).
                  Once you’ve saved those two records, come back here and click <strong>“Check if it’s live”</strong>.
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <a
                    href="mailto:support@migratebot.io?subject=Help with DNS setup"
                    style={{ fontSize: 13, color: C.inkMid, textDecoration: 'underline' }}
                  >
                    👋 Need help? Email us
                  </a>
                  <button
                    onClick={verifyDomain}
                    disabled={verifying}
                    style={{ padding: '11px 28px', background: verifying ? C.border : C.green, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: verifying ? 'default' : 'pointer' }}
                  >
                    {verifying ? 'Checking…' : '✔ Check if it’s live'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 4: Verified! ── */}
            {step === 4 && verified && (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{ fontSize: 52, marginBottom: 10 }}>🎉</div>
                <div style={{ fontWeight: 700, fontSize: 20, color: C.green, marginBottom: 8 }}>Domain is live!</div>
                <p style={{ fontSize: 14, color: C.inkMid, marginBottom: 20, lineHeight: 1.6 }}>
                  <strong>{domain}</strong> is now pointing to your app.
                  SSL (the padlock 🔒) is handled automatically by Vercel — no action needed.
                </p>
                <a
                  href={`https://${domain}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-block', padding: '12px 28px',
                    background: C.green, color: '#fff',
                    borderRadius: 10, fontWeight: 700, fontSize: 15,
                    textDecoration: 'none', marginBottom: 16,
                  }}
                >
                  🌐 Open https://{domain} ↗
                </a>
                <div>
                  <button
                    onClick={() => { reset(); setOpen(false); }}
                    style={{ background: 'none', border: 'none', color: C.inkMid, cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
