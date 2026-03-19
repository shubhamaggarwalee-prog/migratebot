/**
 * frontend/pages/dashboard.jsx
 * Main dashboard — lists all migrations
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { useMigrations } from '../hooks/useMigrations';
import StatusBadge from '../components/StatusBadge';
import Layout from '../components/Layout';

export default function Dashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { migrations, isLoading, refresh } = useMigrations();

  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading, router]);

  if (loading || isLoading) return <Layout><div style={{ textAlign: 'center', padding: '4rem', color: '#6B6860' }}>Loading...</div></Layout>;

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: '#1A1814', margin: 0 }}>Dashboard</h1>
          <p style={{ color: '#6B6860', marginTop: 4 }}>Welcome back, {user?.name || user?.email}</p>
        </div>
        <Link href="/migrate" style={{ padding: '10px 20px', background: '#D97706', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>+ New Migration</Link>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: '2rem' }}>
        {[
          { label: 'Total', value: migrations.length, color: '#D97706' },
          { label: 'Complete', value: migrations.filter(m => m.status === 'complete').length, color: '#059669' },
          { label: 'In Progress', value: migrations.filter(m => ['deploying', 'analyzing'].includes(m.status)).length, color: '#2563EB' },
          { label: 'Failed', value: migrations.filter(m => m.status === 'failed').length, color: '#DC2626' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E2DA', padding: '1.25rem' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 13, color: '#6B6860', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Migrations list */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E2DA' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #E5E2DA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, color: '#1A1814' }}>Migrations</span>
          <button onClick={refresh} style={{ background: 'none', border: 'none', color: '#D97706', cursor: 'pointer', fontSize: 13 }}>Refresh</button>
        </div>
        {migrations.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#6B6860' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚀</div>
            <p>No migrations yet. <Link href="/migrate" style={{ color: '#D97706' }}>Start your first one!</Link></p>
          </div>
        ) : (
          migrations.map(m => (
            <div key={m.id} onClick={() => router.push(`/migrations/${m.id}`)} style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #F0EDE6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <div style={{ fontWeight: 600, color: '#1A1814', fontSize: 14 }}>{m.reponame || m.repourl}</div>
                <div style={{ fontSize: 12, color: '#9B9890', marginTop: 2 }}>{m.source_platform} • {new Date(m.created_at).toLocaleDateString()}</div>
              </div>
              <StatusBadge status={m.status} />
            </div>
          ))
        )}
      </div>
    </Layout>
  );
}
