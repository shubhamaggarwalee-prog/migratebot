/**
 * frontend/components/Layout.jsx
 * Shared page layout with sidebar nav
 */
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/migrate', label: 'New Migration', icon: '➕' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Layout({ children }) {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F4', fontFamily: 'Inter, sans-serif', display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: '#fff', borderRight: '1px solid #E5E2DA', padding: '1.5rem 0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '0 1.5rem 1.5rem', borderBottom: '1px solid #E5E2DA' }}>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1814' }}>MigrateBot</span>
        </div>
        <nav style={{ padding: '1rem 0', flex: 1 }}>
          {NAV.map(n => (
            <Link key={n.href} href={n.href} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 1.5rem',
              color: router.pathname === n.href ? '#D97706' : '#6B6860',
              background: router.pathname === n.href ? '#FEF3C7' : 'transparent',
              textDecoration: 'none', fontSize: 14, fontWeight: router.pathname === n.href ? 600 : 400,
              borderRight: router.pathname === n.href ? '3px solid #D97706' : '3px solid transparent',
            }}>
              <span>{n.icon}</span> {n.label}
            </Link>
          ))}
        </nav>
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #E5E2DA', fontSize: 12, color: '#9B9890' }}>
          {user?.email}
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: '2rem', maxWidth: 'calc(100% - 220px)', overflowX: 'hidden' }}>
        {children}
      </main>
    </div>
  );
}
