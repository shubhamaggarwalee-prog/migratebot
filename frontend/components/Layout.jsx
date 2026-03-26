/**
 * frontend/components/Layout.jsx
 * Shared page layout — sidebar nav + main content area.
 * Gap 7: Made fully responsive.
 *   - Hamburger button appears on ≤ 768 px; sidebar slides in as a drawer.
 *   - Click-away overlay closes the drawer.
 *   - Applies .mb-layout / .mb-sidebar / .mb-main CSS classes from globals.css.
 *   - ESC key also closes the drawer.
 */
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { href: '/dashboard', label: 'Dashboard',    icon: '\uD83C\uDFE0', id: 'tour-settings' },
  { href: '/migrate',   label: 'New Migration', icon: '\u2795' },
  { href: '/settings',  label: 'Settings',      icon: '\u2699\uFE0F', id: 'tour-settings' },
];

export default function Layout({ children }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (user tapped a nav link)
  useEffect(() => {
    setSidebarOpen(false);
  }, [router.pathname]);

  // ESC to close
  const onKey = useCallback((e) => {
    if (e.key === 'Escape') setSidebarOpen(false);
  }, []);
  useEffect(() => {
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onKey]);

  // Prevent body scroll when sidebar drawer is open on mobile
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="mb-layout">

      {/* ── Hamburger button (mobile only, hidden by CSS on desktop) ── */}
      <button
        className="mb-hamburger"
        onClick={() => setSidebarOpen(o => !o)}
        aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={sidebarOpen}
      >
        {sidebarOpen ? '\u2715' : '\u2630'}
      </button>

      {/* ── Click-away overlay ── */}
      <div
        className={`mb-overlay${sidebarOpen ? ' is-open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* ── Sidebar ── */}
      <aside
        className={`mb-sidebar${sidebarOpen ? ' is-open' : ''}`}
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div style={{
          padding: '0 1.5rem 1.5rem',
          borderBottom: '1px solid #E5E2DA',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1814' }}>
            MigrateBot
          </span>
          {/* Close button inside sidebar — visible on mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
            style={{
              display: 'none',  /* shown via media query below */
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 18, color: '#9B958A', lineHeight: 1,
            }}
            className="mb-sidebar-close"
          >
            \u2715
          </button>
        </div>

        {/* Nav links */}
        <nav style={{ padding: '1rem 0', flex: 1 }}>
          {NAV.map(n => (
            <Link
              key={n.href}
              href={n.href}
              id={n.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 1.5rem',
                color: router.pathname === n.href ? '#D97706' : '#6B6860',
                background: router.pathname === n.href ? '#FEF3C7' : 'transparent',
                textDecoration: 'none', fontSize: 14,
                fontWeight: router.pathname === n.href ? 600 : 400,
                borderRight: router.pathname === n.href ? '3px solid #D97706' : '3px solid transparent',
                transition: 'background .15s',
              }}
            >
              <span>{n.icon}</span> {n.label}
            </Link>
          ))}
        </nav>

        {/* User info + logout */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #E5E2DA' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: '#FEF3C7', color: '#D97706',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, flexShrink: 0,
            }}>
              {(user?.name || user?.email || '?')[0].toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              {user?.name && (
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1814', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.name}
                </div>
              )}
              <div style={{ fontSize: 11, color: '#9B9890', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.email}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px',
              background: 'none',
              border: '1px solid #E5E2DA',
              borderRadius: 8,
              color: '#6B6860',
              fontSize: 13, fontWeight: 500,
              cursor: 'pointer',
              transition: 'all .15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#FEE2E2';
              e.currentTarget.style.color = '#DC2626';
              e.currentTarget.style.borderColor = '#FCA5A5';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = '#6B6860';
              e.currentTarget.style.borderColor = '#E5E2DA';
            }}
          >
            <span style={{ fontSize: 14 }}>\uD83D\uDEAA</span> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="mb-main">
        {children}
      </main>

      {/* Inline style: show sidebar close button only on mobile */}
      <style>{`
        @media (max-width: 768px) {
          .mb-sidebar-close { display: block !important; }
        }
      `}</style>
    </div>
  );
}
