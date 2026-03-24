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

const C = {
  amber: '#D97706', amberBg: '#FEF3C7', amberDark: '#B45309',
  ink: '#1A1814', inkMid: '#5C574E', inkLight: '#9B958A',
  border: '#E5E2DA', surface: '#F8F7F4', green: '#059669',
  greenBg: '#D1FAE5', red: '#DC2626', redBg: '#FEE2E2',
  blue: '#2563EB', blueBg: '#DBEAFE',
};

// ─── Your App hero section (shown after successful migration) ─────────────────
function YourAppSection({ migration }) {
  const [expanded, setExpanded] = useState(true);
  const urls = migration.deployed_urls || {};
  const plan = migration.plan || 'starter';
  const savings = plan === 'pro' ? '$2,750' : '$900';
  const devCost = plan === 'pro' ? '$3,000+' : '$1,000+';
  const platforms = migration.platforms || [];

  const urlItems = [
    urls.frontend && { icon: '🌐', label: 'Your app (what visitors see)', url: urls.frontend },
    urls.backend  && { icon: '⚙️', label: 'Your backend server',          url: urls.backend },
    urls.database && { icon: '🗄️', label: 'Your database dashboard',      url: urls.database },
  ].filter(Boolean);

  const platformDescriptions = {
    vercel:   'your app is live on the internet via Vercel',
    railway:  'your backend server is running on Railway',
    supabase: 'your database is set up on Supabase',
  };

  const deployedDescriptions = platforms
    .filter(p => platformDescriptions[p])
    .map(p => platformDescriptions[p]);

  return (
    <div style={{
      background: '#fff', borderRadius: 16, border: `2px solid ${C.green}`,
      marginBottom: '2rem', overflow: 'hidden',
      boxShadow: '0 4px 24px rgba(5,150,105,.1)',
    }}>
      {/* Header */}
      <div style={{
        background: C.greenBg, padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>🎉</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: C.ink }}>Your App is Live!</div>
            <div style={{ fontSize: 13, color: C.inkMid, marginTop: 2 }}>
              {migration.reponame || migration.repourl} — deployed {new Date(migration.updated_at || migration.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.inkLight, fontSize: 13 }}
        >
          {expanded ? 'Hide ▲' : 'Show ▼'}
        </button>
      </div>

      {expanded && (
        <div style={{ padding: '20px 24px' }}>

          {/* Plain English summary */}
          <div style={{
            background: C.blueBg, border: `1px solid ${C.blue}33`,
            borderRadius: 10, padding: '14px 16px', marginBottom: 20,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.blue, marginBottom: 6 }}>
              📋 What we deployed for you
            </div>
            <p style={{ fontSize: 14, color: C.inkMid, lineHeight: 1.7, margin: 0 }}>
              We took your code from <strong style={{ color: C.ink }}>{migration.source_platform || 'your source'}</strong> and
              made it a professional, live app —{' '}
              {deployedDescriptions.length > 0
                ? deployedDescriptions.join(', ') + '.'
                : 'fully deployed and accessible to anyone in the world.'}
              {' '}Anyone can now visit your app from any device, anywhere.
            </p>
          </div>

          {/* Live URLs */}
          {urlItems.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 10 }}>
                🔗 Your live links
              </div>
              {urlItems.map(item => (
                <div key={item.url} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: C.inkMid, marginBottom: 3 }}>
                    {item.icon} {item.label}
                  </div>
                  <a
                    href={item.url}
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
                    <span>{item.url}</span>
                    <span style={{ flexShrink: 0, marginLeft: 8 }}>↗</span>
                  </a>
                </div>
              ))}
            </div>
          )}

          {/* Cost savings */}
          <div style={{
            background: C.greenBg, border: `1px solid ${C.green}33`,
            borderRadius: 10, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: 10 }}>
              💰 What you saved
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: C.inkMid }}>A freelance developer would have charged</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.red, textDecoration: 'line-through' }}>{devCost}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: C.inkMid }}>Time it would have taken them</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.red, textDecoration: 'line-through' }}>2–5 days</span>
            </div>
            <div style={{
              borderTop: `1px solid ${C.green}44`, paddingTop: 10, marginTop: 4,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>You saved approximately</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: C.green }}>{savings} 🚀</span>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { migrations, isLoading, refresh } = useMigrations();

  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading, router]);

  if (loading || isLoading) return <Layout><div style={{ textAlign: 'center', padding: '4rem', color: '#6B6860' }}>Loading...</div></Layout>;

  // Most recent successful migration (for Your App section)
  const latestSuccess = migrations.find(m => m.status === 'complete' && m.deployed_urls);

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: '#1A1814', margin: 0 }}>Dashboard</h1>
          <p style={{ color: '#6B6860', marginTop: 4 }}>Welcome back, {user?.name || user?.email}</p>
        </div>
        <Link href="/migrate" style={{ padding: '10px 20px', background: '#D97706', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>+ New Migration</Link>
      </div>

      {/* Your App section — only shown after a successful migration */}
      {latestSuccess && <YourAppSection migration={latestSuccess} />}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: '2rem' }}>
        {[
          { label: 'Total',       value: migrations.length,                                                            color: '#D97706' },
          { label: 'Complete',    value: migrations.filter(m => m.status === 'complete').length,                       color: '#059669' },
          { label: 'In Progress', value: migrations.filter(m => ['deploying','analyzing'].includes(m.status)).length,  color: '#2563EB' },
          { label: 'Failed',      value: migrations.filter(m => m.status === 'failed').length,                         color: '#DC2626' },
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
