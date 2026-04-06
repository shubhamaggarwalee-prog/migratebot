/**
 * frontend/pages/admin.jsx
 * Admin panel — users, migrations, refunds.
 * Access is restricted to the email in NEXT_PUBLIC_ADMIN_EMAIL.
 */
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

const API = process.env.NEXT_PUBLIC_API_URL || '';
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || '';

const C = {
  amber: '#D97706', amberBg: '#FEF3C7', amberDark: '#B45309',
  ink: '#1A1814', inkMid: '#6B6860', inkLight: '#9B958A',
  border: '#E5E2DA', surface: '#F8F7F4',
  green: '#059669', greenBg: '#D1FAE5',
  red: '#DC2626', redBg: '#FEE2E2',
  blue: '#2563EB', blueBg: '#DBEAFE',
};

const STATUS_COLORS = {
  success:   { bg: C.greenBg, color: C.green },
  failed:    { bg: C.redBg,   color: C.red },
  refunded:  { bg: '#F3F4F6', color: '#374151' },
  deploying: { bg: C.blueBg,  color: C.blue },
  paid:      { bg: C.amberBg, color: C.amberDark },
  pending:   { bg: '#F3F4F6', color: '#374151' },
  analyzing: { bg: C.blueBg,  color: C.blue },
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || { bg: '#F3F4F6', color: '#374151' };
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '2px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
    }}>
      {status}
    </span>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12,
      padding: '1.25rem 1.5rem', flex: 1, minWidth: 140,
    }}>
      <div style={{ fontSize: 11, color: C.inkLight, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color || C.ink, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.inkMid, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
      <button onClick={() => onPage(page - 1)} disabled={page <= 1}
        style={{ padding: '4px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13,
          background: page <= 1 ? C.surface : '#fff', color: C.ink, cursor: page <= 1 ? 'default' : 'pointer' }}>
        ← Prev
      </button>
      <span style={{ fontSize: 13, color: C.inkMid, alignSelf: 'center' }}>{page} / {totalPages}</span>
      <button onClick={() => onPage(page + 1)} disabled={page >= totalPages}
        style={{ padding: '4px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13,
          background: page >= totalPages ? C.surface : '#fff', color: C.ink, cursor: page >= totalPages ? 'default' : 'pointer' }}>
        Next →
      </button>
    </div>
  );
}

export default function AdminPanel() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [tab, setTab]           = useState('migrations');
  const [stats, setStats]       = useState(null);
  const [users, setUsers]       = useState([]);
  const [userPages, setUserPages] = useState({ page: 1, totalPages: 1 });
  const [migrations, setMigrations] = useState([]);
  const [migPages, setMigPages] = useState({ page: 1, totalPages: 1 });
  const [statusFilter, setStatusFilter] = useState('');
  const [refunding, setRefunding] = useState(null); // migrationId being refunded
  const [toast, setToast]       = useState(null);
  const [loadingData, setLoadingData] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Access guard
  useEffect(() => {
    if (!authLoading && (!user || user.email !== ADMIN_EMAIL)) {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Fetch stats ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || user.email !== ADMIN_EMAIL) return;
    fetch(`${API}/api/admin/stats`, { headers })
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(err => console.error('stats:', err));
  }, [user]);

  // ── Fetch users ──────────────────────────────────────────────────────────────
  const fetchUsers = useCallback((page = 1) => {
    setLoadingData(true);
    fetch(`${API}/api/admin/users?page=${page}&limit=25`, { headers })
      .then(r => r.json())
      .then(d => {
        setUsers(d.users || []);
        setUserPages({ page, totalPages: d.pagination?.totalPages || 1 });
      })
      .catch(err => console.error('users:', err))
      .finally(() => setLoadingData(false));
  }, [token]);

  // ── Fetch migrations ─────────────────────────────────────────────────────────
  const fetchMigrations = useCallback((page = 1, status = statusFilter) => {
    setLoadingData(true);
    const q = status ? `&status=${status}` : '';
    fetch(`${API}/api/admin/migrations?page=${page}&limit=25${q}`, { headers })
      .then(r => r.json())
      .then(d => {
        setMigrations(d.migrations || []);
        setMigPages({ page, totalPages: d.pagination?.totalPages || 1 });
      })
      .catch(err => console.error('migrations:', err))
      .finally(() => setLoadingData(false));
  }, [token, statusFilter]);

  useEffect(() => {
    if (!user || user.email !== ADMIN_EMAIL) return;
    if (tab === 'users')      fetchUsers(1);
    if (tab === 'migrations') fetchMigrations(1);
  }, [tab, user]);

  // ── Refund ───────────────────────────────────────────────────────────────────
  const handleRefund = async (migrationId) => {
    if (!window.confirm('Issue a full Stripe refund for this migration? This cannot be undone.')) return;
    setRefunding(migrationId);
    try {
      const r = await fetch(`${API}/api/admin/refund/${migrationId}`, { method: 'POST', headers });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Refund failed');
      showToast(`Refund issued — $${(d.refund.amount / 100).toFixed(2)}`);
      // Optimistic update
      setMigrations(prev => prev.map(m =>
        m.id === migrationId ? { ...m, status: 'refunded', canRefund: false } : m
      ));
    } catch (err) {
      showToast(err.message, false);
    } finally {
      setRefunding(null);
    }
  };

  if (authLoading) return null;
  if (!user || user.email !== ADMIN_EMAIL) return null;

  const fmtUsd  = (cents) => cents != null ? `$${(cents / 100).toFixed(2)}` : '—';
  const fmtDate = (iso)   => iso ? new Date(iso).toLocaleDateString('en-CA') : '—';

  return (
    <div style={{ minHeight: '100vh', background: C.surface, fontFamily: 'Inter, sans-serif' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.ok ? C.greenBg : C.redBg,
          color: toast.ok ? C.green : C.red,
          border: `1px solid ${toast.ok ? C.green : C.red}`,
          borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,.12)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <nav style={{
        background: '#fff', borderBottom: `1px solid ${C.border}`,
        padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: C.ink }}>MigrateBot</span>
          <span style={{
            background: C.amberBg, color: C.amberDark,
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, letterSpacing: '.04em',
          }}>ADMIN</span>
        </div>
        <span style={{ fontSize: 13, color: C.inkMid }}>{user.email}</span>
      </nav>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>

        {/* Stats bar */}
        {stats && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
            <StatCard label="Total Users"      value={stats.totalUsers}      />
            <StatCard label="Total Migrations" value={stats.totalMigrations} />
            <StatCard label="Active Now"       value={stats.activeCount}     color={C.blue} />
            <StatCard label="Failed"           value={stats.failedCount}     color={C.red} />
            <StatCard label="Gross Revenue"    value={fmtUsd(stats.totalRevenue)}  color={C.green} sub={`${fmtUsd(stats.totalRefunded)} refunded`} />
            <StatCard label="Net Revenue"      value={fmtUsd(stats.netRevenue)}    color={C.green} />
          </div>
        )}

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
          {['migrations', 'users'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding: '8px 18px', fontSize: 14, fontWeight: tab === t ? 700 : 400,
                border: 'none', background: 'none', cursor: 'pointer',
                color: tab === t ? C.amber : C.inkMid,
                borderBottom: tab === t ? `2px solid ${C.amber}` : '2px solid transparent',
                textTransform: 'capitalize',
              }}>
              {t}
            </button>
          ))}
        </div>

        {/* ── Migrations tab ─────────────────────────────────────────────────── */}
        {tab === 'migrations' && (
          <div>
            {/* Filter row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: C.inkMid }}>Filter:</span>
              {['', 'failed', 'success', 'refunded', 'deploying', 'paid', 'pending'].map(s => (
                <button key={s} onClick={() => { setStatusFilter(s); fetchMigrations(1, s); }}
                  style={{
                    padding: '4px 12px', fontSize: 12, fontWeight: statusFilter === s ? 700 : 400,
                    border: `1px solid ${statusFilter === s ? C.amber : C.border}`,
                    background: statusFilter === s ? C.amberBg : '#fff',
                    color: statusFilter === s ? C.amberDark : C.inkMid,
                    borderRadius: 20, cursor: 'pointer',
                  }}>
                  {s || 'All'}
                </button>
              ))}
            </div>

            <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                    {['ID', 'User', 'Repo', 'Platform', 'Status', 'Charged', 'Date', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: C.inkMid, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingData ? (
                    <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: C.inkMid }}>Loading…</td></tr>
                  ) : migrations.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: C.inkMid }}>No migrations found</td></tr>
                  ) : migrations.map(m => (
                    <tr key={m.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: C.inkLight }}>
                        {m.id.slice(0, 8)}…
                      </td>
                      <td style={{ padding: '10px 14px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.userEmail || <span style={{ color: C.inkLight }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span title={m.repourl}>{m.repourl ? m.repourl.replace('https://github.com/', '') : '—'}</span>
                      </td>
                      <td style={{ padding: '10px 14px', color: C.inkMid }}>{m.source_platform || '—'}</td>
                      <td style={{ padding: '10px 14px' }}><StatusBadge status={m.status} /></td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{fmtUsd(m.amount_charged)}</td>
                      <td style={{ padding: '10px 14px', color: C.inkMid, whiteSpace: 'nowrap' }}>{fmtDate(m.created_at)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {m.canRefund && (
                          <button
                            onClick={() => handleRefund(m.id)}
                            disabled={refunding === m.id}
                            style={{
                              padding: '4px 12px', fontSize: 12, fontWeight: 600,
                              background: refunding === m.id ? C.surface : C.redBg,
                              color: C.red, border: `1px solid ${C.red}`,
                              borderRadius: 6, cursor: refunding === m.id ? 'default' : 'pointer',
                            }}>
                            {refunding === m.id ? 'Refunding…' : 'Refund'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination page={migPages.page} totalPages={migPages.totalPages}
              onPage={p => fetchMigrations(p)} />
          </div>
        )}

        {/* ── Users tab ──────────────────────────────────────────────────────── */}
        {tab === 'users' && (
          <div>
            <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                    {['Email', 'Name', 'Joined', 'Last sign-in', 'Migrations', 'Failed', 'Succeeded'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: C.inkMid }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingData ? (
                    <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: C.inkMid }}>Loading…</td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: C.inkMid }}>No users found</td></tr>
                  ) : users.map(u => (
                    <tr key={u.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '10px 14px', fontWeight: 500 }}>{u.email}</td>
                      <td style={{ padding: '10px 14px', color: C.inkMid }}>{u.name || '—'}</td>
                      <td style={{ padding: '10px 14px', color: C.inkMid, whiteSpace: 'nowrap' }}>{fmtDate(u.createdAt)}</td>
                      <td style={{ padding: '10px 14px', color: C.inkMid, whiteSpace: 'nowrap' }}>{fmtDate(u.lastSignIn)}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', textAlign: 'center' }}>{u.migrations.total}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', textAlign: 'center', color: u.migrations.failed > 0 ? C.red : C.inkLight }}>{u.migrations.failed}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', textAlign: 'center', color: u.migrations.success > 0 ? C.green : C.inkLight }}>{u.migrations.success}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination page={userPages.page} totalPages={userPages.totalPages}
              onPage={p => fetchUsers(p)} />
          </div>
        )}
      </div>
    </div>
  );
}
