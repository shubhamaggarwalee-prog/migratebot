/**
 * frontend/pages/pricing.jsx
 * Standalone pricing page — linked from nav, shareable, Stripe-reviewable.
 */
import Link from 'next/link';
import Head from 'next/head';
import Term from '../components/Term';

const C = {
  amber: '#D97706', amberBg: '#FEF3C7', amberDark: '#B45309',
  ink: '#1A1814', inkMid: '#6B6860', inkLight: '#9B958A',
  border: '#E5E2DA', surface: '#F8F7F4',
  green: '#059669', greenBg: '#D1FAE5', greenDark: '#065F46',
};

const SPOTS_TOTAL = 100;
const SPOTS_LEFT  = 47;

// ─── FAQ ──────────────────────────────────────────────────────────────────────
const FAQ = [
  {
    q: 'What counts as one migration?',
    a: 'One migration = one repository moved to production. You get one Vercel frontend deployment, one Railway backend service, and one Supabase project, fully wired together.',
  },
  {
    q: 'What if my migration fails?',
    a: 'You get a full refund within 24 hours, no questions asked. We only succeed when your app is live — if anything goes wrong on our end you pay nothing.',
  },
  {
    q: 'Do I need a Vercel, Railway, or Supabase account?',
    a: 'Yes. MigrateBot deploys into your own accounts using tokens you provide — your apps live under your own accounts, not ours. We never hold your infrastructure hostage.',
  },
  {
    q: 'Is the founding price really locked forever?',
    a: 'Yes. Founding members pay $50 per migration for life. When the 100 spots are gone, the price rises to $100 for Standard and $250 for Pro. Your rate never changes.',
  },
  {
    q: 'What source platforms are supported?',
    a: 'GitHub (public and private repos), Replit projects, and Emergent projects. We detect the source type automatically and adapt the migration plan accordingly.',
  },
  {
    q: 'What happens to my code after migration?',
    a: 'We clone your repo only for the duration of the migration. The moment your app is live, every copy of your source code is permanently deleted from our servers. We never retain, read, or share your code.',
  },
  {
    q: 'Can I migrate a monorepo or full-stack project?',
    a: 'Yes. MigrateBot is full-stack-aware. For Replit and Emergent projects it automatically splits the frontend, backend, and database into the right deployment targets.',
  },
  {
    q: 'Is there a subscription?',
    a: 'No. Every plan is a one-time per-migration fee. You only pay when you migrate a project. There are no monthly fees, no seat costs, and no surprise renewals.',
  },
];

function FAQItem({ q, a }) {
  return (
    <div style={{
      borderBottom: `1px solid ${C.border}`,
      padding: '1.25rem 0',
    }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: C.ink, marginBottom: 8 }}>{q}</div>
      <div style={{ fontSize: 14, color: C.inkMid, lineHeight: 1.8 }}>{a}</div>
    </div>
  );
}

function ComparisonTable() {
  const rows = [
    { feature: 'Price',                   founding: '$50 one-time',      standard: '$100 one-time',    pro: '$250 one-time' },
    { feature: 'Repos per purchase',      founding: '1',                  standard: '1',                pro: '1' },
    { feature: 'Source platforms',        founding: 'GitHub/Replit/Emergent', standard: 'GitHub/Replit/Emergent', pro: 'GitHub/Replit/Emergent' },
    { feature: 'Deploy targets',          founding: 'Vercel + Railway + Supabase', standard: 'Vercel + Railway + Supabase', pro: 'Vercel + Railway + Supabase' },
    { feature: 'AI migration agent',      founding: '✓',                  standard: '✓',                pro: '✓' },
    { feature: 'Money-back guarantee',    founding: '✓',                  standard: '✓',                pro: '✓' },
    { feature: 'Support response time',   founding: '48 hours',           standard: '48 hours',         pro: '24 hours priority' },
    { feature: 'Multi-platform analysis', founding: '—',                  standard: '—',                pro: '✓' },
    { feature: 'Priority deployment queue', founding: '—',                standard: '—',                pro: '✓' },
    { feature: 'Founding price locked',   founding: '✓ forever',          standard: '—',                pro: '—' },
  ];

  const colStyle = (highlight) => ({
    padding: '11px 16px',
    fontSize: 14,
    color: highlight ? C.amberDark : C.inkMid,
    fontWeight: highlight ? 700 : 400,
    background: highlight ? '#FFFBEB' : 'transparent',
    textAlign: 'center',
    borderBottom: `1px solid ${C.border}`,
  });

  return (
    <section style={{ maxWidth: 820, margin: '0 auto', padding: '3rem 2rem 1rem' }}>
      <h2 style={{ textAlign: 'center', fontFamily: 'Georgia, serif', fontSize: 26, color: C.ink, marginBottom: 8 }}>
        Full plan comparison
      </h2>
      <p style={{ textAlign: 'center', color: C.inkMid, fontSize: 14, marginBottom: 32 }}>
        Every plan is a one-time per-migration fee — no subscriptions, no seat costs.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}` }}>
          <thead>
            <tr>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, color: C.inkLight, fontWeight: 600, borderBottom: `2px solid ${C.border}`, background: C.surface }}>Feature</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, color: C.amberDark, fontWeight: 700, borderBottom: `2px solid ${C.amber}`, background: '#FFFBEB' }}>Founding Member 🔥</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, color: C.inkMid, fontWeight: 600, borderBottom: `2px solid ${C.border}`, background: C.surface }}>Standard</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, color: C.inkMid, fontWeight: 600, borderBottom: `2px solid ${C.border}`, background: C.surface }}>Pro</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td style={{ padding: '11px 16px', fontSize: 14, color: C.ink, fontWeight: 500, borderBottom: `1px solid ${C.border}` }}>{row.feature}</td>
                <td style={colStyle(true)}>{row.founding}</td>
                <td style={colStyle(false)}>{row.standard}</td>
                <td style={colStyle(false)}>{row.pro}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function PricingPage() {
  const spotsTaken = SPOTS_TOTAL - SPOTS_LEFT;
  const pct = Math.round((spotsTaken / SPOTS_TOTAL) * 100);

  return (
    <>
      <Head>
        <title>Pricing — MigrateBot</title>
        <meta name="description" content="One-time per-migration pricing. Founding member spot: $50 for life. Standard $100. Pro $250. 100% money-back guarantee if your migration fails." />
      </Head>

      <div style={{ minHeight: '100vh', background: C.surface, fontFamily: 'Inter, sans-serif' }}>

        {/* Nav */}
        <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 2rem', borderBottom: `1px solid ${C.border}`, background: '#fff' }}>
          <Link href="/" style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: C.ink, textDecoration: 'none' }}>MigrateBot</Link>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <Link href="/pricing" style={{ fontSize: 14, color: C.amberDark, fontWeight: 700, textDecoration: 'none' }}>Pricing</Link>
            <Link href="/login" style={{ padding: '8px 16px', border: `1px solid ${C.border}`, borderRadius: 8, color: C.ink, textDecoration: 'none', fontSize: 14 }}>Login</Link>
            <Link href="/register" style={{ padding: '8px 16px', background: C.amber, borderRadius: 8, color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>Get Started</Link>
          </div>
        </nav>

        {/* Hero */}
        <section style={{ textAlign: 'center', padding: '4rem 2rem 2rem' }}>
          <div style={{
            display: 'inline-block', background: C.amberBg, color: '#92400E',
            padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, marginBottom: 16,
          }}>
            Simple, transparent pricing
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 44, fontWeight: 700, color: C.ink, lineHeight: 1.2, margin: '0 auto 1rem', maxWidth: 620 }}>
            Pay once. Your app goes live.
          </h1>
          <p style={{ fontSize: 17, color: C.inkMid, maxWidth: 480, margin: '0 auto 1rem', lineHeight: 1.7 }}>
            No subscriptions. No monthly fees. One flat fee per migration —
            and you only keep it if your app is live.
          </p>
          {/* Spot counter */}
          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <div style={{ fontSize: 13, color: C.amberDark, fontWeight: 600 }}>
              🔥 {SPOTS_LEFT} of {SPOTS_TOTAL} founding spots remaining
            </div>
            <div style={{ width: 260, height: 6, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: C.amber, borderRadius: 4 }} />
            </div>
            <div style={{ fontSize: 11, color: C.inkLight }}>{spotsTaken} claimed · {SPOTS_LEFT} left at $50</div>
          </div>
        </section>

        {/* Pricing cards */}
        <section style={{ maxWidth: 900, margin: '2rem auto 0', padding: '0 2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, alignItems: 'start' }}>

            {/* Founding Member */}
            <div style={{
              background: 'linear-gradient(160deg, #FFFBEB 0%, #FEF3C7 100%)',
              border: `2px solid ${C.amber}`,
              borderRadius: 16, padding: '2rem',
              position: 'relative', overflow: 'hidden',
              gridColumn: '1',
            }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                background: C.amber,
                color: '#fff', textAlign: 'center',
                fontSize: 11, fontWeight: 800, padding: '5px 0', letterSpacing: '.06em',
              }}>
                🔥 FOUNDING MEMBER — 47 SPOTS LEFT
              </div>
              <div style={{ marginTop: 28 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.amberDark, marginBottom: 2 }}>Founding Member</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 48, fontWeight: 800, color: C.ink }}>$50</span>
                  <div>
                    <div style={{ fontSize: 13, color: C.inkLight, textDecoration: 'line-through' }}>$100</div>
                    <div style={{ fontSize: 12, color: C.amberDark, fontWeight: 600 }}>per migration</div>
                  </div>
                </div>
                <div style={{
                  background: '#fff', border: `1px solid #FDE68A`,
                  borderRadius: 8, padding: '8px 12px', marginBottom: 20, fontSize: 13, color: C.amberDark,
                }}>
                  💛 Price locked at $50 forever — even after spots are gone
                </div>
                {[
                  'Single repo migration',
                  'GitHub / Replit / Emergent',
                  'Vercel + Railway + Supabase',
                  'AI-powered migration agent',
                  '48h support',
                  '100% money-back if it fails',
                  'Founding price locked forever',
                ].map(f => (
                  <div key={f} style={{ fontSize: 14, color: C.ink, marginBottom: 8, display: 'flex', gap: 8 }}>
                    <span style={{ color: C.green, fontWeight: 700 }}>✓</span> {f}
                  </div>
                ))}
                <Link href="/register" style={{
                  display: 'block', marginTop: 24,
                  padding: '13px', background: C.amber, color: '#fff',
                  borderRadius: 8, textAlign: 'center', textDecoration: 'none',
                  fontWeight: 700, fontSize: 15,
                  boxShadow: '0 4px 14px rgba(217,119,6,.35)',
                }}>
                  Claim founding spot →
                </Link>
              </div>
            </div>

            {/* Standard */}
            <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 16, padding: '2rem' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.inkLight, marginBottom: 2 }}>Standard</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 44, fontWeight: 800, color: C.ink }}>$100</span>
                <span style={{ fontSize: 12, color: C.inkLight }}>per migration</span>
              </div>
              <div style={{ fontSize: 12, color: C.inkLight, marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${C.border}` }}>
                Available after founding spots sell out
              </div>
              {[
                'Single repo migration',
                'GitHub / Replit / Emergent',
                'Vercel + Railway + Supabase',
                'AI-powered migration agent',
                '48h support',
                '100% money-back if it fails',
              ].map(f => (
                <div key={f} style={{ fontSize: 14, color: C.inkMid, marginBottom: 8, display: 'flex', gap: 8 }}>
                  <span style={{ color: C.green }}>✓</span> {f}
                </div>
              ))}
              <Link href="/register" style={{
                display: 'block', marginTop: 24,
                padding: '12px', background: C.ink, color: '#fff',
                borderRadius: 8, textAlign: 'center', textDecoration: 'none',
                fontWeight: 600, fontSize: 14,
              }}>
                Get Started
              </Link>
            </div>

            {/* Pro */}
            <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 16, padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.inkLight }}>Pro</div>
                <div style={{ background: C.amberBg, color: C.amberDark, fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20 }}>Best value</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 44, fontWeight: 800, color: C.ink }}>$250</span>
                <span style={{ fontSize: 12, color: C.inkLight }}>per migration</span>
              </div>
              <div style={{ fontSize: 12, color: C.inkLight, marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${C.border}` }}>
                Available after founding spots sell out
              </div>
              {[
                'Everything in Standard',
                'Multi-platform analysis',
                'Priority deployment queue',
                '24h priority support',
                '100% money-back if it fails',
              ].map(f => (
                <div key={f} style={{ fontSize: 14, color: C.inkMid, marginBottom: 8, display: 'flex', gap: 8 }}>
                  <span style={{ color: C.green }}>✓</span> {f}
                </div>
              ))}
              <Link href="/register" style={{
                display: 'block', marginTop: 24,
                padding: '12px', background: C.ink, color: '#fff',
                borderRadius: 8, textAlign: 'center', textDecoration: 'none',
                fontWeight: 600, fontSize: 14,
              }}>
                Get Started
              </Link>
            </div>
          </div>
        </section>

        {/* Money-back guarantee strip */}
        <section style={{ maxWidth: 760, margin: '2.5rem auto 0', padding: '0 2rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)',
            border: '1.5px solid #86EFAC',
            borderRadius: 14, padding: '1.5rem 2rem',
            display: 'flex', gap: 20, alignItems: 'center',
          }}>
            <div style={{
              flexShrink: 0, width: 56, height: 56,
              background: 'linear-gradient(135deg, #059669, #065F46)',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, boxShadow: '0 4px 12px rgba(5,150,105,.3)',
            }}>💚</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: C.greenDark, marginBottom: 4 }}>
                100% Money-Back Guarantee
              </div>
              <p style={{ fontSize: 13, color: '#166534', lineHeight: 1.7, margin: 0 }}>
                If your migration fails for <em>any reason at all</em> — a bug on our side, an unsupported framework,
                anything — you get a <strong>full refund within 24 hours</strong>. No questions, no forms, no hassle.
                You only pay when your app is live.
              </p>
            </div>
          </div>
        </section>

        {/* Comparison table */}
        <ComparisonTable />

        {/* FAQ */}
        <section style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 2rem 4rem' }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: C.ink, marginBottom: 4, textAlign: 'center' }}>
            Frequently asked questions
          </h2>
          <p style={{ textAlign: 'center', color: C.inkMid, fontSize: 14, marginBottom: 32 }}>
            Still have questions? Email us at{' '}
            <a href="mailto:support@migratebot.io" style={{ color: C.amber, textDecoration: 'none', fontWeight: 600 }}>support@migratebot.io</a>
          </p>
          {FAQ.map((item, i) => <FAQItem key={i} {...item} />)}
        </section>

        {/* Bottom CTA */}
        <section style={{
          background: 'linear-gradient(135deg, #92400E 0%, #B45309 50%, #D97706 100%)',
          padding: '3.5rem 2rem', textAlign: 'center',
        }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 32, color: '#fff', marginBottom: 12 }}>
            {SPOTS_LEFT} founding spots left at $50
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,.85)', marginBottom: 24, maxWidth: 440, margin: '0 auto 24px' }}>
            Price goes to $100 when they're gone. Lock in your founding rate today.
          </p>
          <Link href="/register" style={{
            display: 'inline-block',
            padding: '14px 32px', background: '#fff', color: C.amberDark,
            borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 16,
            boxShadow: '0 4px 16px rgba(0,0,0,.2)',
          }}>
            Claim my founding spot →
          </Link>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', marginTop: 12 }}>
            100% money-back guarantee · No subscription · One-time payment
          </div>
        </section>

        {/* Footer */}
        <footer style={{ borderTop: `1px solid ${C.border}`, padding: '1.5rem 2rem', textAlign: 'center', color: C.inkLight, fontSize: 13, background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap', marginBottom: 8 }}>
            <span>🔒 <Term id="aes-256">AES-256</Term> encrypted</span>
            <span>🗑️ Code deleted after migration</span>
            <span>💚 100% money-back guarantee</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap', marginBottom: 6 }}>
            <Link href="/terms" style={{ color: C.inkLight, textDecoration: 'none' }}>Terms of Service</Link>
            <Link href="/privacy" style={{ color: C.inkLight, textDecoration: 'none' }}>Privacy Policy</Link>
            <Link href="/" style={{ color: C.inkLight, textDecoration: 'none' }}>Home</Link>
          </div>
          <div>© 2026 MigrateBot · support@migratebot.io</div>
        </footer>
      </div>
    </>
  );
}
