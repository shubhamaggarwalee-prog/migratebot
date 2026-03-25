/**
 * frontend/pages/update.jsx
 * /update — one-click re-deploy after a Claude change (Task 14)
 *
 * Features:
 *  - Migration picker (dropdown of the user's completed migrations)
 *  - Paste mode  : filename + textarea for each file the user wants to update
 *  - ZIP mode    : drag-and-drop ZIP extraction via JSZip (same as /migrate Task 13)
 *  - Diff viewer : shows exactly which lines changed before committing
 *  - Live progress bar driven by Socket.io update_progress events
 *  - Completion email sent by the backend (no frontend work needed)
 *  - Link to the live updated app on completion
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { io as socketIO } from 'socket.io-client';

const C = {
  amber: '#D97706', amberBg: '#FEF3C7', amberDark: '#B45309',
  ink: '#1A1814', inkMid: '#5C574E', inkLight: '#9B958A',
  border: '#E5E2DA', surface: '#F8F7F4',
  green: '#059669', greenBg: '#D1FAE5',
  red: '#DC2626',   redBg: '#FEE2E2',
  blue: '#2563EB',  blueBg: '#DBEAFE',
};

// ─── tiny helpers ────────────────────────────────────────────────────────────

function apiBase() { return process.env.NEXT_PUBLIC_API_URL || ''; }
function authHeader() {
  return { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('mb_token') : ''}` };
}

// ─── sub-components ──────────────────────────────────────────────────────────

function InfoBox({ icon = 'ℹ', color = C.blue, bg = C.blueBg, children }) {
  return (
    <div style={{ background: bg, border: `1px solid ${color}33`, borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
      <span style={{ color, fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

/** Single file entry — filename input + textarea. */
function FileEntry({ index, file, onChange, onRemove, canRemove }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px', marginBottom: 10, background: '#fff' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <input
          value={file.path}
          onChange={e => onChange(index, 'path', e.target.value)}
          placeholder="Filename — e.g. App.jsx, api/index.js"
          style={{ flex: 1, padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, fontFamily: 'monospace', outline: 'none' }}
        />
        {canRemove && (
          <button type="button" onClick={() => onRemove(index)}
            style={{ padding: '6px 10px', background: C.redBg, color: C.red, border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
          >✕</button>
        )}
      </div>
      <textarea
        value={file.content}
        onChange={e => onChange(index, 'content', e.target.value)}
        placeholder="Paste the updated code here…"
        rows={7}
        style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box', outline: 'none', lineHeight: 1.5 }}
      />
    </div>
  );
}

/** Visual diff viewer — shows added/removed line counts + preview lines. */
function DiffViewer({ diff }) {
  if (!diff?.length) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 10 }}>📋 What's changing</div>
      {diff.map(d => (
        <div key={d.file} style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: C.surface }}>
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.ink, flex: 1 }}>{d.file}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
              background: d.type === 'added' ? C.greenBg : C.amberBg,
              color: d.type === 'added' ? C.green : C.amberDark,
            }}>{d.type === 'added' ? '+ new file' : 'modified'}</span>
            {d.linesAdded   > 0 && <span style={{ fontSize: 11, color: C.green,  fontWeight: 600 }}>+{d.linesAdded}</span>}
            {d.linesRemoved > 0 && <span style={{ fontSize: 11, color: C.red,    fontWeight: 600 }}>-{d.linesRemoved}</span>}
          </div>
          {d.preview?.length > 0 && (
            <div style={{ background: '#1A1814', padding: '10px 14px' }}>
              {d.preview.map((line, i) => (
                <div key={i} style={{ fontFamily: 'monospace', fontSize: 11, lineHeight: 1.7,
                  color: line.sign === '+' ? '#6EE7B7' : '#FCA5A5',
                }}>{line.sign} {line.text}</div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Animated progress bar. */
function ProgressBar({ pct, stage, msg }) {
  const color = stage === 'done' ? C.green : stage === 'error' ? C.red : C.amber;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: C.inkMid }}>{msg || 'Working…'}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: 8, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: color, width: `${pct}%`, borderRadius: 4, transition: 'width .4s ease' }} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {[
          { id: 'loading',    label: '① Loading' },
          { id: 'diffing',    label: '② Diffing' },
          { id: 'committing', label: '③ Committing' },
          { id: 'deploying',  label: '④ Deploying' },
          { id: 'done',       label: '⑤ Live!' },
        ].map(s => {
          const stages = ['loading', 'diffing', 'committing', 'deploying', 'done'];
          const current = stages.indexOf(stage);
          const me      = stages.indexOf(s.id);
          const done    = me < current || stage === 'done';
          const active  = me === current;
          return (
            <div key={s.id} style={{
              fontSize: 11, fontWeight: active ? 700 : 500,
              padding: '3px 10px', borderRadius: 20, border: `1.5px solid ${done || active ? color : C.border}`,
              background: done ? color : active ? `${color}22` : '#fff',
              color: done ? '#fff' : active ? color : C.inkLight,
              transition: 'all .3s',
            }}>{s.label}</div>
          );
        })}
      </div>
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function UpdatePage() {
  // Migration selection
  const [migrations,      setMigrations]      = useState([]);
  const [migrationsLoaded, setMigrationsLoaded] = useState(false);
  const [selectedMigId,   setSelectedMigId]   = useState('');

  // Input mode
  const [mode,            setMode]            = useState('paste');  // 'paste' | 'zip'
  const [pasteFiles,      setPasteFiles]      = useState([{ path: '', content: '' }]);
  const [zipFiles,        setZipFiles]        = useState([]);
  const [zipName,         setZipName]         = useState('');
  const [commitMsg,       setCommitMsg]       = useState('');
  const fileInputRef = useRef();

  // Submit state
  const [submitting,      setSubmitting]      = useState(false);
  const [error,           setError]           = useState('');

  // Result
  const [result,          setResult]          = useState(null);  // API response
  const [progress,        setProgress]        = useState(null);  // { pct, stage, msg }

  // Socket
  const socketRef = useRef(null);

  // ── Load user's completed migrations ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`${apiBase()}/api/migrations`, { headers: authHeader() });
        const data = await res.json();
        const done = (data.migrations || []).filter(m => m.status === 'complete');
        setMigrations(done);
        if (done.length === 1) setSelectedMigId(done[0].id);
      } catch { /* ignore */ } finally {
        setMigrationsLoaded(true);
      }
    })();
  }, []);

  // ── Socket setup / teardown ───────────────────────────────────────────────
  const connectSocket = useCallback((migId) => {
    if (socketRef.current) socketRef.current.disconnect();
    const s = socketIO(apiBase(), { transports: ['websocket'] });
    s.on('connect', () => s.emit('join', `update:${migId}`));
    s.on('update_progress', data => setProgress(data));
    socketRef.current = s;
  }, []);

  useEffect(() => () => socketRef.current?.disconnect(), []);

  // ── ZIP extraction ────────────────────────────────────────────────────────
  const handleZip = async (file) => {
    setError(''); setZipFiles([]); setZipName(file.name);
    try {
      const JSZip    = (await import('jszip')).default;
      const zip      = await JSZip.loadAsync(file);
      const extracted = [];
      const promises  = [];
      zip.forEach((rel, entry) => {
        if (entry.dir) return;
        if (/(__MACOSX|node_modules\/|\.git\/|dist\/|\.next\/)/.test(rel) || rel.startsWith('.')) return;
        promises.push(entry.async('string').then(content => {
          const path = rel.replace(/^[^/]+\//, '');
          if (path) extracted.push({ path, content });
        }));
      });
      await Promise.all(promises);
      if (!extracted.length) { setError('No usable files found in the ZIP.'); return; }
      setZipFiles(extracted);
    } catch { setError('Could not read the ZIP. Please try again.'); }
  };

  // ── Paste file helpers ────────────────────────────────────────────────────
  const updatePasteFile = (i, field, val) =>
    setPasteFiles(prev => prev.map((f, idx) => idx === i ? { ...f, [field]: val } : f));
  const addPasteFile  = () => setPasteFiles(prev => [...prev, { path: '', content: '' }]);
  const removePasteFile = i => setPasteFiles(prev => prev.filter((_, idx) => idx !== i));

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError(''); setResult(null); setProgress(null);
    if (!selectedMigId) { setError('Please select a migration first.'); return; }

    let files = [];
    if (mode === 'paste') {
      for (const f of pasteFiles) {
        if (!f.path.trim())    { setError('Please fill in the filename for every file.'); return; }
        if (!f.content.trim()) { setError(`No content for "${f.path}". Paste your updated code.`); return; }
      }
      files = pasteFiles.map(f => ({ path: f.path.trim(), content: f.content }));
    } else {
      if (!zipFiles.length)  { setError('Please upload a ZIP file first.'); return; }
      files = zipFiles;
    }

    connectSocket(selectedMigId);
    setSubmitting(true);
    setProgress({ stage: 'loading', pct: 3, msg: 'Starting…' });

    try {
      const res  = await fetch(`${apiBase()}/api/update-deploy/${selectedMigId}`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body   : JSON.stringify({ files, commitMessage: commitMsg.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      setResult(data);
    } catch (e) {
      setError(e.message);
      setProgress(null);
    } finally {
      setSubmitting(false);
    }
  };

  const done = progress?.stage === 'done';

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>Update My App — MigrateBot</title>
        <meta name="description" content="Push Claude's latest changes to your live app in one click." />
      </Head>
      <div style={{ minHeight: '100vh', background: C.surface, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px' }}>
        <div style={{ width: '100%', maxWidth: 620 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 28 }}>⚡</span>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: C.ink }}>Migrate<span style={{ color: C.amber }}>Bot</span></div>
            </div>
            <Link href="/dashboard" style={{ fontSize: 13, color: C.inkMid, textDecoration: 'none' }}>← Dashboard</Link>
          </div>

          <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: '28px', boxShadow: '0 2px 20px rgba(0,0,0,.06)' }}>

            {done ? (
              /* ── Success state ─────────────────────────────────────── */
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>🚀</div>
                <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: C.ink, marginBottom: 8 }}>Your update is live!</h2>
                <p style={{ color: C.inkMid, fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
                  {result?.filesChanged} file{result?.filesChanged > 1 ? 's' : ''} committed and deployed.
                  {result?.filesUnchanged > 0 && ` (${result.filesUnchanged} file${result.filesUnchanged > 1 ? 's' : ''} unchanged — skipped)`}
                  {' '}We'll send you an email when Vercel confirms it's fully live.
                </p>
                <ProgressBar pct={100} stage="done" msg="Deployed! ✓" />
                {result?.diff && <DiffViewer diff={result.diff} />}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                  {result?.deploymentUrl && (
                    <a href={result.deploymentUrl} target="_blank" rel="noreferrer" style={{ padding: '11px 20px', background: C.green, color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>View live app →</a>
                  )}
                  {result?.repoUrl && (
                    <a href={result.repoUrl} target="_blank" rel="noreferrer" style={{ padding: '11px 20px', background: '#fff', color: C.ink, border: `1px solid ${C.border}`, borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>View on GitHub →</a>
                  )}
                  <button onClick={() => { setResult(null); setProgress(null); setPasteFiles([{ path: '', content: '' }]); setZipFiles([]); setCommitMsg(''); }} style={{ padding: '11px 20px', background: C.amberBg, color: C.amberDark, border: `1px solid ${C.amber}44`, borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Push another change</button>
                </div>
              </div>
            ) : (
              /* ── Input state ───────────────────────────────────────── */
              <div>
                <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: C.ink, marginBottom: 6 }}>Push an update 🔄</h2>
                <p style={{ color: C.inkMid, fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
                  Got new code from Claude? Paste it here and we'll commit the changes, redeploy your app, and email you when it's live.
                </p>

                <InfoBox icon="⚡" color={C.amber} bg={C.amberBg}>
                  <strong>Only changed lines get committed.</strong> We compare your new code against what's already on GitHub and only push what's actually different — so your repo stays clean.
                </InfoBox>

                {/* Migration selector */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>Which app do you want to update?</label>
                  {!migrationsLoaded ? (
                    <div style={{ fontSize: 13, color: C.inkLight, padding: 10 }}>Loading your apps…</div>
                  ) : migrations.length === 0 ? (
                    <div style={{ background: C.redBg, borderRadius: 8, padding: '12px 14px', fontSize: 13, color: C.red }}>
                      No completed migrations found.{' '}
                      <Link href="/migrate" style={{ color: C.red, fontWeight: 700 }}>Deploy your first app →</Link>
                    </div>
                  ) : (
                    <select
                      value={selectedMigId}
                      onChange={e => setSelectedMigId(e.target.value)}
                      style={{ width: '100%', padding: '11px 13px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 14, outline: 'none', background: '#fff', cursor: 'pointer' }}
                    >
                      <option value="">— Select an app —</option>
                      {migrations.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.app_name || m.repourl?.split('/').pop() || m.id.slice(0, 12)} · deployed {new Date(m.completed_at || m.updated_at).toLocaleDateString()}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Mode tabs */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {[
                    { id: 'paste', icon: '📋', label: 'Paste updated files', sub: 'From Claude or anywhere' },
                    { id: 'zip',   icon: '📦', label: 'Upload a ZIP',        sub: 'Your whole updated project' },
                  ].map(m => (
                    <button key={m.id} type="button" onClick={() => { setMode(m.id); setError(''); }} style={{
                      flex: 1, padding: '10px 8px',
                      background: mode === m.id ? C.amberBg : C.surface,
                      border: `1.5px solid ${mode === m.id ? C.amber : C.border}`,
                      borderRadius: 10, cursor: 'pointer', textAlign: 'center', transition: 'all .15s',
                    }}>
                      <div style={{ fontSize: 20, marginBottom: 3 }}>{m.icon}</div>
                      <div style={{ fontSize: 12, fontWeight: mode === m.id ? 700 : 500, color: mode === m.id ? C.amberDark : C.inkMid }}>{m.label}</div>
                      <div style={{ fontSize: 10, color: C.inkLight, marginTop: 1 }}>{m.sub}</div>
                    </button>
                  ))}
                </div>

                {/* Paste mode */}
                {mode === 'paste' && (
                  <div>
                    {pasteFiles.map((f, i) => (
                      <FileEntry key={i} index={i} file={f} onChange={updatePasteFile} onRemove={removePasteFile} canRemove={pasteFiles.length > 1} />
                    ))}
                    <button type="button" onClick={addPasteFile} style={{ width: '100%', padding: '9px', background: C.surface, border: `1.5px dashed ${C.amber}`, borderRadius: 8, color: C.amberDark, fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 16 }}>
                      + Add another file
                    </button>
                  </div>
                )}

                {/* ZIP mode */}
                {mode === 'zip' && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); if (e.dataTransfer.files[0]) handleZip(e.dataTransfer.files[0]); }}
                    style={{
                      border: `2px dashed ${zipFiles.length ? C.green : C.amber}`,
                      borderRadius: 12, padding: '2rem', textAlign: 'center', cursor: 'pointer',
                      background: zipFiles.length ? C.greenBg : C.amberBg, marginBottom: 16, transition: 'all .15s',
                    }}
                  >
                    <div style={{ fontSize: 36, marginBottom: 8 }}>{zipFiles.length ? '✅' : '📦'}</div>
                    {zipFiles.length > 0 ? (
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: C.green, marginBottom: 4 }}>{zipName} — {zipFiles.length} file{zipFiles.length > 1 ? 's' : ''} found</div>
                        <div style={{ maxHeight: 70, overflowY: 'auto', fontSize: 10, fontFamily: 'monospace', color: C.inkMid, textAlign: 'left', padding: '4px 8px', background: '#fff', borderRadius: 6, marginTop: 6 }}>
                          {zipFiles.slice(0, 15).map(f => <div key={f.path}>{f.path}</div>)}
                          {zipFiles.length > 15 && <div>…and {zipFiles.length - 15} more</div>}
                        </div>
                        <button type="button" onClick={e => { e.stopPropagation(); setZipFiles([]); setZipName(''); }}
                          style={{ marginTop: 8, fontSize: 11, color: C.red, background: 'none', border: 'none', cursor: 'pointer' }}>Remove ZIP</button>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: C.amberDark, marginBottom: 4 }}>Drop your ZIP here or click to browse</div>
                        <div style={{ fontSize: 11, color: C.inkMid }}>Upload your updated project as a .zip</div>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept=".zip" style={{ display: 'none' }}
                      onChange={e => { if (e.target.files[0]) handleZip(e.target.files[0]); }} />
                  </div>
                )}

                {/* Commit message */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>Commit message <span style={{ fontWeight: 400, color: C.inkLight }}>(optional — we'll write one if you skip this)</span></label>
                  <input
                    value={commitMsg}
                    onChange={e => setCommitMsg(e.target.value)}
                    placeholder="e.g. Fix login bug, Add dark mode, Update homepage copy"
                    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Live progress (shows after submit) */}
                {progress && (
                  <ProgressBar pct={progress.pct} stage={progress.stage} msg={progress.msg} />
                )}

                {/* Error */}
                {error && (
                  <div style={{ background: C.redBg, border: `1px solid ${C.red}44`, borderRadius: 8, padding: '10px 13px', color: C.red, fontSize: 13, marginBottom: 14 }}>{error}</div>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || migrations.length === 0}
                  style={{
                    width: '100%', padding: 14,
                    background: submitting ? C.inkLight : `linear-gradient(135deg, ${C.amber}, ${C.amberDark})`,
                    color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15,
                    cursor: submitting ? 'default' : 'pointer',
                    boxShadow: submitting ? 'none' : '0 4px 14px rgba(217,119,6,.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {submitting
                    ? <><span>⏳</span> Deploying your changes…</>
                    : <><span>🚀</span> Commit changes &amp; redeploy</>
                  }
                </button>
                {submitting && (
                  <p style={{ fontSize: 12, color: C.inkMid, textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>
                    Comparing, committing, and deploying… keep this tab open.
                  </p>
                )}
              </div>
            )}
          </div>

          <p style={{ fontSize: 11, color: C.inkLight, textAlign: 'center', marginTop: 16 }}>
            🔒 Only changed lines are committed · You'll get an email when it's live
          </p>
        </div>
      </div>
    </>
  );
}
