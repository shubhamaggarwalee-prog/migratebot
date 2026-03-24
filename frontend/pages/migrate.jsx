/**
 * frontend/pages/migrate.jsx
 * Full 5-step migration wizard — layman-friendly version.
 * Steps: 0 Source → 1 Configure → 2 Pay → 3 Running → 4 Done
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { migrations } from '../lib/api';
import { useWizardStore } from '../lib/store';
import { useMigrationSocket } from '../hooks/useSocket';

const C = {
  amber: '#D97706', amberBg: '#FEF3C7', amberDark: '#B45309',
  ink: '#1A1814', inkMid: '#5C574E', inkLight: '#9B958A',
  border: '#E5E2DA', surface: '#F8F7F4', green: '#059669',
  greenBg: '#D1FAE5', red: '#DC2626', redBg: '#FEE2E2',
  blue: '#2563EB', blueBg: '#DBEAFE',
};

const STEPS = ['Your App', 'Setup', 'Payment', 'Deploying', 'Live! 🎉'];

// ─── Step bar ─────────────────────────────────────────────────────────────────
function StepBar({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 36 }}>
      {STEPS.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0,
              background: i < step ? C.green : i === step ? C.amber : C.border,
              color: i <= step ? '#fff' : C.inkLight,
            }}>{i < step ? '✓' : i + 1}</div>
            <div style={{ fontSize: 10, color: i === step ? C.ink : C.inkLight, fontWeight: i === step ? 600 : 400, whiteSpace: 'nowrap' }}>{s}</div>
          </div>
          {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: i < step ? C.green : C.border, margin: '0 6px', marginBottom: 16 }} />}
        </div>
      ))}
    </div>
  );
}

// ─── Tooltip component ────────────────────────────────────────────────────────
function Tooltip({ text, children }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div style={{
          position: 'absolute', bottom: '120%', left: '50%', transform: 'translateX(-50%)',
          background: C.ink, color: '#fff', padding: '8px 12px', borderRadius: 8,
          fontSize: 12, lineHeight: 1.5, width: 220, zIndex: 100,
          boxShadow: '0 4px 12px rgba(0,0,0,.2)', textAlign: 'left',
        }}>{text}</div>
      )}
    </span>
  );
}

// ─── Info box ─────────────────────────────────────────────────────────────────
function InfoBox({ icon = 'ℹ', color = C.blue, bg = C.blueBg, children }) {
  return (
    <div style={{ background: bg, border: `1px solid ${color}33`, borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16 }}>
      <span style={{ color, fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

// ─── Step 0: Where is your app? ──────────────────────────────────────────────
function StepSource({ onNext }) {
  const { repoUrl, setRepoUrl, branch, setBranch } = useWizardStore();
  const [source, setSource] = useState('github');
  const [replitToken, setReplitToken] = useState('');
  const [error, setError] = useState('');

  const SOURCES = [
    {
      id: 'github',
      icon: '🐙',
      name: 'GitHub',
      desc: 'I built my app and it\'s saved on GitHub',
      placeholder: 'https://github.com/yourname/your-app',
      what: 'GitHub is where developers store and share code online. Think of it like Google Drive, but for code.',
    },
    {
      id: 'replit',
      icon: '🔄',
      name: 'Replit',
      desc: 'I built my app on Replit',
      placeholder: 'https://replit.com/@yourname/your-app',
      what: 'Replit is an online coding environment where you can build and run apps directly in your browser.',
    },
    {
      id: 'emergent',
      icon: '⚡',
      name: 'Emergent',
      desc: 'I built my app on Emergent',
      placeholder: 'https://emergent.sh/projects/your-app',
      what: 'Emergent is an AI-powered platform for building and deploying web applications.',
    },
  ];

  const selected = SOURCES.find(s => s.id === source);

  const handleNext = () => {
    if (!repoUrl.trim()) { setError('Please paste your app URL above.'); return; }
    if (source === 'replit' && replitToken) sessionStorage.setItem('mb_replit_token', replitToken);
    onNext();
  };

  return (
    <div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: C.ink, marginBottom: 6 }}>
        Where did you build your app?
      </h2>
      <p style={{ color: C.inkMid, fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
        Just tell us where your app lives. We'll handle everything else.
      </p>

      {/* Source buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {SOURCES.map(s => (
          <button key={s.id} onClick={() => { setSource(s.id); setError(''); }} style={{
            display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px',
            borderRadius: 12, border: `2px solid ${source === s.id ? C.amber : C.border}`,
            background: source === s.id ? C.amberBg : '#fff',
            cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
          }}>
            <span style={{ fontSize: 32, flexShrink: 0 }}>{s.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>{s.name}</div>
              <div style={{ fontSize: 13, color: C.inkMid, marginTop: 2 }}>{s.desc}</div>
            </div>
            {source === s.id && <span style={{ color: C.amber, fontSize: 20 }}>✓</span>}
          </button>
        ))}
      </div>

      {/* What is this? explanation */}
      <InfoBox icon="💡" color={C.amber} bg={C.amberBg}>
        <strong>What is {selected?.name}?</strong> {selected?.what}
      </InfoBox>

      {/* URL input */}
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>
        Paste your {selected?.name} link here
      </label>
      <input
        value={repoUrl}
        onChange={e => { setRepoUrl(e.target.value); setError(''); }}
        placeholder={selected?.placeholder}
        style={{
          width: '100%', padding: '12px 14px', border: `2px solid ${error ? C.red : C.border}`,
          borderRadius: 8, fontSize: 14, boxSizing: 'border-box', marginBottom: 6,
          outline: 'none', transition: 'border-color .15s',
        }}
      />
      <p style={{ fontSize: 12, color: C.inkLight, marginBottom: 16 }}>
        Copy the link from your browser address bar when you're looking at your project.
      </p>

      {/* Replit token */}
      {source === 'replit' && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>
            Replit API Token <span style={{ fontWeight: 400, color: C.inkLight }}>(only needed for private apps)</span>
          </label>
          <input
            type="password"
            value={replitToken}
            onChange={e => setReplitToken(e.target.value)}
            placeholder="Paste your token here (optional for public apps)"
            style={{ width: '100%', padding: '12px 14px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
          />
          <p style={{ fontSize: 12, color: C.inkMid, marginTop: 6, lineHeight: 1.5 }}>
            Your app is public? Skip this field. Private app? Get your token at{' '}
            <a href="https://replit.com/account" target="_blank" rel="noreferrer" style={{ color: C.amber }}>
              replit.com/account → API tokens
            </a>.
            We never store this permanently.
          </p>
        </div>
      )}

      {/* Branch (collapsed by default) */}
      <details style={{ marginBottom: 20 }}>
        <summary style={{ fontSize: 13, color: C.inkMid, cursor: 'pointer', userSelect: 'none' }}>
          Advanced: specify a branch (optional)
        </summary>
        <div style={{ marginTop: 10 }}>
          <Tooltip text="A branch is like a version of your code. If you don't know what this means, leave it as 'main'.">
            <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              Branch <span style={{ fontSize: 11, color: C.blue, cursor: 'help' }}>What's this?</span>
            </label>
          </Tooltip>
          <input
            value={branch}
            onChange={e => setBranch(e.target.value)}
            placeholder="main"
            style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
          />
        </div>
      </details>

      {error && (
        <div style={{ background: C.redBg, border: `1px solid ${C.red}44`, borderRadius: 8, padding: '10px 14px', color: C.red, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <button onClick={handleNext} style={{
        width: '100%', padding: '14px', background: C.amber, color: '#fff',
        border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 16, cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(217,119,6,.3)', transition: 'all .15s',
      }}>
        Continue → Let's set up your accounts
      </button>
    </div>
  );
}

// ─── Step 1: Platform setup guides ───────────────────────────────────────────
const PLATFORM_GUIDES = [
  {
    id: 'anthropic',
    icon: '🤖',
    name: 'Anthropic API Key',
    tagline: 'The AI brain that reads your code',
    what: 'Anthropic makes the Claude AI. We use it to read your code and understand how to deploy it correctly. Think of it as our translator between your app and the servers.',
    why: 'Without this, our AI cannot understand what your app does or how to set it up properly.',
    steps: [
      { n: 1, text: 'Click the button below to open Anthropic\'s website' },
      { n: 2, text: 'Create a free account (takes 2 minutes)' },
      { n: 3, text: 'Click "Create API Key" and give it any name like "MigrateBot"' },
      { n: 4, text: 'Copy the key that starts with "sk-ant-..." and paste it below' },
    ],
    link: 'https://console.anthropic.com/account/keys',
    linkLabel: 'Open Anthropic Console →',
    placeholder: 'sk-ant-...',
    field: 'anthropicKey',
    required: true,
  },
  {
    id: 'supabase',
    icon: '🗄️',
    name: 'Supabase',
    tagline: 'Your app\'s database and login system',
    what: 'Supabase is where your app stores all its data — user accounts, posts, orders, whatever your app saves. It\'s like a very powerful spreadsheet that your app can read and write to.',
    why: 'Your app needs a database to remember things between sessions. Supabase gives you a free, professional-grade database.',
    steps: [
      { n: 1, text: 'Click the button below to open Supabase' },
      { n: 2, text: 'Create a free account with your email or GitHub' },
      { n: 3, text: 'Go to Account Settings (top right) → Access Tokens' },
      { n: 4, text: 'Click "Generate new token", name it "MigrateBot"' },
      { n: 5, text: 'Copy the token and paste it below' },
    ],
    link: 'https://app.supabase.com/account/tokens',
    linkLabel: 'Open Supabase →',
    placeholder: 'sbp_...',
    field: 'supabaseKey',
    required: true,
  },
  {
    id: 'vercel',
    icon: '▲',
    name: 'Vercel',
    tagline: 'Where people visit your app',
    what: 'Vercel is the service that makes your app accessible on the internet. When someone types your app\'s address into their browser, Vercel is what serves it to them — instantly, from anywhere in the world.',
    why: 'Without Vercel, your app exists on your computer but nobody else can see it. Vercel puts it on the internet.',
    steps: [
      { n: 1, text: 'Click the button below to open Vercel' },
      { n: 2, text: 'Sign up for free with GitHub or email' },
      { n: 3, text: 'Go to Account Settings → Tokens' },
      { n: 4, text: 'Click "Create Token", name it "MigrateBot", set scope to "Full Account"' },
      { n: 5, text: 'Copy the token and paste it below' },
    ],
    link: 'https://vercel.com/account/tokens',
    linkLabel: 'Open Vercel →',
    placeholder: 'Paste your Vercel token here',
    field: 'vercelKey',
    required: true,
  },
  {
    id: 'railway',
    icon: '🚂',
    name: 'Railway',
    tagline: 'The server that runs your app\'s logic',
    what: 'Railway runs the "backend" of your app — all the invisible logic that happens when your app does things like send emails, process payments, or save data. Think of it as the engine room.',
    why: 'If your app has any logic beyond showing static pages (like user accounts, data, or APIs), Railway is what runs it.',
    steps: [
      { n: 1, text: 'Click the button below to open Railway' },
      { n: 2, text: 'Create a free account' },
      { n: 3, text: 'Click your profile picture → Account Settings → Tokens' },
      { n: 4, text: 'Click "Create Token", give it any name' },
      { n: 5, text: 'Copy the token and paste it below' },
    ],
    link: 'https://railway.app/account/tokens',
    linkLabel: 'Open Railway →',
    placeholder: 'Paste your Railway token here',
    field: 'railwayKey',
    required: true,
  },
];

function PlatformGuide({ guide, value, onChange }) {
  const [open, setOpen] = useState(false);
  const saved = value && value.length > 6;

  return (
    <div style={{
      border: `2px solid ${saved ? C.green : open ? C.amber : C.border}`,
      borderRadius: 12, overflow: 'hidden', marginBottom: 12,
      transition: 'border-color .2s',
    }}>
      {/* Header */}
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px', background: saved ? C.greenBg : open ? C.amberBg : '#fff',
        border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background .2s',
      }}>
        <span style={{ fontSize: 28, flexShrink: 0 }}>{guide.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>{guide.name}</div>
          <div style={{ fontSize: 12, color: C.inkMid, marginTop: 2 }}>{guide.tagline}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saved ? (
            <span style={{ background: C.green, color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>✓ Connected</span>
          ) : (
            <span style={{ background: C.amber, color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
              {guide.required ? 'Required' : 'Optional'}
            </span>
          )}
          <span style={{ color: C.inkLight, fontSize: 18, transition: 'transform .2s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div style={{ padding: '16px 18px', borderTop: `1px solid ${C.border}`, background: '#fff' }}>
          {/* What is it */}
          <InfoBox icon="💡" color={C.amber} bg={C.amberBg}>
            <strong>What is {guide.name}?</strong> {guide.what}
          </InfoBox>

          {/* Why needed */}
          <InfoBox icon="❓" color={C.blue} bg={C.blueBg}>
            <strong>Why do we need it?</strong> {guide.why}
          </InfoBox>

          {/* Steps */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 10 }}>
              How to get your {guide.name} key (2 minutes):
            </div>
            {guide.steps.map(s => (
              <div key={s.n} style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'flex-start' }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', background: C.amber, color: '#fff',
                  fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0, marginTop: 1,
                }}>{s.n}</div>
                <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.5 }}>{s.text}</div>
              </div>
            ))}
          </div>

          {/* Open platform button */}
          <a
            href={guide.link}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'block', width: '100%', padding: '11px', background: C.ink, color: '#fff',
              borderRadius: 8, textAlign: 'center', fontWeight: 700, fontSize: 14,
              textDecoration: 'none', marginBottom: 14, boxSizing: 'border-box',
            }}
          >
            {guide.linkLabel}
          </a>

          {/* Token input */}
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>
            Paste your {guide.name} key here:
          </label>
          <input
            type="password"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={guide.placeholder}
            style={{
              width: '100%', padding: '12px 14px', border: `2px solid ${saved ? C.green : C.border}`,
              borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none',
              transition: 'border-color .15s',
            }}
          />
          {saved && (
            <p style={{ fontSize: 12, color: C.green, marginTop: 6, fontWeight: 600 }}>
              ✓ Key saved — you can close this section
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StepConfigure({ onNext, onBack, setMigId }) {
  const { platforms, setPlatform, plan, setPlan, repoUrl, branch } = useWizardStore();
  const [keys, setKeys] = useState({ anthropicKey: '', supabaseKey: '', vercelKey: '', railwayKey: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setKey = (field, value) => setKeys(prev => ({ ...prev, [field]: value }));
  const selectedPlatforms = Object.entries(platforms).filter(([, v]) => v).map(([k]) => k);

  const allRequired = keys.anthropicKey && keys.supabaseKey && keys.vercelKey && keys.railwayKey;

  const handleStart = async () => {
    if (!allRequired) {
      setError('Please connect all four services above before continuing. Each one takes about 2 minutes.');
      return;
    }
    if (selectedPlatforms.length === 0) {
      setError('Please select at least one deployment platform.');
      return;
    }
    setLoading(true); setError('');
    try {
      // Create migration first to get the migration ID
      const res = await migrations.create(repoUrl, selectedPlatforms, plan, branch);
      const migId = res.migration.id;

      // Save credentials AFTER migration created, passing migration_id
      const authHeader = `Bearer ${localStorage.getItem('mb_token')}`;
      const apiBase = process.env.NEXT_PUBLIC_API_URL;
      const credPayloads = [
        { platform: 'anthropic', token: keys.anthropicKey },
        { platform: 'supabase',  token: keys.supabaseKey },
        { platform: 'vercel',    token: keys.vercelKey },
        { platform: 'railway',   token: keys.railwayKey },
      ];
      await Promise.all(credPayloads.map(payload =>
        fetch(`${apiBase}/api/credentials`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: authHeader },
          body: JSON.stringify({ ...payload, migration_id: migId }),
        })
      ));

      setMigId(migId);
      onNext();
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: C.ink, marginBottom: 6 }}>
        Set up your free accounts
      </h2>
      <p style={{ color: C.inkMid, fontSize: 14, marginBottom: 8, lineHeight: 1.6 }}>
        We need to connect four free services to deploy your app. Each takes about 2 minutes to set up.
        <strong style={{ color: C.ink }}> You only do this once.</strong>
      </p>

      <InfoBox icon="🔒" color={C.green} bg={C.greenBg}>
        <strong>Your keys are safe.</strong> All tokens are encrypted with military-grade security (AES-256). We use them only during your migration and never share them with anyone.
      </InfoBox>

      {/* Platform guides */}
      {PLATFORM_GUIDES.map(guide => (
        <PlatformGuide
          key={guide.id}
          guide={guide}
          value={keys[guide.field]}
          onChange={val => setKey(guide.field, val)}
        />
      ))}

      {/* Deployment targets */}
      <div style={{ marginTop: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 6 }}>
          Where should we deploy? (select all that apply)
        </div>
        <p style={{ fontSize: 12, color: C.inkMid, marginBottom: 12 }}>
          Not sure? Select all three — we'll figure out what your app needs.
        </p>
        {[
          { id: 'supabase', icon: '🗄️', label: 'Database (Supabase)', desc: 'For storing your app\'s data' },
          { id: 'vercel', icon: '▲', label: 'Frontend (Vercel)', desc: 'What visitors see in their browser' },
          { id: 'railway', icon: '🚂', label: 'Backend (Railway)', desc: 'The invisible logic that runs your app' },
        ].map(p => (
          <label key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
            borderRadius: 10, border: `2px solid ${platforms[p.id] ? C.amber : C.border}`,
            background: platforms[p.id] ? C.amberBg : '#fff',
            cursor: 'pointer', marginBottom: 8, transition: 'all .15s',
          }}>
            <input type="checkbox" checked={!!platforms[p.id]} onChange={e => setPlatform(p.id, e.target.checked)}
              style={{ width: 18, height: 18, accentColor: C.amber, flexShrink: 0 }} />
            <span style={{ fontSize: 20 }}>{p.icon}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: C.ink }}>{p.label}</div>
              <div style={{ fontSize: 11, color: C.inkMid }}>{p.desc}</div>
            </div>
          </label>
        ))}
      </div>

      {/* Plan selection */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 10 }}>Choose your plan</div>
        {[
          { id: 'starter', label: 'Starter', price: '$100', desc: 'Perfect for most apps. Includes everything you need to go live.' },
          { id: 'pro',     label: 'Pro',     price: '$250', desc: 'Priority processing, dedicated support, and faster deployment.' },
        ].map(p => (
          <label key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
            borderRadius: 10, border: `2px solid ${plan === p.id ? C.amber : C.border}`,
            background: plan === p.id ? C.amberBg : '#fff', cursor: 'pointer', marginBottom: 8,
          }}>
            <input type="radio" name="plan" checked={plan === p.id} onChange={() => setPlan(p.id)} style={{ accentColor: C.amber }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>{p.label} — {p.price}</div>
              <div style={{ fontSize: 12, color: C.inkMid, marginTop: 2 }}>{p.desc}</div>
            </div>
          </label>
        ))}
      </div>

      {error && (
        <div style={{ background: C.redBg, border: `1px solid ${C.red}44`, borderRadius: 8, padding: '12px 14px', color: C.red, fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onBack} style={{ flex: 1, padding: 12, background: '#fff', color: C.ink, border: `2px solid ${C.border}`, borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>← Back</button>
        <button onClick={handleStart} disabled={loading} style={{
          flex: 2, padding: 14, background: loading ? C.inkLight : C.amber, color: '#fff',
          border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15,
          cursor: loading ? 'default' : 'pointer', boxShadow: loading ? 'none' : '0 4px 12px rgba(217,119,6,.3)',
        }}>{loading ? 'Setting up…' : 'Continue to payment →'}</button>
      </div>
    </div>
  );
}

// ─── Step 2: Payment ──────────────────────────────────────────────────────────
function StepPayment({ onNext, onBack, migrationId }) {
  const { plan, setPayment } = useWizardStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const price = plan === 'pro' ? '$250' : '$100';
  const savings = plan === 'pro' ? '$2,750+' : '$900+';

  const handlePay = async () => {
    setLoading(true); setError('');
    try {
      const res = await migrations.createPaymentIntent(migrationId);
      setPayment(res.paymentIntentId, res.clientSecret);
      await migrations.start(migrationId);
      onNext();
    } catch (e) {
      setError(e.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: C.ink, marginBottom: 6 }}>
        Ready to go live?
      </h2>
      <p style={{ color: C.inkMid, fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
        You're one step away from having a professional, live app.
      </p>

      {/* Value comparison */}
      <div style={{ background: C.greenBg, border: `1px solid ${C.green}44`, borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: 10 }}>💰 What you're getting</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: C.inkMid }}>A developer would charge</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.red, textDecoration: 'line-through' }}>{savings}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: C.inkMid }}>Time it would take them</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.red, textDecoration: 'line-through' }}>2–5 days</span>
        </div>
        <div style={{ borderTop: `1px solid ${C.green}44`, paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>MigrateBot today</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.green }}>{price} · 3 minutes</span>
        </div>
      </div>

      {/* Order summary */}
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 12 }}>Order summary</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: C.inkMid, fontSize: 14 }}>Plan</span>
          <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{plan} Migration</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: C.inkMid, fontSize: 14 }}>Migration ID</span>
          <code style={{ fontSize: 11, color: C.inkMid }}>{migrationId?.slice(0, 16)}…</code>
        </div>
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Total</span>
          <span style={{ fontWeight: 700, fontSize: 22, color: C.amber }}>{price}</span>
        </div>
      </div>

      {/* Guarantee */}
      <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#166534', marginBottom: 4 }}>🛡 100% Money-Back Guarantee</div>
        <div style={{ fontSize: 13, color: '#166534', lineHeight: 1.6 }}>
          If your migration fails for <em>any</em> reason, your payment is automatically refunded in full within 24 hours.
          No questions asked. No forms to fill out.
        </div>
      </div>

      {error && (
        <div style={{ background: C.redBg, border: `1px solid ${C.red}44`, borderRadius: 8, padding: '12px 14px', color: C.red, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onBack} style={{ flex: 1, padding: 12, background: '#fff', color: C.ink, border: `2px solid ${C.border}`, borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>← Back</button>
        <button onClick={handlePay} disabled={loading} style={{
          flex: 2, padding: 14, background: loading ? C.inkLight : C.amber, color: '#fff',
          border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 16,
          cursor: loading ? 'default' : 'pointer', boxShadow: loading ? 'none' : '0 4px 12px rgba(217,119,6,.3)',
        }}>{loading ? 'Processing payment…' : `Pay ${price} & Deploy My App`}</button>
      </div>

      <p style={{ fontSize: 11, color: C.inkLight, textAlign: 'center', marginTop: 12 }}>
        🔒 Secured by Stripe · Your card details never touch our servers
      </p>
    </div>
  );
}

// ─── Step 3: Live deployment ──────────────────────────────────────────────────
const TASK_LABELS = {
  analyze:  { label: '🔍 Reading your code',            desc: 'Claude AI is understanding what your app does' },
  supabase: { label: '🗄️ Setting up your database',     desc: 'Creating a secure home for your app\'s data' },
  railway:  { label: '🚂 Starting your backend server', desc: 'Spinning up the engine that runs your app\'s logic' },
  vercel:   { label: '▲ Publishing to the internet',    desc: 'Making your app accessible to the world' },
  health:   { label: '✅ Final checks',                  desc: 'Making sure everything is working perfectly' },
};

function StepRunning({ migrationId }) {
  useMigrationSocket(migrationId);
  // Safe fallbacks in case store fields are not yet initialised
  const completedTasks = useWizardStore(s => s.completedTasks) || [];
  const currentTask    = useWizardStore(s => s.currentTask)    || null;
  const allTasks = Object.keys(TASK_LABELS);
  const progress = Math.round((completedTasks.length / allTasks.length) * 100);

  return (
    <div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: C.ink, marginBottom: 6 }}>
        Deploying your app… ⚡
      </h2>
      <p style={{ color: C.inkMid, fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
        Please keep this tab open. This usually takes 2–5 minutes.
        You'll see each step as it completes.
      </p>

      {/* Progress bar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: C.inkMid }}>Overall progress</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>{progress}%</span>
        </div>
        <div style={{ height: 8, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: `linear-gradient(90deg, ${C.amber}, ${C.amberDark})`, width: `${progress}%`, borderRadius: 4, transition: 'width .5s ease' }} />
        </div>
      </div>

      {/* Task list */}
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
        {allTasks.map((id, i) => {
          const done = completedTasks.includes(id);
          const active = currentTask === id || currentTask?.id === id;
          const task = TASK_LABELS[id];
          return (
            <div key={id} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
              borderBottom: i < allTasks.length - 1 ? `1px solid ${C.border}` : 'none',
              background: done ? C.greenBg : active ? C.amberBg : '#fff',
              opacity: (!done && !active) ? 0.45 : 1, transition: 'all .3s',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                background: done ? C.green : active ? C.amber : C.border,
                color: done || active ? '#fff' : C.inkLight,
              }}>
                {done ? '✓' : active ? '…' : i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: active ? 700 : done ? 600 : 400, color: C.ink }}>{task.label}</div>
                {(active || done) && <div style={{ fontSize: 12, color: done ? C.green : C.inkMid, marginTop: 2 }}>{task.desc}</div>}
              </div>
              {active && <span style={{ fontSize: 11, color: C.amber, fontWeight: 700 }}>Working…</span>}
              {done && <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>Done ✓</span>}
            </div>
          );
        })}
      </div>

      <InfoBox icon="☕" color={C.amber} bg={C.amberBg}>
        <strong>Good time for a coffee break!</strong> We're doing the equivalent of 2–5 days of developer work in the background. We'll show you your live links when it's done.
      </InfoBox>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Step 4: Done! ────────────────────────────────────────────────────────────
function StepDone({ migrationId }) {
  const { deployedUrls, plan, reset } = useWizardStore();
  const router = useRouter();
  const savings = plan === 'pro' ? '$2,750' : '$900';

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 72, marginBottom: 16 }}>🎉</div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: C.ink, marginBottom: 8 }}>
        Your app is live!
      </h2>
      <p style={{ color: C.inkMid, fontSize: 15, marginBottom: 8, lineHeight: 1.6 }}>
        Congratulations! Your app is now professionally deployed and accessible to anyone in the world.
      </p>
      <p style={{ color: C.green, fontSize: 14, fontWeight: 700, marginBottom: 28 }}>
        You just saved approximately {savings} in developer fees 🚀
      </p>

      {/* Live URLs */}
      {deployedUrls && (
        <div style={{ background: C.greenBg, border: `1px solid ${C.green}44`, borderRadius: 12, padding: '20px', marginBottom: 24, textAlign: 'left' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.green, marginBottom: 14 }}>✓ Your live app links</div>
          {[
            { label: '🌐 Your app (what visitors see)', url: deployedUrls.frontend, key: 'frontend' },
            { label: '⚙️ Your backend server', url: deployedUrls.backend, key: 'backend' },
            { label: '🗄️ Your database dashboard', url: deployedUrls.database, key: 'database' },
          ].filter(item => deployedUrls[item.key]).map(item => (
            <div key={item.key} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: C.inkMid, marginBottom: 4 }}>{item.label}</div>
              <a href={item.url} target="_blank" rel="noreferrer" style={{
                display: 'block', color: C.amber, fontWeight: 700, fontSize: 14,
                wordBreak: 'break-all', textDecoration: 'none', padding: '8px 12px',
                background: '#fff', borderRadius: 8, border: `1px solid ${C.border}`,
              }}>
                {item.url} ↗
              </a>
            </div>
          ))}
        </div>
      )}

      {/* What's next */}
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px', marginBottom: 24, textAlign: 'left' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 14 }}>📋 What happens next?</div>
        {[
          { icon: '🔗', title: 'Add your own domain name', desc: 'Want yourappname.com instead of a random URL? Go to your Vercel dashboard and click "Add Domain". It takes 5 minutes.' },
          { icon: '🔄', title: 'Update your app', desc: 'Made changes to your code? Just push to GitHub/Replit and run a new migration, or re-deploy directly from your Vercel dashboard.' },
          { icon: '📊', title: 'Monitor your app', desc: 'Watch your app\'s traffic and errors in your Railway and Vercel dashboards. Both have free tiers that are plenty for starting out.' },
          { icon: '🆘', title: 'Something not working?', desc: 'Email us at support@migratebot.io and we\'ll help you sort it out. If it\'s our fault, we\'ll fix it for free.' },
        ].map(item => (
          <div key={item.title} style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{item.icon}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: C.ink, marginBottom: 2 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => router.push(`/migrations/${migrationId}`)} style={{
          padding: '12px 22px', background: '#fff', color: C.ink,
          border: `2px solid ${C.border}`, borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14,
        }}>
          View full report
        </button>
        <button onClick={() => { reset(); router.push('/dashboard'); }} style={{
          padding: '12px 22px', background: C.amber, color: '#fff',
          border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 14,
          boxShadow: '0 4px 12px rgba(217,119,6,.3)',
        }}>
          Go to dashboard →
        </button>
      </div>

      <p style={{ fontSize: 12, color: C.inkLight, marginTop: 16 }}>
        Enjoyed MigrateBot? Tell a friend — every referral helps us keep the lights on 🙏
      </p>
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────
export default function MigratePage() {
  const { step, setStep } = useWizardStore();
  const [migrationId, setMigId] = useState(null);

  const next = () => setStep(step + 1);
  const back = () => setStep(step - 1);

  return (
    <>
      <Head>
        <title>Deploy My App — MigrateBot</title>
        <meta name="description" content="Deploy your app to production in 3 minutes. No technical knowledge required." />
      </Head>
      <div style={{ minHeight: '100vh', background: C.surface, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px' }}>
        <div style={{ width: '100%', maxWidth: 580 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
            <span style={{ fontSize: 28 }}>⚡</span>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: C.ink }}>
              Migrate<span style={{ color: C.amber }}>Bot</span>
            </div>
          </div>

          <StepBar step={step} />

          <div style={{
            background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`,
            padding: '28px 28px', boxShadow: '0 2px 20px rgba(0,0,0,.06)',
          }}>
            {step === 0 && <StepSource onNext={next} />}
            {step === 1 && <StepConfigure onNext={next} onBack={back} setMigId={setMigId} />}
            {step === 2 && <StepPayment onNext={next} onBack={back} migrationId={migrationId} />}
            {step === 3 && <StepRunning migrationId={migrationId} />}
            {step === 4 && <StepDone migrationId={migrationId} />}
          </div>

          <p style={{ fontSize: 11, color: C.inkLight, textAlign: 'center', marginTop: 16 }}>
            🔒 Your code is never stored · AES-256 encryption · 100% refund if migration fails
          </p>
        </div>
      </div>
    </>
  );
}
