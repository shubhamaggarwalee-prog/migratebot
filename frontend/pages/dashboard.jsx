/**
 * frontend/pages/dashboard.jsx
 * Main dashboard — lists all migrations + Push a Change flow
 * Task 15:  Added HealthWidget inside YourAppSection for each live URL.
 * G1:       Added OnboardingTour for first-time users.
 *           Added tour anchor IDs: tour-new-migration, tour-stats,
 *           tour-migrations-list, tour-settings (on the Layout nav link).
 * Gap 5:    Added search, status filter, and sort to the migrations list.
 */
import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { useMigrations } from '../hooks/useMigrations';
import StatusBadge from '../components/StatusBadge';
import Layout from '../components/Layout';
import Term from '../components/Term';
import PushChange from '../components/PushChange';
import HealthWidget from '../components/HealthWidget';
import OnboardingTour from '../components/OnboardingTour';

const C = {
  amber: '#D97706', amberBg: '#FEF3C7', amberDark: '#B45309',
  ink: '#1A1814', inkMid: '#5C574E', inkLight: '#9B958A',
  border: '#E5E2DA', surface: '#F8F7F4', green: '#059669',
  greenBg: '#D1FAE5', red: '#DC2626', redBg: '#FEE2E2',
  blue: '#2563EB', blueBg: '#DBEAFE',
};

const STATUS_FILTERS = [
  { value: 'all',        label: 'All' },
  { value: 'complete',   label: '✓ Complete' },
  { value: 'deploying',  label: '⚡ Deploying' },
  { value: 'analyzing',  label: '🔍 Analyzing' },
  { value: 'failed',     label: '✗ Failed' },
  { value: 'chat-needed',label: '⏸ Paused' },
];

const SORT_OPTIONS = [
  { value: 'newest',   label: 'Newest first' },
  { value: 'oldest',   label: 'Oldest first' },
  { value: 'name-asc', label: 'Name A → Z' },
  { value: 'name-desc',label: 'Name Z → A' },
  { value: 'status',   label: 'Status' },
];

// ─── Claude Chat Widget ────────────────────────────────────────────────────
function ClaudeChat({ migration }) {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: `Hi! I'm Claude, the AI that helped deploy your app. I know all about your project — feel free to ask me anything! For example:\n\n• "How do I add a custom domain?"\n• "How do I update my app after making changes?"\n• "Why is my app slow?"`,
    },
  ]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput(''); setError('');
    const next = [...messages, { role: 'user', text }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('mb_token')}` },
        body: JSON.stringify({ migration_id: migration.id, messages: next.map(m => ({ role: m.role, content: m.text })) }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', text: data.reply }]);
    } catch { setError('Could not reach Claude. Please try again.'); }
    finally  { setLoading(false); }
  };

  const handleKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <div style={{ marginBottom: '2rem' }}>
      {!open && (
        <button onClick={() => setOpen(true)} style={{ width: '100%', padding: '14px 20px', background: '#fff', border: `2px solid ${C.amber}`, borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>🤖</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>Ask <Term id="claude">Claude</Term> about your app</div>
            <div style={{ fontSize: 12, color: C.inkMid, marginTop: 2 }}>Powered by your <Term id="anthropic">Anthropic</Term> key — ask anything about your <Term id="deployment">deployed</Term> app</div>
          </div>
          <span style={{ marginLeft: 'auto', color: C.amber, fontSize: 18 }}>▼</span>
        </button>
      )}
      {open && (
        <div style={{ background: '#fff', borderRadius: 12, border: `2px solid ${C.amber}`, overflow: 'hidden' }}>
          <div style={{ background: C.amberBg, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.ink }}><Term id="claude">Claude</Term> — Your App Assistant</div>
                <div style={{ fontSize: 11, color: C.inkMid }}>Powered by your <Term id="api-key">Anthropic API key</Term></div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.inkLight, fontSize: 18 }}>×</button>
          </div>
          <div style={{ height: 320, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, background: C.surface }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px', background: m.role === 'user' ? C.amber : '#fff', color: m.role === 'user' ? '#fff' : C.ink, fontSize: 14, lineHeight: 1.6, border: m.role === 'assistant' ? `1px solid ${C.border}` : 'none', whiteSpace: 'pre-wrap' }}>{m.text}</div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}><div style={{ padding: '10px 14px', borderRadius: '12px 12px 12px 2px', background: '#fff', border: `1px solid ${C.border}`, fontSize: 14, color: C.inkLight }}><Term id="claude">Claude</Term> is thinking…</div></div>
            )}
            {error && <div style={{ fontSize: 12, color: C.red, textAlign: 'center' }}>{error}</div>}
            <div ref={bottomRef} />
          </div>
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, background: '#fff' }}>
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} placeholder="Ask anything about your app… (Enter to send)" rows={1} style={{ flex: 1, padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 }} />
            <button onClick={send} disabled={loading || !input.trim()} style={{ padding: '10px 18px', background: loading || !input.trim() ? C.border : C.amber, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: loading || !input.trim() ? 'default' : 'pointer' }}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── YourAppSection ─────────────────────────────────────────────────────────────
function YourAppSection({ migration }) {
  const [expanded, setExpanded] = useState(true);
  const urls      = migration.deployed_urls || {};
  const plan      = migration.plan || 'starter';
  const savings   = plan === 'pro' ? '$2,750' : '$900';
  const devCost   = plan === 'pro' ? '$3,000+' : '$1,000+';
  const platforms = migration.platforms || [];

  const urlItems = [
    urls.frontend && { icon: '🌐', label: 'Your app (what visitors see)', url: urls.frontend },
    urls.backend  && { icon: '⚙️', label: 'Your backend server',          url: urls.backend  },
    urls.database && { icon: '🗄️', label: 'Your database dashboard',      url: urls.database },
  ].filter(Boolean);

  const platformDescriptions = {
    vercel:   'your app is live on the internet via Vercel',
    railway:  'your backend server is running on Railway',
    supabase: 'your database is set up on Supabase',
  };
  const deployedDescriptions = platforms.filter(p => platformDescriptions[p]).map(p => platformDescriptions[p]);

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: `2px solid ${C.green}`, marginBottom: '2rem', overflow: 'hidden', boxShadow: '0 4px 24px rgba(5,150,105,.1)' }}>
      <div style={{ background: C.greenBg, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>🎉</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: C.ink }}>Your App is Live!</div>
            <div style={{ fontSize: 13, color: C.inkMid, marginTop: 2 }}>
              {migration.reponame || migration.repourl} — <Term id="deployment">deployed</Term>{' '}
              {new Date(migration.updated_at || migration.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.inkLight, fontSize: 13 }}>
          {expanded ? 'Hide ▲' : 'Show ▼'}
        </button>
      </div>

      {expanded && (
        <div style={{ padding: '20px 24px' }}>
          <HealthWidget migration={migration} />
          <div style={{ background: C.blueBg, border: `1px solid ${C.blue}33`, borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.blue, marginBottom: 6 }}>📋 What we <Term id="deployment">deployed</Term> for you</div>
            <p style={{ fontSize: 14, color: C.inkMid, lineHeight: 1.7, margin: 0 }}>
              We took your code from <strong style={{ color: C.ink }}>{migration.source_platform || 'your source'}</strong> and made it a professional, live app —{' '}
              {deployedDescriptions.length > 0 ? deployedDescriptions.join(', ') + '.' : 'fully deployed and accessible to anyone in the world.'}
              {' '}Anyone can now visit your app from any device, anywhere.
            </p>
          </div>
          {urlItems.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 10 }}>🔗 Your live links</div>
              {urlItems.map(item => (
                <div key={item.url} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: C.inkMid, marginBottom: 3 }}>{item.icon} {item.label}</div>
                  <a href={item.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.amber, fontWeight: 700, fontSize: 14, textDecoration: 'none', wordBreak: 'break-all' }}>
                    <span>{item.url}</span><span style={{ flexShrink: 0, marginLeft: 8 }}>↗</span>
                  </a>
                </div>
              ))}
            </div>
          )}
          <div style={{ background: C.greenBg, border: `1px solid ${C.green}33`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: 10 }}>💰 What you saved</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: C.inkMid }}>A freelance developer would have charged</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.red, textDecoration: 'line-through' }}>{devCost}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: C.inkMid }}>Time it would have taken them</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.red, textDecoration: 'line-through' }}>2–5 days</span>
            </div>
            <div style={{ borderTop: `1px solid ${C.green}44`, paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>You saved approximately</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: C.green }}>{savings} 🚀</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Gap 5: MigrationsList — search + filter + sort ───────────────────────────
function MigrationsList({ migrations, onRowClick, onRefresh }) {
  const [query,        setQuery]        = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy,       setSortBy]       = useState('newest');

  const STATUS_ORDER = { complete: 0, deploying: 1, analyzing: 2, 'chat-needed': 3, paused: 3, failed: 4 };

  const filtered = useMemo(() => {
    let list = [...migrations];

    // Search: repo name, URL, or platform
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(m =>
        (m.reponame  || '').toLowerCase().includes(q) ||
        (m.repourl   || '').toLowerCase().includes(q) ||
        (m.source_platform || '').toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter(m =>
        statusFilter === 'chat-needed'
          ? ['chat-needed', 'paused'].includes(m.status)
          : m.status === statusFilter
      );
    }

    // Sort
    list.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':    return new Date(a.created_at) - new Date(b.created_at);
        case 'name-asc':  return (a.reponame || a.repourl || '').localeCompare(b.reponame || b.repourl || '');
        case 'name-desc': return (b.reponame || b.repourl || '').localeCompare(a.reponame || a.repourl || '');
        case 'status':    return (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
        default:          return new Date(b.created_at) - new Date(a.created_at); // newest
      }
    });

    return list;
  }, [migrations, query, statusFilter, sortBy]);

  const clearAll = () => { setQuery(''); setStatusFilter('all'); setSortBy('newest'); };
  const hasActiveFilters = query.trim() || statusFilter !== 'all' || sortBy !== 'newest';

  return (
    <div
      id="tour-migrations-list"
      style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}` }}
    >
      {/* ── List header ── */}
      <div style={{
        padding: '14px 16px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
      }}>
        <span style={{ fontWeight: 600, color: C.ink, flexShrink: 0 }}>
          <Term id="migration">Migrations</Term>
          {filtered.length !== migrations.length && (
            <span style={{ marginLeft: 8, fontSize: 12, color: C.inkLight, fontWeight: 400 }}>
              {filtered.length} of {migrations.length}
            </span>
          )}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {hasActiveFilters && (
            <button
              onClick={clearAll}
              style={{ fontSize: 12, color: C.red, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
            >
              Clear filters
            </button>
          )}
          <button
            onClick={onRefresh}
            style={{ background: 'none', border: 'none', color: C.amber, cursor: 'pointer', fontSize: 13 }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ── Search + Filter + Sort bar ── */}
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
        background: C.surface,
      }}>
        {/* Search input */}
        <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 140 }}>
          <span style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            fontSize: 13, color: C.inkLight, pointerEvents: 'none',
          }}>🔍</span>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name or platform…"
            style={{
              width: '100%', paddingLeft: 30, paddingRight: query ? 28 : 10,
              paddingTop: 8, paddingBottom: 8,
              border: `1.5px solid ${query ? C.amber : C.border}`,
              borderRadius: 8, fontSize: 13, outline: 'none',
              background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.inkLight, fontSize: 14, lineHeight: 1 }}
            >×</button>
          )}
        </div>

        {/* Status filter pills */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              style={{
                padding: '5px 11px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                border: `1.5px solid ${statusFilter === f.value ? C.amber : C.border}`,
                background: statusFilter === f.value ? C.amberBg : '#fff',
                color: statusFilter === f.value ? C.amberDark : C.inkMid,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Sort dropdown */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          style={{
            padding: '7px 10px', border: `1.5px solid ${sortBy !== 'newest' ? C.amber : C.border}`,
            borderRadius: 8, fontSize: 12, color: C.inkMid,
            background: '#fff', cursor: 'pointer', outline: 'none',
            fontFamily: 'inherit',
          }}
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* ── Rows ── */}
      {migrations.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: C.inkMid }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🚀</div>
          <p>No <Term id="migration">migrations</Term> yet. <Link href="/migrate" style={{ color: C.amber }}>Start your first one!</Link></p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '2.5rem', textAlign: 'center', color: C.inkMid }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
          <p style={{ fontSize: 14, marginBottom: 8 }}>No migrations match your search or filters.</p>
          <button onClick={clearAll} style={{ background: 'none', border: 'none', color: C.amber, cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>Clear filters</button>
        </div>
      ) : (
        filtered.map((m, idx) => (
          <div
            key={m.id}
            onClick={() => onRowClick(m.id)}
            style={{
              padding: '1rem 1.5rem',
              borderBottom: idx < filtered.length - 1 ? `1px solid #F0EDE6` : 'none',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              cursor: 'pointer',
              transition: 'background .12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = C.surface}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div>
              <div style={{ fontWeight: 600, color: C.ink, fontSize: 14 }}>
                {/* Highlight matched query in name */}
                {query.trim() ? highlightMatch(m.reponame || m.repourl || '', query) : (m.reponame || m.repourl)}
              </div>
              <div style={{ fontSize: 12, color: C.inkLight, marginTop: 2 }}>
                {m.source_platform} • {new Date(m.created_at).toLocaleDateString()}
                {m.branch && <span> • {m.branch}</span>}
              </div>
            </div>
            <StatusBadge status={m.status} />
          </div>
        ))
      )}
    </div>
  );
}

// Highlight search query match inside a string
function highlightMatch(text, query) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <span>
      {text.slice(0, idx)}
      <mark style={{ background: C.amberBg, color: C.amberDark, borderRadius: 3, padding: '0 2px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </span>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const { user, loading }                  = useAuth();
  const { migrations, isLoading, refresh } = useMigrations();

  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading, router]);

  if (loading || isLoading)
    return <Layout><div style={{ textAlign: 'center', padding: '4rem', color: '#6B6860' }}>Loading...</div></Layout>;

  const latestSuccess = migrations.find(m => m.status === 'complete' && m.deployed_urls);

  return (
    <Layout>
      {/* G1: Onboarding tour — only renders once for new users */}
      <OnboardingTour />

      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: C.ink, margin: 0 }}>Dashboard</h1>
          <p style={{ color: C.inkMid, marginTop: 4 }}>Welcome back, {user?.name || user?.email}</p>
        </div>
        <Link
          id="tour-new-migration"
          href="/migrate"
          style={{ padding: '10px 20px', background: C.amber, color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}
        >
          + New <Term id="migration">Migration</Term>
        </Link>
      </div>

      {latestSuccess && <YourAppSection migration={latestSuccess} />}
      {latestSuccess && <PushChange migration={latestSuccess} onSuccess={refresh} />}
      {latestSuccess && <ClaudeChat migration={latestSuccess} />}

      {/* Stats row */}
      <div
        id="tour-stats"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: '2rem' }}
      >
        {[
          { label: 'Total',       value: migrations.length,                                                           color: C.amber },
          { label: 'Complete',    value: migrations.filter(m => m.status === 'complete').length,                      color: C.green },
          { label: 'In Progress', value: migrations.filter(m => ['deploying','analyzing'].includes(m.status)).length, color: C.blue },
          { label: 'Failed',      value: migrations.filter(m => m.status === 'failed').length,                        color: C.red },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '1.25rem' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 13, color: C.inkMid, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Gap 5: searchable + filterable + sortable migrations list */}
      <MigrationsList
        migrations={migrations}
        onRowClick={id => router.push(`/migrations/${id}`)}
        onRefresh={refresh}
      />
    </Layout>
  );
}
