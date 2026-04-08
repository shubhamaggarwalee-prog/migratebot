/**
 * frontend/pages/migrate.jsx
 * Full 5-step migration wizard — layman-friendly version.
 * Steps: 0 Source → 1 Configure → 2 Pay → 3 Running → 4 Done
 *
 * Task 13: Added "Paste / Upload ZIP" as a 4th source option in Step 0.
 * Task 19: Added AgentChat overlay + preScan health card in StepRunning.
 * Task 9:  Upload handler now detects HTTP 401 (expired JWT) and redirects
 *          to /login?reason=session_expired instead of showing a cryptic
 *          "Upload failed" error with no recovery path.
 * Task 10: GithubPatGuide token validation now requires a ghp_ or github_pat_
 *          prefix instead of length > 10, so "✓ Token looks good" is only
 *          shown for strings that actually look like a GitHub PAT.
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
// Task 10: A valid GitHub PAT must start with "ghp_" (classic token) or
// "github_pat_" (fine-grained token). Anything else — even a long string —
// is almost certainly not a real token, so we withhold the "✓ Token looks good"
// confirmation until the prefix matches.
function isValidGithubPat(value) {
  return value.startsWith('ghp_') || value.startsWith('github_pat_');
}

function GithubPatGuide({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const saved = isValidGithubPat(value);
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
// Max ZIP size accepted before we even touch JSZip (bytes).
const ZIP_MAX_BYTES = 50 * 1024 * 1024; // 50 MB

// fix #2: extensions we treat as binary — read as base64 rather than UTF-8 string
const BINARY_EXTENSIONS = new Set([
  'png','jpg','jpeg','gif','webp','svg','ico','bmp','tiff',
  'pdf','zip','gz','tar','woff','woff2','ttf','eot','otf',
  'mp4','mp3','wav','ogg','webm','mov',
]);
function isBinary(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

function StepSource({ onNext }) {
  const router = useRouter(); // Task 9: needed for 401 redirect
  const { repoUrl, setRepoUrl, branch, setBranch } = useWizardStore();
  const [source, setSource]       = useState('github');
  const [replitToken, setReplitToken] = useState('');
  const [error, setError]         = useState('');

  // ── Paste/ZIP state ──────────────────────────────────────────────────────
  const [uploadMode,   setUploadMode]   = useState('paste');   // 'paste' | 'zip'
  const [pasteFile,    setPasteFile]    = useState('');         // filename
  const [pasteContent, setPasteContent] = useState('');         // code content
  const [zipFiles,     setZipFiles]     = useState([]);         // [{ path, content, encoding? }]
  const [zipName,      setZipName]      = useState('');
  const [appName,      setAppName]      = useState('');
  const [githubPat,    setGithubPat]    = useState('');
  const [uploading,    setUploading]    = useState(false);
  const [uploadDone,   setUploadDone]   = useState(false);
  const [uploadMsg,    setUploadMsg]    = useState('');
  // fix: ref lives at component level — always mounted, never conditionally rendered
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

    // fix: pre-check size before handing off to JSZip — avoids browser hang on huge files
    if (file.size > ZIP_MAX_BYTES) {
      setError(`ZIP file is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 50 MB. Try removing node_modules, .git, or dist before zipping.`);
      return;
    }

    try {
      const JSZip =
        (await import('jszip')).default ||
        (await import('jszip'));

      const zip = await JSZip.loadAsync(file);
      const entries = [];

      // fix #1: filter out __MACOSX and .DS_Store junk that macOS adds to ZIPs
      const SKIP_PATTERNS = [
        /^__MACOSX\//,
        /\/__MACOSX\//,
        /\.DS_Store$/,
        /^node_modules\//,
        /\/node_modules\//,
        /^\.git\//,
        /\/\.git\//,
        /^dist\//,
        /\/dist\//,
      ];

      const fileEntries = Object.entries(zip.files).filter(
        ([path, entry]) => !entry.dir && !SKIP_PATTERNS.some(re => re.test(path))
      );

      for (const [path, entry] of fileEntries) {
        if (isBinary(path)) {
          const b64 = await entry.async('base64');
          entries.push({ path, content: b64, encoding: 'base64' });
        } else {
          const text = await entry.async('string');
          entries.push({ path, content: text });
        }
      }

      if (!entries.length) {
        setError('The ZIP file appears to be empty or contains only excluded files (node_modules, .git, dist).');
        return;
      }
      setZipFiles(entries);
    } catch {
      setError('Could not read the ZIP file. Please make sure it is a valid .zip archive.');
    }
  };

  const handleUpload = async () => {
    setError('');
    if (!githubPat.trim()) { setError('Please paste your GitHub token first. Click "How do I get this?" above for help.'); return; }
    if (!appName.trim())   { setError('Please give your app a name.'); return; }

    let files;
    if (uploadMode === 'paste') {
      if (!pasteFile.trim())    { setError('Please enter a filename (e.g. index.html or App.jsx).'); return; }
      if (!pasteContent.trim()) { setError('Please paste your code in the box above.'); return; }
      if (new Blob([pasteContent]).size > 500 * 1024) {
        setError('Pasted code is too large (max 500 KB). Please upload a ZIP file instead.');
        return;
      }
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
      // Task 9: A 401 means the JWT expired mid-wizard.
      // Show a clear message then redirect to /login so the user
      // can re-authenticate and come back — rather than seeing a
      // cryptic "Upload failed" error with no recovery path.
      if (res.status === 401) {
        router.push('/login?reason=session_expired');
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Upload failed.');

      setRepoUrl(data.repoUrl);
      setUploadDone(true);
      setUploadMsg(data.message);
      // fix #5: clear PAT from component state after successful upload — no reason
      // to keep it in memory once the repo has been created
      setGithubPat('');
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleNext = () => {
    if (source === 'paste') {
      if (!uploadDone) { setError('Please upload your code first using the button above.'); return; }
    } else {
      if (!repoUrl.trim()) { setError('Please paste your app URL above.'); return; }
    }
    if (source === 'replit' && replitToken) safeSetSession('mb_replit_token', replitToken);
    onNext({ source, repoUrl, branch });
  };

  return (
    <div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: C.ink, marginBottom: 6 }}>Where is your app?</h2>
      <p style={{ fontSize: 14, color: C.inkMid, marginBottom: 24, lineHeight: 1.6 }}>
        Choose where your app currently lives. Don't worry if you're not sure — we'll help you figure it out.
      </p>

      {/* Source selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
        {SOURCES.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => { setSource(s.id); setError(''); }}
            style={{
              padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              border: `2px solid ${source === s.id ? C.amber : C.border}`,
              background: source === s.id ? C.amberBg : C.surface,
              transition: 'all .15s',
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{s.name}</div>
            <div style={{ fontSize: 11, color: C.inkMid, marginTop: 2 }}>{s.desc}</div>
          </button>
        ))}
      </div>

      {/* What is this? box */}
      {selected && (
        <InfoBox icon="💡" color={C.amber} bg={C.amberBg}>
          <strong>What is {selected.name}?</strong> {selected.what}
        </InfoBox>
      )}

      {/* Source-specific inputs */}
      {source !== 'paste' && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6 }}>
            {source === 'github'   ? 'GitHub link to your app' :
             source === 'replit'   ? 'Replit link to your app' :
             source === 'emergent' ? 'Emergent link to your app' : 'App URL'}
          </label>
          <input
            type="url"
            value={repoUrl}
            placeholder={selected?.placeholder || 'https://...'}
            onChange={e => { setRepoUrl(e.target.value); setError(''); }}
            style={{
              width: '100%', padding: '11px 13px',
              border: `2px solid ${repoUrl ? C.amber : C.border}`,
              borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none',
            }}
          />
        </div>
      )}

      {/* Replit token */}
      {source === 'replit' && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6 }}>Replit API token <span style={{ fontWeight: 400, color: C.inkLight }}>(optional — needed for private repls)</span></label>
          <input
            type="password"
            value={replitToken}
            onChange={e => setReplitToken(e.target.value)}
            placeholder="replit_…"
            style={{ width: '100%', padding: '11px 13px', border: `2px solid ${replitToken ? C.amber : C.border}`, borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
          />
        </div>
      )}

      {/* ── Paste / ZIP panel ── */}
      {source === 'paste' && (
        <div>
          {uploadDone ? (
            <>
              <div style={{ background: C.greenBg, border: `1px solid ${C.green}33`, borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: '#166534', lineHeight: 1.6, marginBottom: 10 }}>{uploadMsg}</div>
                <div style={{ fontSize: 12, color: '#166534' }}>✓ Repository created: <strong>{repoUrl}</strong></div>
              </div>
              <button
                type="button"
                onClick={() => { setUploadDone(false); setUploadMsg(''); setRepoUrl(''); setZipFiles([]); setZipName(''); }}
                style={{ fontSize: 12, color: C.amber, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', marginBottom: 16 }}
              >
                ← Upload different code
              </button>
            </>
          ) : (
            <>
              {/* App name */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6 }}>
                  App name <span style={{ fontWeight: 400, color: C.inkLight }}>(used as your repo name)</span>
                </label>
                <input
                  type="text"
                  value={appName}
                  placeholder="my-cool-app"
                  onChange={e => { setAppName(e.target.value); setError(''); }}
                  style={{
                    width: '100%', padding: '11px 13px',
                    border: `2px solid ${appName ? C.amber : C.border}`,
                    borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none',
                  }}
                />
              </div>

              {/* GitHub PAT */}
              <GithubPatGuide value={githubPat} onChange={setGithubPat} />

              {/* Paste vs ZIP toggle */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {[{ id: 'paste', label: '📋 Paste code', sub: 'Single file' }, { id: 'zip', label: '📦 Upload ZIP', sub: 'Whole project' }].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={uploadMode === m.id}
                    onClick={() => {
                      setUploadMode(m.id);
                      setError('');
                      // fix #3: reset both uploadDone AND uploadMsg so the success
                      // banner doesn't linger when the user switches mode
                      setUploadDone(false);
                      setUploadMsg('');
                    }}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                      background: uploadMode === m.id ? C.amberBg : C.surface,
                      border: `1.5px solid ${uploadMode === m.id ? C.amber : C.border}`,
                      textAlign: 'center', transition: 'all .15s',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: uploadMode === m.id ? 700 : 500, color: uploadMode === m.id ? C.amberDark : C.inkMid }}>{m.label}</div>
                    <div style={{ fontSize: 10, color: C.inkLight, marginTop: 2 }}>{m.sub}</div>
                  </button>
                ))}
              </div>

              {uploadMode === 'paste' && (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6 }}>Filename</label>
                    <input
                      type="text"
                      value={pasteFile}
                      placeholder="App.jsx"
                      onChange={e => { setPasteFile(e.target.value); setError(''); }}
                      style={{ width: '100%', padding: '9px 12px', border: `1.5px solid ${pasteFile ? C.amber : C.border}`, borderRadius: 7, fontSize: 13, boxSizing: 'border-box', outline: 'none', fontFamily: 'monospace' }}
                    />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6 }}>Paste your code here</label>
                    <textarea
                      value={pasteContent}
                      onChange={e => { setPasteContent(e.target.value); setError(''); }}
                      rows={10}
                      placeholder="Paste your code here…"
                      style={{
                        width: '100%', padding: '10px 12px', fontFamily: 'monospace', fontSize: 12,
                        border: `1.5px solid ${pasteContent ? C.amber : C.border}`,
                        borderRadius: 7, resize: 'vertical', boxSizing: 'border-box', outline: 'none', lineHeight: 1.5,
                      }}
                    />
                  </div>
                </>
              )}

              {uploadMode === 'zip' && (
                <div style={{ marginBottom: 14 }}>
                  {/* fix: hidden file input is ALWAYS rendered (unconditionally) so
                      uploadMode === 'zip' conditional — so fileInputRef.current is always
                      defined when handleUpload fires */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) handleZipUpload(f);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: '100%', padding: '28px 16px', border: `2px dashed ${zipFiles.length ? C.green : C.border}`,
                      borderRadius: 10, background: zipFiles.length ? C.greenBg : C.surface,
                      cursor: 'pointer', textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 6 }}>{zipFiles.length ? '✅' : '📦'}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>
                      {zipFiles.length
                        ? `${zipFiles.length} file${zipFiles.length > 1 ? 's' : ''} loaded from ${zipName}`
                        : 'Click to choose a ZIP file'}
                    </div>
                    <div style={{ fontSize: 11, color: C.inkLight, marginTop: 4 }}>Max 50 MB · ZIP only</div>
                  </button>

                  {zipFiles.length > 0 && (
                    <details style={{ marginTop: 10, fontSize: 12, color: C.inkMid }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>View {zipFiles.length} file{zipFiles.length > 1 ? 's' : ''}</summary>
                      <ul style={{ marginTop: 6, paddingLeft: 18, maxHeight: 160, overflowY: 'auto' }}>
                        {zipFiles.map((f) => (
                          <li key={f.path} style={{ marginBottom: 2 }}>{f.path}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                style={{
                  width: '100%', padding: '13px', borderRadius: 9, border: 'none',
                  background: uploading ? C.inkLight : C.amber,
                  color: '#fff',
                  fontWeight: 700, fontSize: 15, cursor: uploading ? 'default' : 'pointer',
                  boxShadow: uploading ? 'none' : '0 4px 14px rgba(217,119,6,.3)',
                }}
              >
                {uploading ? (
                  <span>⏳ Creating your GitHub repo…</span>
                ) : (
                  <span>🚀 Create my GitHub repo</span>
                )}
              </button>
              {uploading && (
                <p style={{ fontSize: 12, color: C.inkMid, textAlign: 'center', marginTop: 8 }}>
                  This takes about 10–20 seconds. Don't close this tab.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {error && (
        <div role="alert" style={{ background: C.redBg, border: `1px solid ${C.red}33`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.red, marginTop: 12 }}>
          {error}
        </div>
      )}

      {(source !== 'paste' || uploadDone) && (
        <button
          type="button"
          onClick={handleNext}
          style={{
            marginTop: 24, width: '100%', padding: '14px',
            background: C.amber, color: '#fff', border: 'none',
            borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(217,119,6,.25)',
          }}
        >
          Next: Set up your deployment →
        </button>
      )}
    </div>
  );
}

// ─── Step 1: Configure ───────────────────────────────────────────────────────
function StepConfigure({ onNext, onBack }) {
  const { repoUrl, setRepoUrl, branch, setBranch,
          backendType, setBackendType, dbType, setDbType,
          envVars, setEnvVars } = useWizardStore();
  const [error, setError] = useState('');
  const [showEnv, setShowEnv] = useState(false);

  const handleNext = () => {
    if (!repoUrl.trim()) { setError('Please provide the URL to your repository.'); return; }
    onNext({ repoUrl, branch, backendType, dbType, envVars });
  };

  return (
    <div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: C.ink, marginBottom: 6 }}>Set up your deployment</h2>
      <p style={{ fontSize: 14, color: C.inkMid, marginBottom: 24, lineHeight: 1.6 }}>
        Tell us a bit about your app so we can deploy it correctly.
      </p>

      {/* Repo URL */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6 }}>GitHub URL</label>
        <input
          type="url"
          value={repoUrl}
          placeholder="https://github.com/yourname/your-app"
          onChange={e => { setRepoUrl(e.target.value); setError(''); }}
          style={{ width: '100%', padding: '11px 13px', border: `2px solid ${repoUrl ? C.amber : C.border}`, borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
        />
      </div>

      {/* Branch */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6 }}>Branch <span style={{ fontWeight: 400, color: C.inkLight }}>(usually main)</span></label>
        <input
          type="text"
          value={branch}
          onChange={e => { setBranch(e.target.value); setError(''); }}
          placeholder="main"
          style={{ width: '100%', padding: '11px 13px', border: `2px solid ${branch ? C.amber : C.border}`, borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
        />
      </div>

      {/* Backend type */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 8 }}>Does your app have a backend?</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ id: 'none', label: 'No backend' }, { id: 'node', label: 'Node.js' }, { id: 'python', label: 'Python' }, { id: 'other', label: 'Other' }].map(t => (
            <button key={t.id} type="button"
              onClick={() => setBackendType(t.id)}
              style={{
                flex: 1, padding: '9px 6px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `2px solid ${backendType === t.id ? C.amber : C.border}`,
                background: backendType === t.id ? C.amberBg : C.surface, color: backendType === t.id ? C.amberDark : C.inkMid,
              }}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {/* Database */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 8 }}>Does your app use a database?</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ id: 'none', label: 'No database' }, { id: 'postgres', label: 'PostgreSQL' }, { id: 'mysql', label: 'MySQL' }, { id: 'mongo', label: 'MongoDB' }].map(d => (
            <button key={d.id} type="button"
              onClick={() => setDbType(d.id)}
              style={{
                flex: 1, padding: '9px 6px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `2px solid ${dbType === d.id ? C.amber : C.border}`,
                background: dbType === d.id ? C.amberBg : C.surface, color: dbType === d.id ? C.amberDark : C.inkMid,
              }}
            >{d.label}</button>
          ))}
        </div>
      </div>

      {/* Environment variables */}
      <div style={{ marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setShowEnv(v => !v)}
          style={{ fontSize: 13, color: C.amber, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
        >
          {showEnv ? '▲ Hide' : '▼ Add'} environment variables (optional)
        </button>
        {showEnv && (
          <div style={{ marginTop: 10 }}>
            <InfoBox icon="🔒" color={C.amber} bg={C.amberBg}>
              Environment variables are secret settings your app needs to run — like API keys or database passwords. They never appear in your code.
            </InfoBox>
            <textarea
              value={envVars}
              onChange={e => setEnvVars(e.target.value)}
              rows={5}
              placeholder={"KEY=value\nANOTHER_KEY=another_value"}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, padding: '10px', border: `1px solid ${C.border}`, borderRadius: 8, resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>
        )}
      </div>

      {error && (
        <div role="alert" style={{ background: C.redBg, border: `1px solid ${C.red}33`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.red, marginTop: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={onBack}
          style={{ flex: 1, padding: '13px', borderRadius: 9, border: `2px solid ${C.border}`, background: C.surface, color: C.inkMid, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
        >← Back</button>
        <button type="button" onClick={handleNext}
          style={{ flex: 2, padding: '13px', background: C.amber, color: '#fff', border: 'none', borderRadius: 9, fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(217,119,6,.25)' }}
        >Next: Payment →</button>
      </div>
    </div>
  );
}

// ─── Step 2: Pay ─────────────────────────────────────────────────────────────
function StepPay({ onNext, onBack }) {
  const router = useRouter();
  const { repoUrl } = useWizardStore();
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const handlePay = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await migrations.createMigration({
        repoUrl,
        source: 'wizard',
      });
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        onNext();
      }
    } catch (err) {
      setError(err.message || 'Could not start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: C.ink, marginBottom: 6 }}>Review and pay</h2>
      <p style={{ fontSize: 14, color: C.inkMid, marginBottom: 24, lineHeight: 1.6 }}>One-time payment. Your app will be live within minutes.</p>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: C.inkMid, marginBottom: 6 }}>Deploying:</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.ink, wordBreak: 'break-all' }}>{repoUrl}</div>
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Full deployment</div>
              <div style={{ fontSize: 12, color: C.inkMid, marginTop: 2 }}>Frontend + Backend + Database setup</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.amber }}>$29</div>
          </div>
        </div>
      </div>

      <InfoBox icon="🔒" color={C.green} bg={C.greenBg}>
        Powered by Stripe. We never see or store your card details.
      </InfoBox>

      {error && (
        <div role="alert" style={{ background: C.redBg, border: `1px solid ${C.red}33`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.red, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button type="button" onClick={onBack}
          style={{ flex: 1, padding: '13px', borderRadius: 9, border: `2px solid ${C.border}`, background: C.surface, color: C.inkMid, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
        >← Back</button>
        <button type="button" onClick={handlePay} disabled={loading}
          style={{ flex: 2, padding: '13px', background: loading ? C.inkLight : C.amber, color: '#fff', border: 'none', borderRadius: 9, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 4px 14px rgba(217,119,6,.25)' }}
        >{loading ? '⏳ Redirecting to Stripe…' : '💳 Pay and deploy →'}</button>
      </div>
    </div>
  );
}

// ─── Step 3: Running ─────────────────────────────────────────────────────────
function StepRunning({ migrationId, onDone }) {
  const [log, setLog]               = useState([]);
  const [status, setStatus]         = useState('running');
  const [deployedUrls, setDeployedUrls] = useState(null);
  const [agentPaused, setAgentPaused]   = useState(false);   // Task 19
  const [agentContext, setAgentContext] = useState(null);     // Task 19
  const [preScanData, setPreScanData]   = useState(null);    // Task 19
  const logEndRef = useRef();

  useMigrationSocket(migrationId, {
    onLog: (msg) => setLog(prev => [...prev, msg]),
    onStatus: (s) => {
      setStatus(s);
      if (s === 'done' || s === 'failed') onDone(s, deployedUrls);
    },
    onDeployedUrls: (urls) => setDeployedUrls(urls),
    onAgentPause:  (ctx) => { setAgentPaused(true);  setAgentContext(ctx); },  // Task 19
    onAgentResume: ()    => { setAgentPaused(false); setAgentContext(null); }, // Task 19
    onPreScan:     (data) => setPreScanData(data),                              // Task 19
  });

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  return (
    <div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: C.ink, marginBottom: 6 }}>Deploying your app…</h2>
      <p style={{ fontSize: 14, color: C.inkMid, marginBottom: 20, lineHeight: 1.6 }}>This usually takes 3–5 minutes. You can watch what's happening below.</p>

      {/* Task 19: preScan health card */}
      {preScanData && (
        <div style={{ background: preScanData.healthy ? C.greenBg : C.amberBg, border: `1px solid ${preScanData.healthy ? C.green : C.amber}33`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{preScanData.healthy ? '✅ Pre-scan passed' : '⚠️ Pre-scan found issues'}</div>
          {preScanData.issues?.map((iss, i) => <div key={i} style={{ color: C.inkMid }}>{iss}</div>)}
        </div>
      )}

      {/* Task 19: AgentChat overlay */}
      {agentPaused && migrationId && (
        <AgentChat
          migrationId={migrationId}
          context={agentContext}
          onResolved={() => { setAgentPaused(false); setAgentContext(null); }}
        />
      )}

      {/* Log terminal */}
      <div style={{
        background: '#0F1117', borderRadius: 10, padding: '14px 16px',
        height: 260, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12,
        color: '#C8D3F5', lineHeight: 1.6,
      }}>
        {log.length === 0 && <span style={{ color: '#4C5374' }}>Waiting for logs…</span>}
        {log.map((line, i) => <div key={i}>{line}</div>)}
        <div ref={logEndRef} />
      </div>

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: status === 'running' ? C.amber : status === 'done' ? C.green : C.red,
          animation: status === 'running' ? 'pulse 1.2s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontSize: 13, color: C.inkMid }}>
          {status === 'running' ? 'Deployment in progress…' : status === 'done' ? 'Deployment complete!' : 'Deployment failed'}
        </span>
      </div>
    </div>
  );
}

// ─── Step 4: Done ─────────────────────────────────────────────────────────────
function StepDone({ deployedUrls }) {
  const router = useRouter();
  const urls   = deployedUrls || {};

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: C.ink, marginBottom: 8 }}>Your app is live!</h2>
      <p style={{ fontSize: 15, color: C.inkMid, marginBottom: 24, lineHeight: 1.7 }}>Congratulations — your app has been deployed and is now accessible to anyone in the world.</p>

      {Object.keys(urls).length > 0 && (
        <div style={{ background: C.greenBg, border: `1px solid ${C.green}33`, borderRadius: 12, padding: '16px 20px', marginBottom: 24, textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#065F46', marginBottom: 10 }}>🌐 Your live URLs</div>
          {urls.frontend && <div style={{ marginBottom: 6 }}><span style={{ fontSize: 12, color: C.inkLight }}>Frontend:</span> <a href={urls.frontend} target="_blank" rel="noreferrer" style={{ color: C.amber, fontWeight: 700, fontSize: 13 }}>{urls.frontend}</a></div>}
          {urls.backend  && <div style={{ marginBottom: 6 }}><span style={{ fontSize: 12, color: C.inkLight }}>Backend:</span>  <a href={urls.backend}  target="_blank" rel="noreferrer" style={{ color: C.amber, fontWeight: 700, fontSize: 13 }}>{urls.backend}</a></div>}
          {urls.database && <div>               <span style={{ fontSize: 12, color: C.inkLight }}>Database:</span> <a href={urls.database} target="_blank" rel="noreferrer" style={{ color: C.amber, fontWeight: 700, fontSize: 13 }}>{urls.database}</a></div>}
        </div>
      )}

      <button
        type="button"
        onClick={() => router.push('/dashboard')}
        style={{ padding: '13px 32px', background: C.amber, color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(217,119,6,.25)' }}
      >
        Go to my dashboard →
      </button>
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────
export default function Migrate() {
  const router = useRouter();
  const [step, setStep]             = useState(0);
  const [migrationId, setMigrationId] = useState(null);
  const [deployedUrls, setDeployedUrls] = useState(null);

  // Restore migration in progress after Stripe redirect
  useEffect(() => {
    const mid = router.query.migration_id;
    if (mid) {
      setMigrationId(mid);
      setStep(3);
    }
  }, [router.query]);

  const handleStep0 = ({ source, repoUrl, branch }) => {
    setStep(1);
  };
  const handleStep1 = () => setStep(2);
  const handleStep2 = () => setStep(3);
  const handleDone  = (status, urls) => {
    setDeployedUrls(urls);
    setStep(4);
  };

  return (
    <>
      <Head>
        <title>Deploy my app — MigrateBot</title>
        <meta name="description" content="Deploy your app in minutes with MigrateBot" />
      </Head>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: C.surface,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 16px',
        fontFamily: 'Inter, -apple-system, sans-serif',
      }}>
        <div style={{ width: '100%', maxWidth: 560 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>⚡</div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: C.ink, margin: 0 }}>MigrateBot</h1>
            <p style={{ fontSize: 13, color: C.inkLight, marginTop: 4 }}>Deploy your app — no coding skills required</p>
          </div>

          <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: '28px 32px', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
            <StepBar step={step} />

            {step === 0 && <StepSource   onNext={handleStep0} />}
            {step === 1 && <StepConfigure onNext={handleStep1} onBack={() => setStep(0)} />}
            {step === 2 && <StepPay      onNext={handleStep2} onBack={() => setStep(1)} />}
            {step === 3 && migrationId && <StepRunning migrationId={migrationId} onDone={handleDone} />}
            {step === 4 && <StepDone deployedUrls={deployedUrls} />}
          </div>
        </div>
      </div>
    </>
  );
}
