/**
 * frontend/pages/migrations/[id].jsx
 * Individual migration detail + real-time log + What Happens Next guide
 * Task 16: Added CostEstimateCard
 * Task 18: Added "Share Receipt" button in the success banner
 * Gap 2:  Added "Resume Deployment" banner + button for paused/chat-needed migrations
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import WhatHappensNext from '../../components/WhatHappensNext';
import CostEstimateCard from '../../components/CostEstimateCard';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/api';
import useSocket from '../../hooks/useSocket';

const C = {
  amber: '#D97706', amberBg: '#FEF3C7', amberDark: '#B45309',
  ink: '#1A1814', inkMid: '#5C574E', inkLight: '#9B958A',
  border: '#E5E2DA', surface: '#F8F7F4',
  green: '#059669', greenBg: '#D1FAE5',
  red: '#DC2626',
};

export default function MigrationDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { user, loading } = useAuth();
  const [migration, setMigration] = useState(null);
  const [logs, setLogs]           = useState([]);
  const [copied, setCopied]       = useState(false);
  const socket = useSocket();

  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading, router]);

  useEffect(() => {
    if (!id) return;
    apiClient.get(`/api/migrations/${id}`).then(r => setMigration(r.migration)).catch(console.error);
  }, [id]);

  useEffect(() => {
    if (!socket || !id) return;
    socket.emit('join', `migration:${id}`);
    socket.on('migration:log',      entry      => setLogs(l => [...l, entry]));
    socket.on('migration:complete', ()         => setMigration(m => m ? { ...m, status: 'complete' } : m));
    socket.on('migration:error',    ({ error }) => setMigration(m => m ? { ...m, status: 'failed', error_message: error } : m));
    // Gap 2: live status update when agent needs input
    socket.on('agent:chat-needed',  ()         => setMigration(m => m ? { ...m, status: 'chat-needed' } : m));
    return () => {
      socket.off('migration:log');
      socket.off('migration:complete');
      socket.off('migration:error');
      socket.off('agent:chat-needed');
    };
  }, [socket, id]);

  const handleCopyReceipt = () => {
    const url = `${window.location.origin}/receipt/${id}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  if (!migration) return (
    <Layout>
      <div style={{ padding: '4rem', textAlign: 'center', color: C.inkLight }}>Loading migration...</div>
    </Layout>
  );

  const isComplete = migration.status === 'complete';
  const isFailed   = migration.status === 'failed';
  const isPaused   = ['paused', 'chat-needed'].includes(migration.status);  // Gap 2
  const receiptUrl = `/receipt/${id}`;

  return (
    <Layout>
      <button
        onClick={() => router.push('/dashboard')}
        style={{ background: 'none', border: 'none', color: C.amber, cursor: 'pointer', marginBottom: 16, padding: 0, fontSize: 14 }}
      >
        ← Dashboard
      </button>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: C.ink, margin: 0 }}>
            {migration.reponame || migration.repourl}
          </h1>
          <p style={{ color: C.inkMid, marginTop: 4, fontSize: 14 }}>
            {migration.source_platform} · {migration.branch} · {migration.tier}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isComplete && (
            <>
              <button
                onClick={handleCopyReceipt}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  background: copied ? C.green : C.surface,
                  color: copied ? '#fff' : C.ink,
                  border: `1px solid ${C.border}`,
                  fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'all .2s',
                }}
              >
                <span>{copied ? '✓' : '🔗'}</span>
                {copied ? 'Link copied!' : 'Share receipt'}
              </button>
              <a
                href={receiptUrl}
                target="_blank" rel="noreferrer"
                style={{ padding: '8px 16px', borderRadius: 8, background: C.amberBg, color: C.amberDark, border: `1px solid ${C.amber}44`, fontWeight: 600, fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                📄 View receipt ↗
              </a>
            </>
          )}
          <StatusBadge status={migration.status} />
        </div>
      </div>

      {/* ── Gap 2: Paused / chat-needed banner ── */}
      {isPaused && (
        <div style={{
          background: C.amberBg,
          border: `2px solid ${C.amber}`,
          borderRadius: 14, padding: '18px 22px',
          marginBottom: '1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 30 }}>⏸</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: C.amberDark, marginBottom: 4 }}>
                Deployment paused — the AI needs your help
              </div>
              <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.6 }}>
                Your deployment stopped mid-way because the AI agent hit something it couldn't
                decide on its own. Answer one quick question and it will pick up right where it left off.
              </div>
            </div>
          </div>
          <button
            onClick={() => router.push(`/migrations/resume?id=${id}`)}
            style={{
              flexShrink: 0,
              padding: '12px 22px',
              background: C.amber,
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(217,119,6,.3)',
              whiteSpace: 'nowrap',
            }}
          >
            💬 Resume deployment →
          </button>
        </div>
      )}

      {/* ── Success banner ── */}
      {isComplete && (
        <div style={{ background: C.greenBg, border: `1px solid ${C.green}44`, borderRadius: 12, padding: '16px 20px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 28 }}>🎉</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: C.green }}>Your app is live!</div>
              <div style={{ fontSize: 13, color: '#166534', marginTop: 2 }}>Migration completed successfully. Your app is now accessible to anyone in the world.</div>
            </div>
          </div>
          <a
            href={receiptUrl}
            target="_blank" rel="noreferrer"
            style={{ flexShrink: 0, padding: '9px 16px', borderRadius: 8, background: C.green, color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            📄 Share receipt
          </a>
        </div>
      )}

      {/* ── Failure banner ── */}
      {isFailed && (
        <div style={{ background: '#FFF1F2', border: `1px solid ${C.red}44`, borderRadius: 12, padding: '16px 20px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 28 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: C.red }}>Migration failed</div>
            <div style={{ fontSize: 13, color: C.red, marginTop: 2, opacity: 0.85 }}>
              {migration.error_message || 'Something went wrong. A full refund will be issued within 24 hours.'}
            </div>
          </div>
        </div>
      )}

      {/* ── Live URLs ── */}
      {isComplete && migration.deployed_urls && (
        <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.ink, marginBottom: 12 }}>🔗 Your live links</div>
          {[
            { key: 'frontend', icon: '🌐', label: 'Your app (what visitors see)' },
            { key: 'backend',  icon: '⚙️', label: 'Your backend server' },
            { key: 'database', icon: '🗄️', label: 'Your database dashboard' },
          ].filter(item => migration.deployed_urls[item.key]).map(item => (
            <div key={item.key} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: C.inkMid, marginBottom: 3 }}>{item.icon} {item.label}</div>
              <a href={migration.deployed_urls[item.key]} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.amber, fontWeight: 700, fontSize: 14, textDecoration: 'none', wordBreak: 'break-all' }}
              >
                <span>{migration.deployed_urls[item.key]}</span>
                <span style={{ flexShrink: 0, marginLeft: 8 }}>↗</span>
              </a>
            </div>
          ))}
        </div>
      )}

      {/* ── Analysis ── */}
      {migration.analysis_result && (
        <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: 15, color: C.ink }}>Analysis</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {Object.entries(migration.analysis_result)
              .filter(([k]) => ['framework', 'language', 'database', 'confidenceScore'].includes(k))
              .map(([k, v]) => (
                <div key={k} style={{ background: C.surface, borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: C.inkLight, textTransform: 'uppercase', marginBottom: 4 }}>{k}</div>
                  <div style={{ fontWeight: 600, color: C.ink, fontSize: 14 }}>{String(v)}</div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Live Logs ── */}
      {logs.length > 0 && (
        <div style={{ background: '#111', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 12, color: '#6B6860', fontFamily: 'monospace', marginBottom: 8 }}>// deployment log</div>
          {logs.map((l, i) => (
            <div key={i} style={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 1.8, color: l.level === 'success' ? '#4ade80' : l.level === 'error' ? '#f87171' : '#a3a3a3' }}>
              {l.message}
            </div>
          ))}
        </div>
      )}

      {/* ── Cost estimate card (Task 16) ── */}
      {isComplete && <CostEstimateCard migration={migration} />}

      {/* ── What Happens Next ── */}
      {isComplete && (
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: '24px 28px', marginTop: '1.5rem', boxShadow: '0 2px 16px rgba(0,0,0,.05)' }}>
          <WhatHappensNext deployedUrls={migration.deployed_urls} sourcePlatform={migration.source_platform} />
        </div>
      )}
    </Layout>
  );
}
