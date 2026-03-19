/**
 * frontend/pages/migrations/[id].jsx
 * Individual migration detail + real-time log
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/api';
import useSocket from '../../hooks/useSocket';

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
    return () => { socket.off('migration:log'); socket.off('migration:complete'); socket.off('migration:error'); };
  }, [socket, id]);

  if (!migration) return <Layout><div style={{ padding: '4rem', textAlign: 'center', color: '#6B6860' }}>Loading migration...</div></Layout>;

  return (
    <Layout>
      <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: '#D97706', cursor: 'pointer', marginBottom: 16, padding: 0 }}>← Dashboard</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: '#1A1814', margin: 0 }}>{migration.reponame || migration.repourl}</h1>
          <p style={{ color: '#6B6860', marginTop: 4, fontSize: 14 }}>{migration.source_platform} • {migration.branch} • {migration.tier}</p>
        </div>
        <StatusBadge status={migration.status} />
      </div>

      {/* Analysis */}
      {migration.analysis_result && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E2DA', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: 15, color: '#1A1814' }}>Analysis</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {Object.entries(migration.analysis_result)
              .filter(([k]) => ['framework', 'language', 'database', 'confidenceScore'].includes(k))
              .map(([k, v]) => (
                <div key={k} style={{ background: '#F8F7F4', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: '#9B9890', textTransform: 'uppercase', marginBottom: 4 }}>{k}</div>
                  <div style={{ fontWeight: 600, color: '#1A1814', fontSize: 14 }}>{String(v)}</div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Live Logs */}
      {logs.length > 0 && (
        <div style={{ background: '#111', borderRadius: 12, padding: '1.5rem' }}>
          <div style={{ fontSize: 12, color: '#6B6860', fontFamily: 'monospace', marginBottom: 8 }}>// deployment log</div>
          {logs.map((l, i) => (
            <div key={i} style={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 1.8, color: l.level === 'success' ? '#4ade80' : l.level === 'error' ? '#f87171' : '#a3a3a3' }}>
              {l.message}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
