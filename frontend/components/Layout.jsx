/**
 * frontend/components/Layout.jsx
 * Shared page layout with sidebar nav + logout button
 */
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { href: '/dashboard',  label: 'Dashboard',     icon: '\uD83C\uDFE0' },
  { href: '/migrate',    label: 'New Migration',  icon: '\u2795' },
  { href: '/settings',   label: 'Settings',       icon: '\u2699\uFE0F' },
];

export default function Layout({ children }) {
  const router   = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F4', fontFamily: 'Inter, sans-serif', display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, background: '#fff',
        borderRight: '1px solid #E5E2DA',
        padding: '1.5rem 0',
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh',
      }}>
        {/* Logo */}
        <div style={{ padding: '0 1.5rem 1.5rem', borderBottom: '1px solid #E5E2DA' }}>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1814' }}>MigrateBot</span>
        </div>

        {/* Nav links */}
        <nav style={{ padding: '1rem 0', flex: 1 }}>
          {NAV.map(n => (
            <Link key={n.href} href={n.href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 1.5rem',
              color: router.pathname === n.href ? '#D97706' : '#6B6860',
              background: router.pathname === n.href ? '#FEF3C7' : 'transparent',
              textDecoration: 'none', fontSize: 14,
              fontWeight: router.pathname === n.href ? 600 : 400,
              borderRight: router.pathname === n.href ? '3px solid #D97706' : '3px solid transparent',
              transition: 'background .15s',
            }}>
              <span>{n.icon}</span> {n.label}
            </Link>
          ))}
        </nav>

        {/* User info + logout */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #E5E2DA',
        }}>
          {/* Avatar + email */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 10,
          }}>
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

          {/* Logout button */}
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

      {/* Main content */}
      <main style={{ flex: 1, padding: '2rem', maxWidth: 'calc(100% - 220px)', overflowX: 'hidden' }}>
        {children}
      </main>
    </div>
  );
}
