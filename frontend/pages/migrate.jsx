/**
 * frontend/pages/migrate.jsx
 * Full 5-step migration wizard.
 * Steps: 0 Source → 1 Configure → 2 Pay → 3 Running → 4 Done
 */
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { migrations, credentials, token } from '../lib/api';
import { useWizardStore } from '../lib/store';
import { useMigrationSocket } from '../hooks/useSocket';
import { useCredentials } from '../hooks/useData';

const C = {
  amber: '#D97706', amberBg: '#FEF3C7', ink: '#1A1814',
  inkMid: '#5C574E', inkLight: '#9B958A', border: '#E5E2DA',
  surface: '#F8F7F4', green: '#059669', red: '#DC2626',
};

const STEPS = ['Source', 'Configure', 'Payment', 'Running', 'Done'];

const SOURCES = [
  { id: 'github',   label: 'GitHub',   icon: '🐙', desc: 'Public or private GitHub repo' },
  { id: 'replit',   label: 'Replit',   icon: '🔄', desc: 'Import directly from Replit' },
  { id: 'emergent', label: 'Emergent', icon: '⚡', desc: 'Emergent / other hosted source' },
  { id: 'url',      label: 'Git URL',  icon: '🔗', desc: 'Any public git repository URL' },
];

const PLATFORMS = [
  { id: 'supabase', label: 'Supabase', icon: '🔋', desc: 'Database + Auth' },
  { id: 'vercel',   label: 'Vercel',   icon: '▲',  desc: 'Frontend hosting' },
  { id: 'railway',  label: 'Railway',  icon: '🚂', desc: 'Backend hosting' },
];

function StepBar({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 36 }}>
      {STEPS.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0,
            background: i < step ? C.green : i === step ? C.amber : C.border,
            color: i <= step ? '#fff' : C.inkLight,
          }}>{i < step ? '✓' : i + 1}</div>
          <div style={{ fontSize: 11, color: i === step ? C.ink : C.inkLight, fontWeight: i === step ? 600 : 400, marginLeft: 6, whiteSpace: 'nowrap' }}>{s}</div>
          {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, background: i < step ? C.green : C.border, margin: '0 8px' }} />}
        </div>
      ))}
    </div>
  );
}

// ─── Step 0: Source selection ─────────────────────────────────────────────────
function StepSource({ onNext }) {
  const { repoUrl, setRepoUrl, branch, setBranch } = useWizardStore();
  const [source, setSource] = useState('github');
  const [replitToken, setReplitToken] = useState('');
  const [error, setError] = useState('');

  const validate = () => {
    if (!repoUrl.trim()) return 'Please enter a repository URL or Repl name.';
    if (source === 'replit' && !replitToken.trim()) return 'Replit API token is required for private repls.';
    return '';
  };

  const handleNext = () => {
    const err = validate();
    if (err) { setError(err); return; }
    if (source === 'replit' && replitToken) {
      sessionStorage.setItem('mb_replit_token', replitToken);
    }
    onNext();
  };

  return (
    <div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: C.ink, marginBottom: 8 }}>Where's your code?</h2>
      <p style={{ color: C.inkMid, fontSize: 14, marginBottom: 24 }}>Select your source and paste the repo URL or identifier.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        {SOURCES.map(s => (
          <button key={s.id} onClick={() => setSource(s.id)} style={{
            padding: '12px 14px', borderRadius: 10, border: `2px solid ${source === s.id ? C.amber : C.border}`,
            background: source === s.id ? C.amberBg : '#fff', cursor: 'pointer', textAlign: 'left',
            transition: 'all .15s',
          }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 13, color: C.ink }}>{s.label}</div>
            <div style={{ fontSize: 11, color: C.inkMid, marginTop: 2 }}>{s.desc}</div>
          </button>
        ))}
      </div>

      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>
        {source === 'replit' ? 'Repl name or URL' : source === 'emergent' ? 'Project URL' : 'Repository URL'}
      </label>
      <input
        value={repoUrl}
        onChange={e => { setRepoUrl(e.target.value); setError(''); }}
        placeholder={
          source === 'github'   ? 'https://github.com/you/your-repo' :
          source === 'replit'   ? 'https://replit.com/@you/your-repl' :
          source === 'emergent' ? 'https://emergent.sh/projects/...' :
          'https://git.example.com/repo.git'
        }
        style={{ width: '100%', padding: '10px 12px', border: `1px solid ${error ? C.red : C.border}`, borderRadius: 8, fontSize: 14, boxSizing: 'border-box', marginBottom: 12 }}
      />

      {source === 'replit' && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>
            Replit API Token <span style={{ color: C.inkLight, fontWeight: 400 }}>(for private repls)</span>
          </label>
          <input
            type="password"
            value={replitToken}
            onChange={e => setReplitToken(e.target.value)}
            placeholder="Paste your Replit API token"
            style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
          />
          <p style={{ fontSize: 11, color: C.inkMid, marginTop: 4 }}>
            Get it at replit.com/account → API tokens. Never stored permanently.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap' }}>Branch</label>
        <input
          value={branch}
          onChange={e => setBranch(e.target.value)}
          placeholder="main"
          style={{ flex: 1, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14 }}
        />
      </div>

      {error && <p style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <button onClick={handleNext} style={{
        width: '100%', padding: '12px', background: C.amber, color: '#fff',
        border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer',
      }}>Continue →</button>
    </div>
  );
}

// ─── Step 1: Configure platforms ─────────────────────────────────────────────
function StepConfigure({ onNext, onBack, setMigId }) {
  const { platforms, setPlatform, plan, setPlan, repoUrl, branch } = useWizardStore();
  const { credMap } = useCredentials();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedPlatforms = Object.entries(platforms).filter(([, v]) => v).map(([k]) => k);
  const missingCreds = selectedPlatforms.filter(p => !credMap[p]);

  const handleStart = async () => {
    if (selectedPlatforms.length === 0) { setError('Select at least one target platform.'); return; }
    if (missingCreds.length > 0) { setError(`Missing credentials for: ${missingCreds.join(', ')}. Add them in Settings → API Tokens.`); return; }
    setLoading(true); setError('');
    try {
      const res = await migrations.create(repoUrl, selectedPlatforms, plan, branch);
      setMigId(res.migration.id);
      onNext();
    } catch (e) {
      setError(e.message || 'Failed to create migration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: C.ink, marginBottom: 8 }}>Configure migration</h2>
      <p style={{ color: C.inkMid, fontSize: 14, marginBottom: 24 }}>Choose your target platforms and plan.</p>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 10 }}>Target platforms</label>
        {PLATFORMS.map(p => (
          <label key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
            borderRadius: 10, border: `2px solid ${platforms[p.id] ? C.amber : C.border}`,
            background: platforms[p.id] ? C.amberBg : '#fff', cursor: 'pointer', marginBottom: 8,
          }}>
            <input type="checkbox" checked={!!platforms[p.id]} onChange={e => setPlatform(p.id, e.target.checked)}
              style={{ width: 16, height: 16, accentColor: C.amber }} />
            <span style={{ fontSize: 18 }}>{p.icon}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: C.ink }}>{p.label}</div>
              <div style={{ fontSize: 11, color: C.inkMid }}>{p.desc}</div>
            </div>
            {!credMap[p.id] && platforms[p.id] && (
              <span style={{ marginLeft: 'auto', fontSize: 11, color: C.red, fontWeight: 600 }}>⚠ No token</span>
            )}
          </label>
        ))}
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 10 }}>Plan</label>
        {[{ id: 'starter', label: 'Starter', price: '$100', desc: 'Up to 3 platforms, standard queue' },
          { id: 'pro', label: 'Pro', price: '$250', desc: 'Priority queue, all platforms, dedicated support' }].map(p => (
          <label key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
            borderRadius: 10, border: `2px solid ${plan === p.id ? C.amber : C.border}`,
            background: plan === p.id ? C.amberBg : '#fff', cursor: 'pointer', marginBottom: 8,
          }}>
            <input type="radio" name="plan" checked={plan === p.id} onChange={() => setPlan(p.id)}
              style={{ accentColor: C.amber }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: C.ink }}>{p.label} — {p.price}</div>
              <div style={{ fontSize: 11, color: C.inkMid }}>{p.desc}</div>
            </div>
          </label>
        ))}
      </div>

      {error && <p style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onBack} style={{ flex: 1, padding: 12, background: '#fff', color: C.ink, border: `1px solid ${C.border}`, borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>← Back</button>
        <button onClick={handleStart} disabled={loading} style={{
          flex: 2, padding: 12, background: loading ? C.inkLight : C.amber, color: '#fff',
          border: 'none', borderRadius: 8, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
        }}>{loading ? 'Creating…' : 'Continue →'}</button>
      </div>
    </div>
  );
}

// ─── Step 2: Payment ─────────────────────────────────────────────────────────
function StepPayment({ onNext, onBack, migrationId }) {
  const { plan, setPayment } = useWizardStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const price = plan === 'pro' ? '$250' : '$100';

  const handlePay = async () => {
    setLoading(true); setError('');
    try {
      const res = await migrations.createPaymentIntent(migrationId);
      setPayment(res.paymentIntentId, res.clientSecret);
      // Start migration immediately after payment intent created
      await migrations.start(migrationId);
      onNext();
    } catch (e) {
      setError(e.message || 'Payment failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: C.ink, marginBottom: 8 }}>Confirm payment</h2>
      <p style={{ color: C.inkMid, fontSize: 14, marginBottom: 24 }}>You'll only be charged once migration completes. Auto-refund if it fails.</p>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: '1.5rem', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ color: C.inkMid, fontSize: 14 }}>Plan</span>
          <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{plan}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ color: C.inkMid, fontSize: 14 }}>Migration ID</span>
          <code style={{ fontSize: 11, color: C.inkMid }}>{migrationId?.slice(0, 16)}…</code>
        </div>
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Total</span>
          <span style={{ fontWeight: 700, fontSize: 20, color: C.amber }}>{price}</span>
        </div>
      </div>

      <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#166534' }}>
        🛡 If the migration fails for any reason, your payment is automatically refunded in full.
      </div>

      {error && <p style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onBack} style={{ flex: 1, padding: 12, background: '#fff', color: C.ink, border: `1px solid ${C.border}`, borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>← Back</button>
        <button onClick={handlePay} disabled={loading} style={{
          flex: 2, padding: 12, background: loading ? C.inkLight : C.amber, color: '#fff',
          border: 'none', borderRadius: 8, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
        }}>{loading ? 'Processing…' : `Pay ${price} & Start`}</button>
      </div>
    </div>
  );
}

// ─── Step 3: Live running ─────────────────────────────────────────────────────
const TASK_LABELS = {
  analyze:   '🔍 AI codebase analysis',
  supabase:  '🔋 Creating Supabase project',
  railway:   '🚂 Deploying backend to Railway',
  vercel:    '▲  Deploying frontend to Vercel',
  health:    '✅ Health checks',
};

function StepRunning({ migrationId }) {
  useMigrationSocket(migrationId);
  const { tasks, completedTasks, currentTask } = useWizardStore();

  const allTasks = Object.keys(TASK_LABELS);

  return (
    <div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: C.ink, marginBottom: 8 }}>Migration in progress…</h2>
      <p style={{ color: C.inkMid, fontSize: 14, marginBottom: 24 }}>Keep this tab open. Usually takes 2–5 minutes.</p>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: '1rem', marginBottom: 20 }}>
        {allTasks.map(id => {
          const done = completedTasks.includes(id);
          const active = currentTask?.id === id;
          return (
            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.border}`, opacity: (!done && !active) ? 0.4 : 1 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                background: done ? C.green : active ? C.amber : C.border, color: done || active ? '#fff' : C.inkLight,
                ...(active ? { animation: 'spin 1s linear infinite' } : {}),
              }}>{done ? '✓' : active ? '◌' : '○'}</div>
              <span style={{ fontSize: 14, color: C.ink, fontWeight: active ? 600 : 400 }}>{TASK_LABELS[id]}</span>
              {active && <span style={{ marginLeft: 'auto', fontSize: 11, color: C.amber, fontWeight: 600 }}>Running…</span>}
              {done && <span style={{ marginLeft: 'auto', fontSize: 11, color: C.green, fontWeight: 600 }}>Done</span>}
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 12, color: C.inkLight, textAlign: 'center' }}>Real-time progress via WebSocket</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Step 4: Done ─────────────────────────────────────────────────────────────
function StepDone({ migrationId }) {
  const { deployedUrls, reset } = useWizardStore();
  const router = useRouter();

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 64, marginBottom: 12 }}>🎉</div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: C.ink, marginBottom: 8 }}>Migration complete!</h2>
      <p style={{ color: C.inkMid, fontSize: 14, marginBottom: 28 }}>Your app is live. All health checks passed.</p>

      {deployedUrls && (
        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: '1.25rem', marginBottom: 24, textAlign: 'left' }}>
          {[['Frontend', deployedUrls.frontend], ['Backend', deployedUrls.backend], ['Database', deployedUrls.database]]
            .filter(([, url]) => url)
            .map(([label, url]) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: C.inkLight, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{label}</div>
                <a href={url} target="_blank" rel="noreferrer" style={{ color: C.amber, fontWeight: 600, fontSize: 14, wordBreak: 'break-all' }}>{url}</a>
              </div>
            ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button onClick={() => router.push(`/migrations/${migrationId}`)} style={{
          padding: '11px 22px', background: '#fff', color: C.ink, border: `1px solid ${C.border}`, borderRadius: 8, fontWeight: 600, cursor: 'pointer',
        }}>View report</button>
        <button onClick={() => { reset(); router.push('/migrate'); }} style={{
          padding: '11px 22px', background: C.amber, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer',
        }}>New migration</button>
      </div>
    </div>
  );
}

// ─── Main wizard ─────────────────────────────────────────────────────────────
export default function MigratePage() {
  const { step, setStep } = useWizardStore();
  const [migrationId, setMigId] = useState(null);

  const next = () => setStep(step + 1);
  const back = () => setStep(step - 1);

  return (
    <>
      <Head>
        <title>New Migration — MigrateBot</title>
      </Head>
      <div style={{ minHeight: '100vh', background: C.surface, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 16px' }}>
        <div style={{ width: '100%', maxWidth: 560 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 32 }}>
            Migrate<span style={{ color: C.amber }}>Bot</span>
          </div>
          <StepBar step={step} />
          <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: '2rem', boxShadow: '0 2px 12px rgba(0,0,0,.04)' }}>
            {step === 0 && <StepSource onNext={next} />}
            {step === 1 && <StepConfigure onNext={next} onBack={back} setMigId={setMigId} />}
            {step === 2 && <StepPayment onNext={next} onBack={back} migrationId={migrationId} />}
            {step === 3 && <StepRunning migrationId={migrationId} />}
            {step === 4 && <StepDone migrationId={migrationId} />}
          </div>
        </div>
      </div>
    </>
  );
}
