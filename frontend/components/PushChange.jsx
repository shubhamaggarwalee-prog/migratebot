/**
 * frontend/components/PushChange.jsx
 *
 * "Push a Change" panel — lets a non-technical user paste new code
 * or upload a file and have it committed + redeployed without
 * touching GitHub.
 *
 * Usage:
 *   <PushChange migration={latestSuccess} onSuccess={() => {}} />
 */
import { useState, useRef } from 'react';

const C = {
  amber: '#D97706', amberBg: '#FEF3C7', amberDark: '#B45309',
  ink: '#1A1814', inkMid: '#5C574E', inkLight: '#9B958A',
  border: '#E5E2DA', surface: '#F8F7F4',
  green: '#059669', greenBg: '#D1FAE5', greenDark: '#065F46',
  red: '#DC2626', redBg: '#FEE2E2',
  blue: '#2563EB', blueBg: '#DBEAFE',
};

// The three input modes a user can choose
const MODES = [
  { id: 'paste',  icon: '📋', label: 'Paste code',   desc: 'Copy code from Claude and paste it here' },
  { id: 'upload', icon: '📁', label: 'Upload a file', desc: 'Upload a .js, .jsx, .ts, .css, .html file' },
  { id: 'text',   icon: '✏️', label: 'Type a change', desc: 'Edit a small piece of text or config' },
];

// Friendly progress steps shown during the push
const STEPS = [
  { id: 'saving',    label: 'Saving your changes to GitHub…',  icon: '💾' },
  { id: 'deploying', label: 'Telling Vercel to update your app…', icon: '🚀' },
  { id: 'done',      label: 'Done! Your app will be live in ~60 seconds', icon: '✅' },
];

export default function PushChange({ migration, onSuccess }) {
  const [open,          setOpen]         = useState(false);
  const [mode,          setMode]         = useState('paste');
  const [filePath,      setFilePath]     = useState('');
  const [fileContent,   setFileContent]  = useState('');
  const [commitMsg,     setCommitMsg]    = useState('');
  const [uploadedFiles, setUploadedFiles]= useState([]);   // [{ path, content }]
  const [step,          setStep]         = useState(null); // null | 'saving' | 'deploying' | 'done' | 'error'
  const [result,        setResult]       = useState(null);
  const [error,         setError]        = useState('');
  const fileInputRef = useRef();

  // ── File upload handler ────────────────────────────────────────────────
  const handleFileUpload = (e) => {
    const uploaded = [];
    const files = Array.from(e.target.files);
    let remaining = files.length;
    if (!remaining) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        uploaded.push({ path: file.name, content: ev.target.result });
        remaining--;
        if (remaining === 0) setUploadedFiles(uploaded);
      };
      reader.readAsText(file);
    });
  };

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError('');
    setResult(null);

    // Build the files array
    let files = [];
    if (mode === 'upload') {
      if (!uploadedFiles.length) { setError('Please upload at least one file.'); return; }
      files = uploadedFiles;
    } else {
      if (!filePath.trim()) { setError('Please enter a file path (e.g. src/App.jsx).'); return; }
      if (!fileContent.trim()) { setError('Please paste or type some code.'); return; }
      files = [{ path: filePath.trim(), content: fileContent }];
    }

    setStep('saving');

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/push-change/${migration.id}`,
        {
          method : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization : `Bearer ${localStorage.getItem('mb_token')}`,
          },
          body: JSON.stringify({ files, commitMessage: commitMsg.trim() || undefined }),
        }
      );

      // Animate through steps
      setStep('deploying');
      await new Promise(r => setTimeout(r, 900));

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');

      setStep('done');
      setResult(data);
      onSuccess?.();

    } catch (err) {
      setStep('error');
      setError(err.message);
    }
  };

  const reset = () => {
    setStep(null); setResult(null); setError('');
    setFilePath(''); setFileContent(''); setCommitMsg(''); setUploadedFiles([]);
  };

  // ── Collapsed button ──────────────────────────────────────────────────
  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      style={{
        width: '100%', marginBottom: '1.5rem',
        padding: '14px 20px',
        background: '#fff',
        border: `2px solid ${C.amber}`,
        borderRadius: 12, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 14,
        transition: 'all .15s',
        boxShadow: '0 2px 8px rgba(217,119,6,.08)',
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: C.amberBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20,
      }}>✏️</div>
      <div style={{ textAlign: 'left', flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>Push a change to your live app</div>
        <div style={{ fontSize: 12, color: C.inkMid, marginTop: 2 }}>
          Paste code from Claude, upload a file, or type a change — we'll put it live for you
        </div>
      </div>
      <span style={{ color: C.amber, fontSize: 20, flexShrink: 0 }}>▼</span>
    </button>
  );

  // ── Expanded panel ────────────────────────────────────────────────────
  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      border: `2px solid ${C.amber}`,
      marginBottom: '1.5rem',
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(217,119,6,.1)',
    }}>

      {/* Header */}
      <div style={{
        background: C.amberBg, padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>✏️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>Push a change to your app</div>
            <div style={{ fontSize: 11, color: C.inkMid }}>Your change will be live in about 60 seconds</div>
          </div>
        </div>
        <button onClick={() => { setOpen(false); reset(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.inkLight, fontSize: 20 }}>×</button>
      </div>

      <div style={{ padding: '20px' }}>

        {/* ── Progress state ── */}
        {step && step !== 'error' && (
          <div>
            {STEPS.map((s, i) => {
              const idx    = STEPS.findIndex(x => x.id === step);
              const isDone = i < idx || step === 'done';
              const isNow  = s.id === step && step !== 'done';
              return (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0',
                  borderBottom: i < STEPS.length - 1 ? `1px solid ${C.border}` : 'none',
                  opacity: i > idx && step !== 'done' ? 0.4 : 1,
                  transition: 'opacity .3s',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: isDone ? C.greenBg : isNow ? C.amberBg : C.surface,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16,
                    border: `2px solid ${isDone ? C.green : isNow ? C.amber : C.border}`,
                    transition: 'all .3s',
                  }}>
                    {isDone ? '✓' : s.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 14, fontWeight: isNow ? 700 : 500,
                      color: isDone ? C.green : isNow ? C.ink : C.inkMid,
                    }}>{s.label}</div>
                    {isNow && (
                      <div style={{ fontSize: 11, color: C.amber, marginTop: 2, display: 'flex', gap: 3 }}>
                        <span style={{ animation: 'blink 1s infinite' }}>●</span>
                        <span style={{ animation: 'blink 1s infinite .3s' }}>●</span>
                        <span style={{ animation: 'blink 1s infinite .6s' }}>●</span>
                        <style>{`@keyframes blink{0%,100%{opacity:.2}50%{opacity:1}}`}</style>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Done result card */}
            {step === 'done' && result && (
              <div style={{
                marginTop: 16,
                background: C.greenBg, border: `1px solid ${C.green}44`,
                borderRadius: 10, padding: '14px 16px',
              }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.greenDark, marginBottom: 6 }}>
                  🎉 Change pushed successfully!
                </div>
                <div style={{ fontSize: 13, color: '#166534', lineHeight: 1.7, marginBottom: 10 }}>
                  {result.message}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {result.deploymentUrl && (
                    <a href={result.deploymentUrl} target="_blank" rel="noreferrer" style={{
                      padding: '8px 14px', background: C.green, color: '#fff',
                      borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 13,
                    }}>View deployment ↗</a>
                  )}
                  <a href={result.repoUrl} target="_blank" rel="noreferrer" style={{
                    padding: '8px 14px', background: '#fff', color: C.ink,
                    border: `1px solid ${C.border}`, borderRadius: 8,
                    textDecoration: 'none', fontWeight: 600, fontSize: 13,
                  }}>See on GitHub ↗</a>
                  <button onClick={reset} style={{
                    padding: '8px 14px', background: '#fff', color: C.amber,
                    border: `1px solid ${C.amber}`, borderRadius: 8,
                    fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  }}>Push another change</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Error state ── */}
        {step === 'error' && (
          <div style={{
            background: C.redBg, border: `1px solid ${C.red}44`,
            borderRadius: 10, padding: '14px 16px', marginBottom: 16,
          }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.red, marginBottom: 4 }}>Something went wrong</div>
            <div style={{ fontSize: 13, color: C.red, opacity: 0.85, marginBottom: 12 }}>{error}</div>
            <button onClick={reset} style={{
              padding: '8px 14px', background: C.red, color: '#fff',
              border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>Try again</button>
          </div>
        )}

        {/* ── Input form — only shown when not in progress ── */}
        {!step && (
          <div>
            {/* Mode tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {MODES.map(m => (
                <button key={m.id} onClick={() => setMode(m.id)} style={{
                  flex: 1, padding: '10px 8px',
                  background: mode === m.id ? C.amberBg : C.surface,
                  border: `1.5px solid ${mode === m.id ? C.amber : C.border}`,
                  borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                  transition: 'all .15s',
                }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{m.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: mode === m.id ? 700 : 500, color: mode === m.id ? C.amberDark : C.inkMid }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: 10, color: C.inkLight, marginTop: 2, lineHeight: 1.3 }}>{m.desc}</div>
                </button>
              ))}
            </div>

            {/* ── PASTE / TYPE modes ── */}
            {(mode === 'paste' || mode === 'text') && (
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>
                  Which file does this code go in?
                  <span style={{ fontWeight: 400, color: C.inkLight, marginLeft: 6 }}>(e.g. src/App.jsx or index.html)</span>
                </label>
                <input
                  value={filePath}
                  onChange={e => setFilePath(e.target.value)}
                  placeholder="src/App.jsx"
                  style={{
                    width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
                    borderRadius: 8, fontSize: 14, marginBottom: 14,
                    fontFamily: 'monospace', boxSizing: 'border-box',
                    outline: 'none', background: C.surface,
                  }}
                />

                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>
                  {mode === 'paste' ? 'Paste the new code here' : 'Type your change here'}
                </label>
                <textarea
                  value={fileContent}
                  onChange={e => setFileContent(e.target.value)}
                  placeholder={mode === 'paste'
                    ? 'Paste the full file content from Claude here…'
                    : 'Type the new content for this file…'
                  }
                  rows={10}
                  style={{
                    width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
                    borderRadius: 8, fontSize: 13, fontFamily: 'monospace',
                    resize: 'vertical', marginBottom: 14, boxSizing: 'border-box',
                    outline: 'none', lineHeight: 1.6, background: C.surface,
                  }}
                />
              </div>
            )}

            {/* ── UPLOAD mode ── */}
            {mode === 'upload' && (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const dt = e.dataTransfer;
                  handleFileUpload({ target: { files: dt.files } });
                }}
                style={{
                  border: `2px dashed ${uploadedFiles.length ? C.green : C.amber}`,
                  borderRadius: 12, padding: '2.5rem',
                  textAlign: 'center', cursor: 'pointer',
                  background: uploadedFiles.length ? C.greenBg : C.amberBg,
                  marginBottom: 14, transition: 'all .15s',
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>
                  {uploadedFiles.length ? '✅' : '📁'}
                </div>
                {uploadedFiles.length > 0 ? (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.green, marginBottom: 4 }}>
                      {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} ready to push
                    </div>
                    {uploadedFiles.map(f => (
                      <div key={f.path} style={{ fontSize: 12, color: C.inkMid, fontFamily: 'monospace' }}>{f.path}</div>
                    ))}
                    <button
                      onClick={e => { e.stopPropagation(); setUploadedFiles([]); }}
                      style={{ marginTop: 8, fontSize: 12, color: C.red, background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.amberDark, marginBottom: 4 }}>Drop files here or click to browse</div>
                    <div style={{ fontSize: 12, color: C.inkMid }}>Accepts .js .jsx .ts .tsx .css .html .json .md</div>
                  </div>
                )}
                <input
                  ref={fileInputRef} type="file" multiple
                  accept=".js,.jsx,.ts,.tsx,.css,.html,.json,.md,.txt,.py"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
              </div>
            )}

            {/* Optional commit message */}
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>
              What did you change? <span style={{ fontWeight: 400, color: C.inkLight }}>(optional — helps you remember later)</span>
            </label>
            <input
              value={commitMsg}
              onChange={e => setCommitMsg(e.target.value)}
              placeholder="e.g. Added contact form, fixed header colour"
              style={{
                width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
                borderRadius: 8, fontSize: 14, marginBottom: 16,
                fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
              }}
            />

            {/* Error inline */}
            {error && (
              <div style={{ fontSize: 13, color: C.red, marginBottom: 12, padding: '8px 12px', background: C.redBg, borderRadius: 8 }}>
                {error}
              </div>
            )}

            {/* CTA */}
            <button
              onClick={handleSubmit}
              style={{
                width: '100%', padding: '13px',
                background: `linear-gradient(135deg, ${C.amber}, ${C.amberDark})`,
                color: '#fff', border: 'none', borderRadius: 10,
                fontWeight: 700, fontSize: 15, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 14px rgba(217,119,6,.3)',
                transition: 'opacity .15s',
              }}
            >
              <span>🚀</span> Push change and go live
            </button>

            <div style={{ fontSize: 11, color: C.inkLight, textAlign: 'center', marginTop: 8 }}>
              Your code will be committed to GitHub and your live app will update in ~60 seconds
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
