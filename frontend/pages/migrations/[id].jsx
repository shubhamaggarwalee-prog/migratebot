/**
 * frontend/pages/migrations/[id].jsx
 * Individual migration detail + real-time log + What Happens Next guide
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import WhatHappensNext from '../../components/WhatHappensNext';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/api';
import useSocket from '../../hooks/useSocket';

const C = {
  amber: '#D97706', amberBg: '#FEF3C7',
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
  const [logs, setLogs] = useState([]);
  const socket = useSocket();

  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading, router]);

  useEffect(() => {
    if (!id) return;
    apiClient.get(`/api/migrations/${id}`).then(r => setMigration(r.migration)).catch(console.error);
  }, [id]);

  useEffect(() => {
    if (!socket || !id) return;
    socket.emit('join', `migration:${id}`);
    socket.on('migration:log', (entry) => setLogs(l => [...l, entry]));
    socket.on('migration:complete', () => setMigration(m => m ? { ...m, status: 'complete' } : m));
    socket.on('migration:error', ({ error }) => setMigration(m => m ? { ...m, status: 'failed', error_message: error } : m));
    return () => {
      socket.off('migration:log');
      socket.off('migration:complete');
      socket.off('migration:error');
    };
  }, [socket, id]);

  if (!migration) return (
    <Layout>
      <div style={{ padding: '4rem', textAlign: 'center', color: C.inkLight }}>Loading migration...</div>
    </Layout>
  );

  const isComplete = migration.status === 'complete';
  const isFailed   = migration.status === 'failed';

  return (
    <Layout>
      <button
        onClick={() => router.push('/dashboard')}
        style={{ background: 'none', border: 'none', color: C.amber, cursor: 'pointer', marginBottom: 16, padding: 0, fontSize: 14 }}
      >
        ← Dashboard
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: C.ink, margin: 0 }}>
            {migration.reponame || migration.repourl}
          </h1>
          <p style={{ color: C.inkMid, marginTop: 4, fontSize: 14 }}>
            {migration.source_platform} · {migration.branch} · {migration.tier}
          </p>
        </div>
        <StatusBadge status={migration.status} />
      </div>

      {/* Success banner */}
      {isComplete && (
        <div style={{
          background: C.greenBg, border: `1px solid ${C.green}44`,
          borderRadius: 12, padding: '16px 20px', marginBottom: '1.5rem',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <span style={{ fontSize: 28 }}>🎉</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: C.green }}>Your app is live!</div>
            <div style={{ fontSize: 13, color: '#166534', marginTop: 2 }}>
              Migration completed successfully. Your app is now accessible to anyone in the world.
            </div>
          </div>
        </div>
      )}

      {/* Failure banner */}
      {isFailed && (
        <div style={{
          background: '#FFF1F2', border: `1px solid ${C.red}44`,
          borderRadius: 12, padding: '16px 20px', marginBottom: '1.5rem',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <span style={{ fontSize: 28 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: C.red }}>Migration failed</div>
            <div style={{ fontSize: 13, color: C.red, marginTop: 2, opacity: 0.85 }}>
              {migration.error_message || 'Something went wrong. A full refund will be issued within 24 hours.'}
            </div>
          </div>
        </div>
      )}

      {/* Live URLs — shown when complete */}
      {isComplete && migration.deployed_urls && (
        <div style={{
          background: '#fff', borderRadius: 12,
          border: `1px solid ${C.border}`,
          padding: '1.25rem 1.5rem', marginBottom: '1.5rem',
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.ink, marginBottom: 12 }}>🔗 Your live links</div>
          {[
            { key: 'frontend', icon: '🌐', label: 'Your app (what visitors see)' },
            { key: 'backend',  icon: '⚙️', label: 'Your backend server' },
            { key: 'database', icon: '🗄️', label: 'Your database dashboard' },
          ].filter(item => migration.deployed_urls[item.key]).map(item => (
            <div key={item.key} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: C.inkMid, marginBottom: 3 }}>{item.icon} {item.label}</div>
              <a
                href={migration.deployed_urls[item.key]}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', background: C.surface,
                  border: `1px solid ${C.border}`, borderRadius: 8,
                  color: C.amber, fontWeight: 700, fontSize: 14,
                  textDecoration: 'none', wordBreak: 'break-all',
                }}
              >
                <span>{migration.deployed_urls[item.key]}</span>
                <span style={{ flexShrink: 0, marginLeft: 8 }}>↗</span>
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Analysis */}
      {migration.analysis_result && (
        <div style={{
          background: '#fff', borderRadius: 12,
          border: `1px solid ${C.border}`,
          padding: '1.5rem', marginBottom: '1.5rem',
        }}>
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

      {/* Live Logs */}
      {logs.length > 0 && (
        <div style={{ background: '#111', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 12, color: '#6B6860', fontFamily: 'monospace', marginBottom: 8 }}>// deployment log</div>
          {logs.map((l, i) => (
            <div key={i} style={{
              fontFamily: 'monospace', fontSize: 13, lineHeight: 1.8,
              color: l.level === 'success' ? '#4ade80' : l.level === 'error' ? '#f87171' : '#a3a3a3',
            }}>
              {l.message}
            </div>
          ))}
        </div>
      )}

      {/* ─── What Happens Next — only shown on successful migrations ─── */}
      {isComplete && (
        <div style={{
          background: '#fff', borderRadius: 16,
          border: `1px solid ${C.border}`,
          padding: '24px 28px', marginTop: '1.5rem',
          boxShadow: '0 2px 16px rgba(0,0,0,.05)',
        }}>
          <WhatHappensNext
            deployedUrls={migration.deployed_urls}
            sourcePlatform={migration.source_platform}
          />
        </div>
      )}
    </Layout>
  );
}
