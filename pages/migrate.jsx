/**
 * pages/migrate.jsx
 *
 * 5-Step Migration Wizard
 * Step 1 updated: three source options (GitHub, Replit, Emergent)
 */

import { useState } from 'react';
import { useRouter } from 'next/router';

const SOURCES = [
  {
    id: 'github',
    name: 'GitHub',
    icon: '🐙',
    description: 'Deploy from GitHub repositories',
    placeholder: 'https://github.com/username/repository',
    validation: /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\/?|(\.git)?)$/,
    showBranch: true,
  },
  {
    id: 'replit',
    name: 'Replit',
    icon: '🔄',
    description: 'Migrate Replit projects (monolith-aware)',
    placeholder: 'https://replit.com/@username/projectname',
    validation: /^https:\/\/replit\.com\/@[\w-]+\/[\w-]+\/?$/,
    showBranch: false,
  },
  {
    id: 'emergent',
    name: 'Emergent',
    icon: '🌱',
    description: 'Deploy from Emergent projects',
    placeholder: 'https://emergent.dev/project/projectid',
    validation: /^https:\/\/emergent\.dev\/(project\/[\w-]+|@[\w-]+\/[\w-]+)\/?$/,
    showBranch: false,
  },
];

const STEPS = ['Configure', 'Analysis', 'Platforms', 'Payment', 'Deploy'];

export default function Migrate() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedSource, setSelectedSource] = useState('github');
  const [sourceUrl, setSourceUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [urlError, setUrlError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [migration, setMigration] = useState({});

  const currentSource = SOURCES.find(s => s.id === selectedSource);

  const validateUrl = (url) => {
    if (!url) return 'Please enter a URL';
    if (!currentSource.validation.test(url)) return `Invalid ${currentSource.name} URL format`;
    return '';
  };

  const handleStep1Submit = async () => {
    const err = validateUrl(sourceUrl);
    if (err) { setUrlError(err); return; }
    setUrlError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/migrations/validate-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: selectedSource, url: sourceUrl }),
      });
      const data = await res.json();
      if (!data.valid) throw new Error(data.error || 'Validation failed');
      setMigration({ repourl: sourceUrl, branch, source_platform: selectedSource });
      setStep(2);
    } catch (err) {
      setUrlError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F4', fontFamily: 'Inter, sans-serif', padding: '2rem' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: '#D97706', cursor: 'pointer', fontSize: 14, padding: 0, marginBottom: 12 }}>← Back to Dashboard</button>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, color: '#1A1814', margin: 0 }}>New Migration</h1>
        </div>

        {/* Step Progress */}
        <div style={{ display: 'flex', gap: 8, marginBottom: '2rem' }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: 4, borderRadius: 2, background: step > i + 1 ? '#D97706' : step === i + 1 ? '#D97706' : '#E5E2DA', marginBottom: 6 }} />
              <span style={{ fontSize: 11, color: step === i + 1 ? '#D97706' : '#9B9890', fontWeight: step === i + 1 ? 600 : 400 }}>{s}</span>
            </div>
          ))}
        </div>

        {/* STEP 1: Configure Source */}
        {step === 1 && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E2DA', padding: '2rem' }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1A1814', marginTop: 0, marginBottom: '1.5rem' }}>Choose Your Source</h2>

            {/* Source Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
              {SOURCES.map(src => (
                <button
                  key={src.id}
                  onClick={() => { setSelectedSource(src.id); setSourceUrl(''); setUrlError(''); }}
                  style={{
                    padding: '1rem',
                    border: `2px solid ${selectedSource === src.id ? '#D97706' : '#E5E2DA'}`,
                    borderRadius: 10,
                    background: selectedSource === src.id ? '#FEF3C7' : '#FAFAF8',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 6 }}>{src.icon}</div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1A1814' }}>{src.name}</div>
                  <div style={{ fontSize: 11, color: '#6B6860', marginTop: 4, lineHeight: 1.4 }}>{src.description}</div>
                </button>
              ))}
            </div>

            {/* URL Input */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1A1814', marginBottom: 6 }}>
                {currentSource.name} URL
              </label>
              <input
                type="url"
                value={sourceUrl}
                onChange={e => { setSourceUrl(e.target.value); setUrlError(''); }}
                placeholder={currentSource.placeholder}
                style={{ width: '100%', padding: '10px 12px', border: `1px solid ${urlError ? '#DC2626' : '#E5E2DA'}`, borderRadius: 8, fontSize: 14, background: '#FAFAF8', boxSizing: 'border-box', outline: 'none' }}
              />
              {urlError && <p style={{ color: '#DC2626', fontSize: 12, marginTop: 4 }}>{urlError}</p>}
            </div>

            {/* Branch (GitHub only) */}
            {currentSource.showBranch && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1A1814', marginBottom: 6 }}>Branch</label>
                <input
                  type="text"
                  value={branch}
                  onChange={e => setBranch(e.target.value)}
                  placeholder="main"
                  style={{ width: 200, padding: '10px 12px', border: '1px solid #E5E2DA', borderRadius: 8, fontSize: 14, background: '#FAFAF8', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
            )}

            {/* Source Info Banner */}
            {selectedSource === 'replit' && (
              <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', marginBottom: '1.5rem', fontSize: 13, color: '#92400E' }}>
                ⚠️ Replit projects are monoliths. We'll automatically detect and split frontend/backend for deployment.
              </div>
            )}
            {selectedSource === 'emergent' && (
              <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, padding: '10px 14px', marginBottom: '1.5rem', fontSize: 13, color: '#065F46' }}>
                ✓ Emergent projects are already structured. We'll deploy /web → Vercel, /api → Railway, /db → Supabase.
              </div>
            )}

            <button
              onClick={handleStep1Submit}
              disabled={isLoading}
              style={{ width: '100%', padding: '12px', background: isLoading ? '#E5E2DA' : '#D97706', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer' }}
            >
              {isLoading ? 'Validating...' : 'Continue →'}
            </button>
          </div>
        )}

        {/* STEP 2-5: Placeholders (your existing step implementations go here) */}
        {step === 2 && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E2DA', padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#1A1814' }}>Analyzing {currentSource?.name} Project</h2>
            <p style={{ color: '#6B6860' }}>Source: {migration.repourl}</p>
            <p style={{ color: '#6B6860' }}>Platform: {migration.source_platform}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: '1.5rem' }}>
              <button onClick={() => setStep(1)} style={{ padding: '10px 20px', background: '#F8F7F4', border: '1px solid #E5E2DA', borderRadius: 8, cursor: 'pointer' }}>← Back</button>
              <button onClick={() => setStep(3)} style={{ padding: '10px 20px', background: '#D97706', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Continue →</button>
            </div>
          </div>
        )}

        {step >= 3 && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E2DA', padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: '#6B6860' }}>Step {step} — wire in your existing Step {step} component here</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: '1.5rem' }}>
              <button onClick={() => setStep(s => s - 1)} style={{ padding: '10px 20px', background: '#F8F7F4', border: '1px solid #E5E2DA', borderRadius: 8, cursor: 'pointer' }}>← Back</button>
              {step < 5 && <button onClick={() => setStep(s => s + 1)} style={{ padding: '10px 20px', background: '#D97706', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Continue →</button>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
