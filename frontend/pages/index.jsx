/**
 * frontend/pages/index.jsx
 * Landing page
 */
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) router.push('/dashboard');
  }, [user, loading, router]);

  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F4', fontFamily: 'Inter, sans-serif' }}>
      {/* Nav */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 2rem', borderBottom: '1px solid #E5E2DA', background: '#fff' }}>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: '#1A1814' }}>MigrateBot</span>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/login" style={{ padding: '8px 16px', border: '1px solid #E5E2DA', borderRadius: 8, color: '#1A1814', textDecoration: 'none', fontSize: 14 }}>Login</Link>
          <Link href="/register" style={{ padding: '8px 16px', background: '#D97706', borderRadius: 8, color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '5rem 2rem 4rem' }}>
        <div style={{ display: 'inline-block', background: '#FEF3C7', color: '#92400E', padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, marginBottom: 20 }}>Automated Migration Platform</div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 52, fontWeight: 700, color: '#1A1814', lineHeight: 1.2, maxWidth: 700, margin: '0 auto 1.5rem' }}>
          Migrate Any Project to Production in Minutes
        </h1>
        <p style={{ fontSize: 18, color: '#6B6860', maxWidth: 550, margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
          Move your GitHub, Replit, or Emergent project to Vercel + Railway + Supabase automatically. No DevOps needed.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Link href="/register" style={{ padding: '14px 28px', background: '#D97706', color: '#fff', borderRadius: 10, textDecoration: 'none', fontSize: 16, fontWeight: 600 }}>Start Migrating →</Link>
          <Link href="/setup" style={{ padding: '14px 28px', background: '#fff', color: '#1A1814', border: '1px solid #E5E2DA', borderRadius: 10, textDecoration: 'none', fontSize: 16 }}>Deploy MigrateBot</Link>
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '3rem 2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {[
            { icon: '🐙', title: 'GitHub', desc: 'Any public or private GitHub repository' },
            { icon: '🔄', title: 'Replit', desc: 'Monolith-aware — we split frontend and backend automatically' },
            { icon: '🌱', title: 'Emergent', desc: 'Full-stack aware — deploys /web, /api, /db to the right platforms' },
          ].map(f => (
            <div key={f.title} style={{ background: '#fff', borderRadius: 12, padding: '1.75rem', border: '1px solid #E5E2DA', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontWeight: 700, color: '#1A1814', marginBottom: 8 }}>{f.title}</h3>
              <p style={{ color: '#6B6860', fontSize: 14, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section style={{ maxWidth: 700, margin: '0 auto', padding: '3rem 2rem' }}>
        <h2 style={{ textAlign: 'center', fontFamily: 'Georgia, serif', fontSize: 32, color: '#1A1814', marginBottom: '2.5rem' }}>Simple Pricing</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {[
            { name: 'Standard', price: '$100', features: ['Single repo migration', 'GitHub / Replit / Emergent', 'Vercel + Railway deploy', '48h support'] },
            { name: 'Pro', price: '$250', features: ['Everything in Standard', 'Multi-platform analysis', 'Priority deployment', '24h priority support'], highlight: true },
          ].map(plan => (
            <div key={plan.name} style={{ background: plan.highlight ? '#FEF3C7' : '#fff', border: `2px solid ${plan.highlight ? '#D97706' : '#E5E2DA'}`, borderRadius: 12, padding: '2rem' }}>
              <h3 style={{ fontWeight: 700, fontSize: 20, color: '#1A1814', margin: '0 0 4px' }}>{plan.name}</h3>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#D97706', marginBottom: 16 }}>{plan.price}</div>
              {plan.features.map(f => <div key={f} style={{ fontSize: 14, color: '#6B6860', marginBottom: 6 }}>✓ {f}</div>)}
              <Link href="/register" style={{ display: 'block', marginTop: 20, padding: '10px', background: plan.highlight ? '#D97706' : '#1A1814', color: '#fff', borderRadius: 8, textAlign: 'center', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>Get Started</Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
