import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

const STATUS_LABELS = {
  pending:   { label: 'Pending',   color: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
  analyzing: { label: 'Analyzing', color: '#7C3AED', bg: '#EDE9FE', border: '#C4B5FD' },
  deploying: { label: 'Deploying', color: '#2563EB', bg: '#DBEAFE', border: '#BFDBFE' },
  success:   { label: 'Live',      color: '#059669', bg: '#D1FAE5', border: '#6EE7B7' },
  failed:    { label: 'Failed',    color: '#DC2626', bg: '#FEE2E2', border: '#FCA5A5' },
  refunded:  { label: 'Refunded',  color: '#9B958A', bg: '#F3F2EF', border: '#E5E2DA' },
  cancelled: { label: 'Cancelled', color: '#9B958A', bg: '#F3F2EF', border: '#E5E2DA' },
};

const PAGE_SIZE = 10;

export default function MigrationsList() {
  const router  = useRouter();
  const [migrations, setMigrations] = useState([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('all');
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  const fetchMigrations = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page, limit: PAGE_SIZE,
        ...(search       ? { search }        : {}),
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      });
      const res  = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/migrations?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load migrations');
      setMigrations(data.migrations || []);
      setTotal(data.pagination?.total || 0);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchMigrations(); }, [fetchMigrations]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <Head><title>Migrations — MigrateBot</title></Head>
      <div style={styles.page}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.heading}>Migrations</h1>
            <p style={styles.sub}>{total} total migration{total !== 1 ? 's' : ''}</p>
          </div>
          <Link href="/migrate" style={styles.newBtn}>+ New migration</Link>
        </div>

        {/* Filters */}
        <div style={styles.filters}>
          <input
            type="search" placeholder="Search by repo URL…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={styles.searchInput}
          />
          <select value={statusFilter} onChange={e => setStatus(e.target.value)} style={styles.select}>
            <option value="all">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* Error */}
        {error && <div style={styles.errorBanner}>{error}</div>}

        {/* List */}
        {loading ? (
          <div style={styles.empty}>Loading…</div>
        ) : migrations.length === 0 ? (
          <div style={styles.emptyCard}>
            <p style={{ margin: '0 0 16px', fontSize: 15, color: '#5C574E' }}>
              {search || statusFilter !== 'all' ? 'No migrations match your filters.' : 'No migrations yet.'}
            </p>
            {!search && statusFilter === 'all' && (
              <Link href="/migrate" style={styles.newBtn}>Start your first migration</Link>
            )}
          </div>
        ) : (
          <div style={styles.list}>
            {migrations.map(m => <MigrationRow key={m.id} m={m} />)}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={styles.pagination}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={styles.pageBtn}>← Prev</button>
            <span style={{ fontSize: 13, color: '#5C574E' }}>Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={styles.pageBtn}>Next →</button>
          </div>
        )}
      </div>
    </>
  );
}

function MigrationRow({ m }) {
  const s = STATUS_LABELS[m.status] || STATUS_LABELS.pending;
  const date = m.created_at ? new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const duration = m.duration_seconds ? `${Math.floor(m.duration_seconds / 60)}m ${m.duration_seconds % 60}s` : null;

  return (
    <Link href={`/migrations/${m.id}`} style={styles.row}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={styles.repoUrl}>{m.repo_url}</p>
        <p style={styles.meta}>{date}{duration ? ` · ${duration}` : ''}{m.plan ? ` · ${m.plan}` : ''}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {m.amount_charged > 0 && (
          <span style={styles.amount}>${(m.amount_charged / 100).toFixed(0)}</span>
        )}
        <span style={{ ...styles.badge, color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
          {s.label}
        </span>
      </div>
    </Link>
  );
}

const C = {
  bg: '#F8F7F4', surface: '#FFFFFF', border: '#E5E2DA',
  ink: '#1A1814', inkMid: '#5C574E',
  amber: '#D97706', amberDark: '#B45309',
  red: '#DC2626', redBg: '#FEF2F2',
};

const styles = {
  page:        { maxWidth: 720, margin: '0 auto', padding: '40px 16px', fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif" },
  header:      { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 },
  heading:     { fontSize: 24, fontWeight: 700, color: C.ink, margin: '0 0 4px', letterSpacing: '-0.025em' },
  sub:         { fontSize: 13, color: C.inkMid, margin: 0 },
  newBtn:      { display: 'inline-block', padding: '10px 20px', background: C.amber, color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' },
  filters:     { display: 'flex', gap: 10, marginBottom: 16 },
  searchInput: { flex: 1, padding: '9px 12px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 14, color: C.ink, background: '#FAFAF9', outline: 'none' },
  select:      { padding: '9px 12px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 14, color: C.ink, background: '#FAFAF9', outline: 'none', cursor: 'pointer' },
  errorBanner: { background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.red, marginBottom: 16 },
  empty:       { textAlign: 'center', padding: '60px 0', color: C.inkMid, fontSize: 14 },
  emptyCard:   { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '40px 24px', textAlign: 'center' },
  list:        { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' },
  row:         { display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: `1px solid ${C.border}`, textDecoration: 'none', gap: 12, transition: 'background .15s' },
  repoUrl:     { margin: '0 0 3px', fontSize: 14, fontWeight: 600, color: C.ink, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  meta:        { margin: 0, fontSize: 12, color: C.inkMid },
  badge:       { padding: '3px 10px', borderRadius: 100, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' },
  amount:      { fontSize: 13, fontWeight: 600, color: C.ink },
  pagination:  { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 24 },
  pageBtn:     { padding: '8px 16px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600, color: C.ink, background: C.surface, cursor: 'pointer' },
};
