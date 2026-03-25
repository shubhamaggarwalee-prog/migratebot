/**
 * frontend/pages/index.jsx
 * Landing page — with early adopter banner, trust signals, and money-back guarantee badge.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import Link from 'next/link';
import Term from '../components/Term';

const C = {
  amber: '#D97706', amberBg: '#FEF3C7', amberDark: '#B45309',
  ink: '#1A1814', inkMid: '#6B6860', inkLight: '#9B958A',
  border: '#E5E2DA', surface: '#F8F7F4',
  green: '#059669', greenBg: '#D1FAE5', greenDark: '#065F46',
  red: '#DC2626', redBg: '#FEE2E2',
};

// ─── Early Adopter Banner ─────────────────────────────────────────────────────
function EarlyAdopterBanner() {
  const spotsTotal = 100;
  const spotsLeft  = 47;
  const spotsTaken = spotsTotal - spotsLeft;
  const pct        = Math.round((spotsTaken / spotsTotal) * 100);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #92400E 0%, #B45309 50%, #D97706 100%)',
      color: '#fff',
      padding: '14px 24px',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle shimmer stripe */}
      <div style={{
        position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.08), transparent)',
        animation: 'shimmer 3s infinite',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 18 }}>🚀</span>
        <span style={{ fontWeight: 700, fontSize: 15 }}>
          Founding Member Offer:
        </span>
        <span style={{ fontSize: 14, opacity: 0.95 }}>
          Launch at{' '}
          <span style={{
            background: 'rgba(255,255,255,.18)', borderRadius: 6,
            padding: '2px 8px', fontWeight: 700, fontSize: 16,
          }}>$50</span>
          {' '}— only{' '}
          <span style={{
            background: '#fff', color: C.amberDark, borderRadius: 6,
            padding: '2px 10px', fontWeight: 800, fontSize: 15,
          }}>{spotsLeft} of {spotsTotal}</span>
          {' '}founding member spots remaining
        </span>
        <Link href="/register" style={{
          background: '#fff', color: C.amberDark, padding: '6px 18px',
          borderRadius: 20, fontSize: 13, fontWeight: 700,
          textDecoration: 'none', whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(0,0,0,.2)',
          transition: 'all .15s',
        }}>
          Claim my spot →
        </Link>
      </div>

      {/* Progress bar */}
      <div style={{ maxWidth: 340, margin: '10px auto 0', height: 6, background: 'rgba(255,255,255,.25)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: '#fff', borderRadius: 4,
          transition: 'width .6s ease',
        }} />
      </div>
      <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>
        {spotsTaken} spots claimed · {spotsLeft} left at this price
      </div>

      <style>{`
        @keyframes shimmer {
          0%   { left: -100%; }
          100% { left: 200%; }
        }
      `}</style>
    </div>
  );
}

// ─── Trust Signals Section ────────────────────────────────────────────────────
function TrustSignals() {
  const signals = [
    {
      icon: '🗑️',
      title: 'Your code is deleted after migration',
      body: 'We clone your repository only for the duration of the migration. The moment your app is live, every copy of your code is permanently wiped from our servers. We never keep, read, or share your source code.',
      accent: C.green,
      accentBg: C.greenBg,
      badge: 'Zero retention',
    },
    {
      icon: '🔒',
      title: 'AES-256 military-grade encryption',
      body: (
        <span>
          Every <Term id="api-token">API token</Term> and credential you provide is immediately encrypted with{' '}
          <Term id="aes-256">AES-256</Term> — the same standard used by banks, governments, and the military.
          Your secrets are never stored in plain text, ever.
        </span>
      ),
      accent: C.amber,
      accentBg: C.amberBg,
      badge: 'Bank-grade security',
    },
    {
      icon: '🛡️',
      title: 'Works with your existing GitHub login',
      body: (
        <span>
          We use <Term id="jwt">secure session tokens</Term> — we never ask for or store your GitHub password.
          Login is handled safely via your existing account, no new credentials to manage.
        </span>
      ),
      accent: '#2563EB',
      accentBg: '#DBEAFE',
      badge: 'No password stored',
    },
  ];

  return (
    <section style={{ maxWidth: 900, margin: '0 auto', padding: '3rem 2rem 1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          display: 'inline-block', background: C.amberBg, color: C.amberDark,
          padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, marginBottom: 12,
        }}>
          🔐 Security & Privacy
        </div>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: C.ink, margin: 0 }}>
          Your code. Your data. Your trust.
        </h2>
        <p style={{ color: C.inkMid, fontSize: 15, marginTop: 10, maxWidth: 520, margin: '10px auto 0', lineHeight: 1.7 }}>
          We built MigrateBot the way we'd want a tool to treat our own projects.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        {signals.map((s, i) => (
          <div key={i} style={{
            background: '#fff', borderRadius: 14,
            border: `1px solid ${C.border}`,
            borderTop: `3px solid ${s.accent}`,
            padding: '1.5rem',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ fontSize: 36 }}>{s.icon}</div>
            <div style={{
              display: 'inline-flex', alignSelf: 'flex-start',
              background: s.accentBg, color: s.accent,
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
            }}>
              {s.badge}
            </div>
            <h3 style={{ fontWeight: 700, fontSize: 15, color: C.ink, margin: 0, lineHeight: 1.4 }}>
              {s.title}
            </h3>
            <p style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.7, margin: 0 }}>
              {s.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Money-Back Guarantee Badge ───────────────────────────────────────────────
function MoneyBackBadge() {
  return (
    <section style={{ maxWidth: 700, margin: '2rem auto', padding: '0 2rem' }}>
      <div style={{
        background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
        border: '2px solid #86EFAC',
        borderRadius: 16,
        padding: '2rem 2.5rem',
        display: 'flex', alignItems: 'center', gap: 28,
        boxShadow: '0 4px 24px rgba(5,150,105,.1)',
      }}>
        {/* Badge seal */}
        <div style={{
          flexShrink: 0, width: 90, height: 90,
          background: 'linear-gradient(135deg, #059669, #065F46)',
          borderRadius: '50%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(5,150,105,.35)',
          border: '3px solid #fff',
        }}>
          <span style={{ fontSize: 26 }}>💚</span>
          <span style={{ fontSize: 9, color: '#fff', fontWeight: 800, letterSpacing: '.04em', marginTop: 2, textAlign: 'center', lineHeight: 1.2 }}>100%{'\n'}BACK</span>
        </div>

        {/* Text */}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: C.greenDark, marginBottom: 6 }}>
            100% Money-Back Guarantee
          </div>
          <p style={{ fontSize: 14, color: '#166534', lineHeight: 1.7, margin: 0 }}>
            If your <Term id="migration">migration</Term> fails for <em>any reason at all</em> — a bug on our end, an unsupported framework, anything —
            you get a <strong>full refund within 24 hours, no questions asked.</strong> You only pay when your app is live.
          </p>
          <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
            {[
              '✓ Automatic refund if migration fails',
              '✓ No questions asked',
              '✓ Within 24 hours',
            ].map(t => (
              <span key={t} style={{ fontSize: 12, fontWeight: 600, color: C.greenDark }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) router.push('/dashboard');
  }, [user, loading, router]);

  return (
    <div style={{ minHeight: '100vh', background: C.surface, fontFamily: 'Inter, sans-serif' }}>

      {/* Early Adopter Banner — very top of page */}
      <EarlyAdopterBanner />

      {/* Nav */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 2rem', borderBottom: `1px solid ${C.border}`, background: '#fff' }}>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: C.ink }}>MigrateBot</span>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/login" style={{ padding: '8px 16px', border: `1px solid ${C.border}`, borderRadius: 8, color: C.ink, textDecoration: 'none', fontSize: 14 }}>Login</Link>
          <Link href="/register" style={{ padding: '8px 16px', background: C.amber, borderRadius: 8, color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '5rem 2rem 4rem' }}>
        <div style={{ display: 'inline-block', background: C.amberBg, color: '#92400E', padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, marginBottom: 20 }}>
          Automated Migration Platform
        </div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 52, fontWeight: 700, color: C.ink, lineHeight: 1.2, maxWidth: 700, margin: '0 auto 1.5rem' }}>
          Migrate Any Project to Production in Minutes
        </h1>
        <p style={{ fontSize: 18, color: C.inkMid, maxWidth: 550, margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
          Move your GitHub, Replit, or Emergent project to{' '}
          <Term id="vercel">Vercel</Term> + <Term id="railway">Railway</Term> + <Term id="supabase">Supabase</Term>{' '}
          automatically. No DevOps needed.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/register" style={{
            padding: '14px 28px', background: C.amber, color: '#fff',
            borderRadius: 10, textDecoration: 'none', fontSize: 16, fontWeight: 700,
            boxShadow: '0 4px 16px rgba(217,119,6,.3)',
          }}>
            Claim founding spot — $50 →
          </Link>
          <Link href="/setup" style={{
            padding: '14px 28px', background: '#fff', color: C.ink,
            border: `1px solid ${C.border}`, borderRadius: 10, textDecoration: 'none', fontSize: 16,
          }}>
            Deploy MigrateBot
          </Link>
        </div>
        <p style={{ fontSize: 12, color: C.inkLight, marginTop: 12 }}>
          🔒 47 spots left at $50 · Price rises to $100 when spots are gone
        </p>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '3rem 2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {[
            { icon: '🐙', title: 'GitHub', desc: 'Any public or private GitHub repository' },
            { icon: '🔄', title: 'Replit', desc: 'Monolith-aware — we split frontend and backend automatically' },
            { icon: '🌱', title: 'Emergent', desc: 'Full-stack aware — deploys /web, /api, /db to the right platforms' },
          ].map(f => (
            <div key={f.title} style={{ background: '#fff', borderRadius: 12, padding: '1.75rem', border: `1px solid ${C.border}`, textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontWeight: 700, color: C.ink, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ color: C.inkMid, fontSize: 14, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust Signals */}
      <TrustSignals />

      {/* Money-Back Guarantee */}
      <MoneyBackBadge />

      {/* Pricing */}
      <section style={{ maxWidth: 700, margin: '0 auto', padding: '3rem 2rem' }}>
        <h2 style={{ textAlign: 'center', fontFamily: 'Georgia, serif', fontSize: 32, color: C.ink, marginBottom: '0.5rem' }}>Simple Pricing</h2>
        <p style={{ textAlign: 'center', color: C.inkMid, fontSize: 14, marginBottom: '2.5rem' }}>
          Founding member price locked in forever — no subscription, no hidden fees.
        </p>

        {/* Founding member highlight card */}
        <div style={{
          background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
          border: `2px solid ${C.amber}`,
          borderRadius: 16, padding: '1.75rem 2rem',
          marginBottom: 20,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 12, right: 16,
            background: C.amber, color: '#fff',
            fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 20,
            letterSpacing: '.04em',
          }}>
            🔥 FOUNDING PRICE
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.amberDark, marginBottom: 4 }}>Founding Member</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 44, fontWeight: 800, color: C.ink }}>$50</span>
            <span style={{ fontSize: 16, color: C.inkMid, textDecoration: 'line-through' }}>$100</span>
            <span style={{ fontSize: 13, color: C.amberDark, fontWeight: 600 }}>one-time</span>
          </div>
          <p style={{ fontSize: 13, color: C.amberDark, marginBottom: 16 }}>
            47 of 100 spots remaining · Price goes to $100 when spots are gone
          </p>
          {['Single repo migration', 'GitHub / Replit / Emergent', 'Vercel + Railway + Supabase deploy', '48h support', 'Price locked forever'].map(f => (
            <div key={f} style={{ fontSize: 14, color: C.ink, marginBottom: 6 }}>✓ {f}</div>
          ))}
          <Link href="/register" style={{
            display: 'block', marginTop: 20, padding: '12px',
            background: C.amber, color: '#fff', borderRadius: 8,
            textAlign: 'center', textDecoration: 'none', fontWeight: 700, fontSize: 15,
            boxShadow: '0 4px 12px rgba(217,119,6,.3)',
          }}>
            Claim founding spot →
          </Link>
        </div>

        {/* Standard pricing */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {[
            { name: 'Standard', price: '$100', features: ['Single repo migration', 'GitHub / Replit / Emergent', 'Vercel + Railway deploy', '48h support'] },
            { name: 'Pro', price: '$250', features: ['Everything in Standard', 'Multi-platform analysis', 'Priority deployment', '24h priority support'], highlight: true },
          ].map(plan => (
            <div key={plan.name} style={{
              background: plan.highlight ? C.amberBg : '#fff',
              border: `2px solid ${plan.highlight ? C.amber : C.border}`,
              borderRadius: 12, padding: '2rem',
              opacity: 0.85,
            }}>
              <div style={{ fontSize: 11, color: C.inkLight, fontWeight: 600, marginBottom: 4 }}>After founding spots</div>
              <h3 style={{ fontWeight: 700, fontSize: 20, color: C.ink, margin: '0 0 4px' }}>{plan.name}</h3>
              <div style={{ fontSize: 36, fontWeight: 700, color: C.amber, marginBottom: 16 }}>{plan.price}</div>
              {plan.features.map(f => <div key={f} style={{ fontSize: 14, color: C.inkMid, marginBottom: 6 }}>✓ {f}</div>)}
              <Link href="/register" style={{
                display: 'block', marginTop: 20, padding: '10px',
                background: plan.highlight ? C.amber : C.ink, color: '#fff',
                borderRadius: 8, textAlign: 'center', textDecoration: 'none', fontWeight: 600, fontSize: 14,
              }}>
                Get Started
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer strip */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: '1.5rem 2rem', textAlign: 'center', color: C.inkLight, fontSize: 13, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap', marginBottom: 8 }}>
          <span>🔒 <Term id="aes-256">AES-256</Term> encrypted</span>
          <span>🗑️ Code deleted after migration</span>
          <span>💚 100% money-back guarantee</span>
          <span>🚀 47 founding spots at $50</span>
        </div>
        <div>© 2026 MigrateBot · support@migratebot.io</div>
      </footer>
    </div>
  );
}
