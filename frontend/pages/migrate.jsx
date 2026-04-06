/**
 * frontend/pages/migrate.jsx
 * Full 5-step migration wizard — layman-friendly version.
 * Steps: 0 Source → 1 Configure → 2 Pay → 3 Running → 4 Done
 *
 * Task 13: Added "Paste / Upload ZIP" as a 4th source option in Step 0.
 * Task 19: Added AgentChat overlay + preScan health card in StepRunning.
 */
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { migrations } from '../lib/api';
import { useWizardStore } from '../lib/store';
import { useMigrationSocket } from '../hooks/useSocket';
import Term from '../components/Term';
import TokenWalkthrough from '../components/TokenWalkthrough';
import AgentChat from '../components/AgentChat';  // Task 19

const C = {
  amber: '#D97706', amberBg: '#FEF3C7', amberDark: '#B45309',
  ink: '#1A1814', inkMid: '#5C574E', inkLight: '#9B958A',
  border: '#E5E2DA', surface: '#F8F7F4', green: '#059669',
  greenBg: '#D1FAE5', red: '#DC2626', redBg: '#FEE2E2',
  blue: '#2563EB', blueBg: '#DBEAFE',
};

const STEPS = ['Your App', 'Setup', 'Payment', 'Deploying', 'Live! 🎉'];

// ─── Sandbox-safe storage helpers ────────────────────────────────────────────
function safeGetLocal(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSetSession(key, value) {
  try { sessionStorage.setItem(key, value); } catch { /* sandboxed */ }
}

// ─── Step bar ────────────────────────────────────────────────────────────────
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

// ─── Info box ────────────────────────────────────────────────────────────────
function InfoBox({ icon = 'ℹ', color = C.blue, bg = C.blueBg, children }) {
  return (
    <div style={{ background: bg, border: `1px solid ${color}33`, borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16 }}>
      <span style={{ color, fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

// ─── GitHub PAT mini-guide (used inside the paste/zip source panel) ───────────
function GithubPatGuide({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const saved = value && value.length > 10;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>
          Your GitHub token
          <span style={{ fontWeight: 400, color: C.inkLight, marginLeft: 6 }}>(so we can create your repo)</span>
        </label>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          style={{ fontSize: 11, color: C.amber, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
        >
          {open ? 'Hide guide ▲' : 'How do I get this? ▼'}
        </button>
      </div>

      {open && (
        <div style={{ marginBottom: 12 }}>
          <div style={{
            background: C.amberBg, border: `1px solid ${C.amber}33`,
            borderRadius: 10, padding: '12px 14px', marginBottom: 10,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.amberDark, marginBottom: 8 }}>📋 3 quick steps</div>
            {[
              { n: 1, text: 'Go to github.com → click your avatar (top right) → Settings' },
              { n: 2, text: 'Scroll to the bottom → click "Developer settings" → Personal access tokens → Tokens (classic)' },
              { n: 3, text: 'Click "Generate new token (classic)", name it "MigrateBot", tick the "repo" checkbox, and copy the token' },
            ].map(s => (
              <div key={s.n} style={{ display: 'flex', gap: 10, marginBottom: 6, alignItems: 'flex-start' }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: C.amber, color: '#fff',
                  fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{s.n}</div>
                <div style={{ fontSize: 12, color: C.inkMid, lineHeight: 1.5 }}>{s.text}</div>
              </div>
            ))}
            <a
              href="https://github.com/settings/tokens/new?scopes=repo&description=MigrateBot"
              target="_blank" rel="noreferrer"
              style={{
                display: 'inline-block', marginTop: 6,
                padding: '7px 14px', background: C.ink, color: '#fff',
                borderRadius: 7, fontSize: 12, fontWeight: 700, textDecoration: 'none',
              }}
            >
              Open GitHub token page →
            </a>
          </div>
        </div>
      )}

      <input
        type="password"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="ghp_…"
        style={{
          width: '100%', padding: '11px 13px',
          border: `2px solid ${saved ? C.green : C.border}`,
          borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none',
          transition: 'border-color .15s', fontFamily: 'monospace',
        }}
      />
      {saved && (
        <p style={{ fontSize: 12, color: C.green, marginTop: 5, fontWeight: 600 }}>✓ Token looks good</p>
      )}
    </div>
  );
}

// ─── Step 0: Where is your app? ──────────────────────────────────────────────
function StepSource({ onNext }) {
  const { repoUrl, setRepoUrl, branch, setBranch } = useWizardStore();
  const [source, setSource]       = useState('github');
  const [replitToken, setReplitToken] = useState('');
  const [error, setError]         = useState('');

  // ── Paste/ZIP state ──────────────────────────────────────────────────────
  const [uploadMode,   setUploadMode]   = useState('paste');   // 'paste' | 'zip'
  const [pasteFile,    setPasteFile]    = useState('');         // filename
  const [pasteContent, setPasteContent] = useState('');         // code content
  const [zipFiles,     setZipFiles]     = useState([]);         // [{ path, content }]
  const [zipName,      setZipName]      = useState('');
  const [appName,      setAppName]      = useState('');
  const [githubPat,    setGithubPat]    = useState('');
  const [uploading,    setUploading]    = useState(false);
  const [uploadDone,   setUploadDone]   = useState(false);
  const [uploadMsg,    setUploadMsg]    = useState('');
  const fileInputRef = useRef();

  const SOURCES = [
    {
      id: 'github',
      icon: '🐙',
      name: 'GitHub',
      desc: 'I have a GitHub link to my app',
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
    {
      id: 'paste',
      icon: '📋',
      name: 'Paste or Upload',
      desc: 'I wrote code in Claude (or anywhere) and want to paste it or upload a ZIP',
      what: 'No GitHub? No problem. Paste your code directly or upload a ZIP file. We\'ll create a GitHub repo for you automatically and deploy it.',
    },
  ];

  const selected = SOURCES.find(s => s.id === source);

  // ── ZIP extraction (client-side via JSZip) ──────────────────────────────
  const handleZipUpload = async (file) => {
    setError('');
    setZipFiles([]);
    setZipName(file.name);
    try {
      const JSZip = (await import('jszip')).default;
      const zip   = await JSZip.loadAsync(file);
      const extracted = [];
      const promises   = [];

      zip.forEach((relativePath, zipEntry) => {
        if (zipEntry.dir) return;
        if (
          relativePath.startsWith('__MACOSX') ||
          relativePath.includes('node_modules/') ||
          relativePath.includes('.git/') ||
          relativePath.includes('dist/') ||
          relativePath.includes('.next/') ||
          relativePath.startsWith('.')
        ) return;

        promises.push(
          zipEntry.async('string').then(content => {
            const cleanPath = relativePath.replace(/^[^/]+\//, '');
            if (cleanPath) extracted.push({ path: cleanPath, content });
          })
        );
      });

      await Promise.all(promises);

      if (!extracted.length) {
        setError('The ZIP file appears to be empty or contains only excluded files (node_modules, .git, dist).');
        return;
      }
      setZipFiles(extracted);
    } catch (e) {
      setError('Could not read the ZIP file. Please make sure it is a valid .zip archive.');
    }
  };

  // ── Upload to backend → create GitHub repo ──────────────────────────────
  const handleUploadAndContinue = async () => {
    setError('');
    if (!githubPat.trim()) { setError('Please paste your GitHub token first. Click "How do I get this?" above for help.'); return; }
    if (!appName.trim())   { setError('Please give your app a name.'); return; }

    let files = [];
    if (uploadMode === 'paste') {
      if (!pasteFile.trim())    { setError('Please enter a filename (e.g. index.html or App.jsx).'); return; }
      if (!pasteContent.trim()) { setError('Please paste your code in the box above.'); return; }
      files = [{ path: pasteFile.trim(), content: pasteContent }];
    } else {
      if (!zipFiles.length) { setError('Please upload a ZIP file first.'); return; }
      files = zipFiles;
    }

    setUploading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload-source`, {
        method : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization : `Bearer ${safeGetLocal('mb_token')}`,
        },
        body: JSON.stringify({ files, appName: appName.trim(), githubToken: githubPat.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed.');

      setRepoUrl(data.repoUrl);
      setUploadDone(true);
      setUploadMsg(data.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleNext = () => {
    if (source === 'paste') {
      if (!uploadDone) { setError('Please upload your code first using the button above.'); return; }
      onNext();
      return;
    }
    if (!repoUrl.trim()) { setError('Please paste your app URL above.'); return; }
    if (source === 'replit' && replitToken) safeSetSession('mb_replit_token', replitToken);
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {SOURCES.map(s => (
          <button key={s.id} onClick={() => { setSource(s.id); setError(''); setUploadDone(false); }} style={{
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

      <InfoBox icon="💡" color={C.amber} bg={C.amberBg}>
        <strong>What is {selected?.name}?</strong> {selected?.what}
      </InfoBox>

      {source !== 'paste' && (
        <div>
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
          {source === 'replit' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>
                <Term id="api-token">Replit API Token</Term>{' '}
                <span style={{ fontWeight: 400, color: C.inkLight }}>(only needed for private apps)</span>
              </label>
              <input
                type="password"
                value={replitToken}
                onChange={e => setReplitToken(e.target.value)}
                placeholder="Paste your token here (optional for public apps)"
                style={{ width: '100%', padding: '12px 14px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
              />
              <p style={{ fontSize: 12, color: C.inkMid, marginTop: 6, lineHeight: 1.5 }}>
                Public app? Skip this. Private app? Get your token at{' '}
                <a href="https://replit.com/account" target="_blank" rel="noreferrer" style={{ color: C.amber }}>replit.com/account → API tokens</a>.
              </p>
            </div>
          )}
        </div>
      )}

      {source === 'paste' && (
        <div>
          {uploadDone ? (
            <div style={{ background: C.greenBg, border: `1px solid ${C.green}44`, borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.green, marginBottom: 6 }}>✅ Repo created successfully!</div>
              <div style={{ fontSize: 13, color: '#166534', lineHeight: 1.6, marginBottom: 10 }}>{uploadMsg}</div>
              <div style={{ fontSize: 12, color: C.inkMid }}>
                Your code is now on GitHub. Click <strong>Continue</strong> below to deploy it.
              </div>
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>
                What's your app called?
              </label>
              <input
                value={appName}
                onChange={e => { setAppName(e.target.value); setError(''); }}
                placeholder="e.g. My Todo App, Business Website, Portfolio"
                style={{
                  width: '100%', padding: '11px 13px', border: `1px solid ${C.border}`,
                  borderRadius: 8, fontSize: 14, boxSizing: 'border-box', marginBottom: 16,
                  outline: 'none',
                }}
              />

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[
                  { id: 'paste', icon: '📋', label: 'Paste code', sub: 'From Claude or anywhere' },
                  { id: 'zip',   icon: '📦', label: 'Upload a ZIP', sub: 'Your whole project folder' },
                ].map(m => (
                  <button key={m.id} type="button" onClick={() => { setUploadMode(m.id); setError(''); setUploadDone(false); }} style={{
                    flex: 1, padding: '10px 8px',
                    background: uploadMode === m.id ? C.amberBg : C.surface,
                    border: `1.5px solid ${uploadMode === m.id ? C.amber : C.border}`,
                    borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                    transition: 'all .15s',
                  }}>
                    <div style={{ fontSize: 20, marginBottom: 3 }}>{m.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: uploadMode === m.id ? 700 : 500, color: uploadMode === m.id ? C.amberDark : C.inkMid }}>{m.label}</div>
                    <div style={{ fontSize: 10, color: C.inkLight, marginTop: 1 }}>{m.sub}</div>
                  </button>
                ))}
              </div>

              {uploadMode === 'paste' && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>
                    Filename
                    <span style={{ fontWeight: 400, color: C.inkLight, marginLeft: 6 }}>(e.g. App.jsx, index.html, main.py)</span>
                  </label>
                  <input
                    value={pasteFile}
                    onChange={e => setPasteFile(e.target.value)}
                    placeholder="App.jsx"
                    style={{
                      width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
                      borderRadius: 8, fontSize: 13, fontFamily: 'monospace',
                      boxSizing: 'border-box', marginBottom: 12, outline: 'none',
                    }}
                  />
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>
                    Paste your code here
                  </label>
                  <textarea
                    value={pasteContent}
                    onChange={e => setPasteContent(e.target.value)}
                    placeholder="Paste the code from Claude (or wherever you wrote it) here…"
                    rows={9}
                    style={{
                      width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
                      borderRadius: 8, fontSize: 12, fontFamily: 'monospace',
                      resize: 'vertical', boxSizing: 'border-box', marginBottom: 4,
                      outline: 'none', lineHeight: 1.5,
                    }}
                  />
                  <p style={{ fontSize: 11, color: C.inkLight, marginBottom: 16 }}>
                    💡 Tip: You can push more files after deployment using the "Push a Change" button on your dashboard.
                  </p>
                </div>
              )}

              {uploadMode === 'zip' && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) handleZipUpload(file);
                  }}
                  style={{
                    border: `2px dashed ${zipFiles.length ? C.green : C.amber}`,
                    borderRadius: 12, padding: '2rem',
                    textAlign: 'center', cursor: 'pointer',
                    background: zipFiles.length ? C.greenBg : C.amberBg,
                    marginBottom: 16, transition: 'all .15s',
                  }}
                >
                  <div style={{ fontSize: 36, marginBottom: 8 }}>
                    {zipFiles.length ? '✅' : '📦'}
                  </div>
                  {zipFiles.length > 0 ? (
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: C.green, marginBottom: 4 }}>
                        {zipName} — {zipFiles.length} file{zipFiles.length > 1 ? 's' : ''} found
                      </div>
                      <div style={{ fontSize: 11, color: C.inkMid, marginBottom: 6 }}>
                        (node_modules, .git, dist automatically excluded)
                      </div>
                      <div style={{ maxHeight: 80, overflowY: 'auto', fontSize: 10, fontFamily: 'monospace', color: C.inkMid, textAlign: 'left', padding: '4px 8px', background: '#fff', borderRadius: 6 }}>
                        {zipFiles.slice(0, 20).map((f, i) => <div key={`${i}-${f.path}`}>{f.path}</div>)}
                        {zipFiles.length > 20 && <div>…and {zipFiles.length - 20} more</div>}
                      </div>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setZipFiles([]); setZipName(''); }}
                        style={{ marginTop: 8, fontSize: 11, color: C.red, background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        Remove ZIP
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: C.amberDark, marginBottom: 4 }}>Drop your ZIP here or click to browse</div>
                      <div style={{ fontSize: 11, color: C.inkMid }}>Upload your whole project as a .zip file</div>
                    </div>
                  )}
                  <input
                    ref={fileInputRef} type="file" accept=".zip"
                    style={{ display: 'none' }}
                    onChange={e => { if (e.target.files[0]) handleZipUpload(e.target.files[0]); }}
                  />
                </div>
              )}

              <GithubPatGuide value={githubPat} onChange={setGithubPat} />

              {error && (
                <div style={{ background: C.redBg, border: `1px solid ${C.red}44`, borderRadius: 8, padding: '10px 13px', color: C.red, fontSize: 13, marginBottom: 14 }}>
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleUploadAndContinue}
                disabled={uploading}
                style={{
                  width: '100%', padding: '13px',
                  background: uploading ? C.inkLight : `linear-gradient(135deg, ${C.amber}, ${C.amberDark})`,
                  color: '#fff', border: 'none', borderRadius: 10,
                  fontWeight: 700, fontSize: 15, cursor: uploading ? 'default' : 'pointer',
                  boxShadow: uploading ? 'none' : '0 4px 14px rgba(217,119,6,.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {uploading ? (
                  <><span>⏳</span> Creating your GitHub repo…</>
                ) : (
                  <><span>🚀</span> Create my GitHub repo & continue</>
                )}
              </button>

              {uploading && (
                <div style={{ fontSize: 12, color: C.inkMid, textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>
                  Pushing your files to GitHub… this takes about 10 seconds
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {source !== 'paste' && (
        <details style={{ marginBottom: 20 }}>
          <summary style={{ fontSize: 13, color: C.inkMid, cursor: 'pointer', userSelect: 'none' }}>
            Advanced: specify a <Term id="branch">branch</Term> (optional)
          </summary>
          <div style={{ marginTop: 10 }}>
            <input
              value={branch}
              onChange={e => setBranch(e.target.value)}
              placeholder="main"
              style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>
        </details>
      )}

      {error && source !== 'paste' && (
        <div style={{ background: C.redBg, border: `1px solid ${C.red}44`, borderRadius: 8, padding: '10px 14px', color: C.red, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {(source !== 'paste' || uploadDone) && (
        <button onClick={handleNext} style={{
          width: '100%', padding: '14px', background: C.amber, color: '#fff',
          border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 16, cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(217,119,6,.3)', transition: 'all .15s', marginTop: 12,
        }}>
          Continue → Let's set up your accounts
        </button>
      )}
    </div>
  );
}

// ─── Step 1: Platform setup guides ───────────────────────────────────────────
const PLATFORM_GUIDES = [
  {
    id: 'anthropic', icon: '🤖', name: 'Anthropic API Key', tagline: 'The AI brain that reads your code',
    what: 'Anthropic makes the Claude AI. We use it to read your code and understand how to deploy it correctly.',
    why: 'Without this, our AI cannot understand what your app does or how to set it up properly.',
    steps: [
      { n: 1, text: 'Click the button below to open Anthropic\'s website' },
      { n: 2, text: 'Create a free account (takes 2 minutes)' },
      { n: 3, text: 'Click "Create API Key" and give it any name like "MigrateBot"' },
      { n: 4, text: 'Copy the key that starts with "sk-ant-..." and paste it below' },
    ],
    link: 'https://console.anthropic.com/account/keys', linkLabel: 'Open Anthropic Console →',
    placeholder: 'sk-ant-...', field: 'anthropicKey', required: true, termId: 'anthropic',
  },
  {
    id: 'supabase', icon: '🗄️', name: 'Supabase', tagline: 'Your app\'s database and login system',
    what: 'Supabase is where your app stores all its data — user accounts, posts, orders, whatever your app saves.',
    why: 'Your app needs a database to remember things between sessions. Supabase gives you a free, professional-grade database.',
    steps: [
      { n: 1, text: 'Click the button below to open Supabase' },
      { n: 2, text: 'Create a free account with your email or GitHub' },
      { n: 3, text: 'Go to Account Settings (top right) → Access Tokens' },
      { n: 4, text: 'Click "Generate new token", name it "MigrateBot"' },
      { n: 5, text: 'Copy the token and paste it below' },
    ],
    link: 'https://app.supabase.com/account/tokens', linkLabel: 'Open Supabase →',
    placeholder: 'sbp_...', field: 'supabaseKey', required: true, termId: 'supabase',
  },
  {
    id: 'vercel', icon: '▲', name: 'Vercel', tagline: 'Where people visit your app',
    what: 'Vercel is the service that makes your app accessible on the internet.',
    why: 'Without Vercel, your app exists on your computer but nobody else can see it. Vercel puts it on the internet.',
    steps: [
      { n: 1, text: 'Click the button below to open Vercel' },
      { n: 2, text: 'Sign up for free with GitHub or email' },
      { n: 3, text: 'Go to Account Settings → Tokens' },
      { n: 4, text: 'Click "Create Token", name it "MigrateBot", set scope to "Full Account"' },
      { n: 5, text: 'Copy the token and paste it below' },
    ],
    link: 'https://vercel.com/account/tokens', linkLabel: 'Open Vercel →',
    placeholder: 'Paste your Vercel token here', field: 'vercelKey', required: true, termId: 'vercel',
  },
  {
    id: 'railway', icon: '🚂', name: 'Railway', tagline: 'The server that runs your app\'s logic',
    what: 'Railway runs the backend of your app — all the invisible logic that happens when your app sends emails, processes payments, or saves data.',
    why: 'If your app has any logic beyond showing static pages (like user accounts, data, or APIs), Railway is what runs it.',
    steps: [
      { n: 1, text: 'Click the button below to open Railway' },
      { n: 2, text: 'Create a free account' },
      { n: 3, text: 'Click your profile picture → Account Settings → Tokens' },
      { n: 4, text: 'Click "Create Token", give it any name' },
      { n: 5, text: 'Copy the token and paste it below' },
    ],
    link: 'https://railway.app/account/tokens', linkLabel: 'Open Railway →',
    placeholder: 'Paste your Railway token here', field: 'railwayKey', required: true, termId: 'railway',
  },
];
