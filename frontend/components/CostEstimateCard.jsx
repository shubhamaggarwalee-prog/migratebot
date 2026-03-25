/**
 * frontend/components/CostEstimateCard.jsx
 *
 * "What does your app cost?" — Task 16
 *
 * Shows a plain-English monthly cost breakdown for each deployed service:
 *   • Current free-tier status
 *   • Exactly what would trigger a paid upgrade
 *   • Estimated cost if they hit that upgrade
 *   • A realistic "if everything stays free" vs "if you grow" total
 *
 * Props:
 *   migration  — full migration object (uses .platforms, .deployed_urls, .plan)
 *
 * All figures are sourced from the platforms' published pricing pages
 * (Vercel Hobby/Pro, Railway Starter/Pro, Supabase Free/Pro).
 * Numbers are hardcoded here to avoid an external API dependency
 * and are easy to update when platform pricing changes.
 */

const C = {
  amber: '#D97706', amberBg: '#FEF3C7', amberDark: '#B45309',
  ink: '#1A1814', inkMid: '#5C574E', inkLight: '#9B958A',
  border: '#E5E2DA', surface: '#F8F7F4',
  green: '#059669', greenBg: '#D1FAE5',
  red: '#DC2626',   redBg: '#FEE2E2',
  blue: '#2563EB',  blueBg: '#DBEAFE',
  purple: '#7C3AED', purpleBg: '#EDE9FE',
};

// ─── Platform pricing definitions ──────────────────────────────────────────────────────────
//
// Each entry describes a service's free tier, upgrade triggers, and
// paid plan cost in plain English a non-developer can understand.

const PLATFORM_INFO = {
  vercel: {
    icon: '▲',
    name: 'Vercel',
    color: C.ink,
    bg: '#F8F8F8',
    role: 'Hosts your app’s front-end — what visitors see in their browser.',
    freeTier: {
      label: 'Hobby (Free)',
      summary: 'Completely free for personal projects.',
      limits: [
        'Unlimited personal projects',
        '100 GB of bandwidth per month',
        '6,000 build minutes per month',
        'Free SSL certificate (https://)',
      ],
    },
    upgradesTrigger: [
      'You’re running a commercial / business site',
      'You need a team (more than 1 person) to access the project',
      'Your site gets more than ~100 GB of traffic per month',
    ],
    paidPlan: {
      name: 'Pro',
      price: '$20 / month',
      includes: '1 TB bandwidth, team access, analytics, password protection',
    },
    tipIfFree: 'Most small apps stay on Vercel’s free Hobby tier for months or years.',
  },

  railway: {
    icon: '🚂',
    name: 'Railway',
    color: '#7C3AED',
    bg: C.purpleBg,
    role: 'Runs your app’s back-end logic — the invisible engine behind your app.',
    freeTier: {
      label: 'Starter ($5 credit / month)',
      summary: 'Railway gives you $5 of free compute credits every month.',
      limits: [
        '$5 in free compute credits each month (usually enough for a small app)',
        'Sleeps after 21 days of inactivity',
        '512 MB RAM, shared CPU',
        '1 GB of persistent storage',
      ],
    },
    upgradesTrigger: [
      'You use more than ~$5 of compute in a month (busy or always-on apps)',
      'You need your server to run 24/7 without sleeping',
      'Your app handles high traffic or does heavy processing',
    ],
    paidPlan: {
      name: 'Pro',
      price: '~$5–20 / month typical',
      includes: 'Pay-as-you-go compute — charged only for what you use. Most small apps cost $5–$15/mo.',
    },
    tipIfFree: 'A simple backend serving a few hundred users a day fits easily within the $5 free credit.',
  },

  supabase: {
    icon: '🗄️',
    name: 'Supabase',
    color: C.green,
    bg: C.greenBg,
    role: 'Stores all your app’s data — user accounts, posts, orders, anything your app saves.',
    freeTier: {
      label: 'Free',
      summary: 'Generous free tier — most small apps never need to upgrade.',
      limits: [
        '2 free projects',
        '500 MB database storage',
        '5 GB bandwidth per month',
        '50,000 active users per month',
        '500 MB file storage',
      ],
    },
    upgradesTrigger: [
      'Your database grows beyond 500 MB of data',
      'You have more than 50,000 users logging in per month',
      'Your app transfers more than 5 GB of data per month',
      'You need daily database backups',
    ],
    paidPlan: {
      name: 'Pro',
      price: '$25 / month',
      includes: '8 GB database, 250 GB bandwidth, daily backups, priority support',
    },
    tipIfFree: 'The Supabase free tier is enough for most apps up to tens of thousands of users.',
  },
};

// ─── sub-components ────────────────────────────────────────────────────────────────

function Check({ color = C.green }) {
  return <span style={{ color, fontWeight: 700, marginRight: 6, flexShrink: 0 }}>✓</span>;
}
function Warn({ color = C.amber }) {
  return <span style={{ color, fontWeight: 700, marginRight: 6, flexShrink: 0 }}>⚠️</span>;
}

function PlatformRow({ platformId, deployed }) {
  const info = PLATFORM_INFO[platformId];
  if (!info) return null;

  const [open, setOpen] = React.useState(false);

  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: 12, overflow: 'hidden',
      marginBottom: 10,
    }}>
      {/* ── accordion header ── */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '13px 16px',
          background: open ? info.bg : '#fff',
          border: 'none', cursor: 'pointer', textAlign: 'left',
          transition: 'background .15s',
        }}
      >
        <span style={{ fontSize: 22, flexShrink: 0 }}>{info.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.ink }}>{info.name}</div>
          <div style={{ fontSize: 12, color: C.inkMid, marginTop: 1 }}>{info.role}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {deployed ? (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: C.greenBg, color: C.green }}>✓ Deployed</span>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: C.surface, color: C.inkLight }}>Not used</span>
          )}
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: info.bg, color: info.color }}>{info.freeTier.label}</span>
          <span style={{ color: C.inkLight, fontSize: 16, transition: 'transform .2s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
        </div>
      </button>

      {/* ── accordion body ── */}
      {open && (
        <div style={{ padding: '14px 16px', borderTop: `1px solid ${C.border}`, background: '#fff' }}>

          {/* Free tier limits */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 8 }}>🆓 What you get for free right now</div>
            {info.freeTier.limits.map(l => (
              <div key={l} style={{ display: 'flex', fontSize: 13, color: C.inkMid, marginBottom: 5, alignItems: 'flex-start' }}>
                <Check />{l}
              </div>
            ))}
          </div>

          {/* Upgrade triggers */}
          <div style={{ marginBottom: 14, background: C.amberBg, borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.amberDark, marginBottom: 8 }}>⚠️ When would you need to pay?</div>
            {info.upgradesTrigger.map(t => (
              <div key={t} style={{ display: 'flex', fontSize: 13, color: C.inkMid, marginBottom: 5, alignItems: 'flex-start' }}>
                <Warn />{t}
              </div>
            ))}
          </div>

          {/* Paid plan */}
          <div style={{ background: C.surface, borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.inkMid, marginBottom: 6 }}>💳 If you upgrade to {info.paidPlan.name}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: C.inkMid }}>Monthly cost</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.amber }}>{info.paidPlan.price}</span>
            </div>
            <div style={{ fontSize: 12, color: C.inkMid, lineHeight: 1.5 }}>{info.paidPlan.includes}</div>
          </div>

          {/* Pro tip */}
          <div style={{ fontSize: 12, color: C.inkMid, fontStyle: 'italic', lineHeight: 1.5 }}>
            💡 {info.tipIfFree}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── main export ────────────────────────────────────────────────────────────────

import React from 'react';

export default function CostEstimateCard({ migration }) {
  if (!migration || migration.status !== 'complete') return null;

  const platforms    = migration.platforms || [];
  const deployedUrls = migration.deployed_urls || {};

  // Which services were actually deployed?
  const hasVercel   = platforms.includes('vercel')   || !!deployedUrls.frontend;
  const hasRailway  = platforms.includes('railway')  || !!deployedUrls.backend;
  const hasSupabase = platforms.includes('supabase') || !!deployedUrls.database;

  const activeServices = [
    hasVercel   && 'vercel',
    hasRailway  && 'railway',
    hasSupabase && 'supabase',
  ].filter(Boolean);

  // Total cost scenarios
  const allFreeCost = [
    hasVercel   ? 0  : null,
    hasRailway  ? 5  : null,    // Railway’s $5/mo free credit
    hasSupabase ? 0  : null,
  ].filter(v => v !== null).reduce((a, b) => a + b, 0);

  const allPaidCost = [
    hasVercel   ? 20 : null,
    hasRailway  ? 15 : null,    // mid-range Railway Pro estimate
    hasSupabase ? 25 : null,
  ].filter(v => v !== null).reduce((a, b) => a + b, 0);

  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      border: `1px solid ${C.border}`,
      padding: '24px 28px',
      marginBottom: '1.5rem',
      boxShadow: '0 2px 16px rgba(0,0,0,.04)',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 28 }}>💰</span>
        <div>
          <h3 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 20, color: C.ink }}>What does your app cost?</h3>
          <p style={{ margin: 0, fontSize: 13, color: C.inkMid, marginTop: 2 }}>A plain-English breakdown of your monthly hosting bill</p>
        </div>
      </div>

      {/* Summary banner */}
      <div style={{ background: C.greenBg, border: `1px solid ${C.green}33`, borderRadius: 10, padding: '12px 16px', marginBottom: 20, marginTop: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.green, marginBottom: 6 }}>🎉 Right now: mostly free</div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: C.inkMid, marginBottom: 2 }}>If you stay within free limits</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.green }}>
              {allFreeCost === 0 ? '$0' : `$${allFreeCost}`} / mo
            </div>
            {allFreeCost > 0 && (
              <div style={{ fontSize: 11, color: C.inkMid, marginTop: 1 }}>*Railway provides $5 free credit monthly</div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.inkMid, marginBottom: 2 }}>If you upgrade all services</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.amber }}>${allPaidCost} / mo</div>
            <div style={{ fontSize: 11, color: C.inkMid, marginTop: 1 }}>still far cheaper than a server + developer</div>
          </div>
        </div>
      </div>

      {/* How to read this */}
      <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.7, marginBottom: 20 }}>
        Your app uses <strong style={{ color: C.ink }}>{activeServices.length} service{activeServices.length !== 1 ? 's' : ''}</strong> to run.
        Every service starts on a generous free tier.
        You only start paying if your app grows beyond the free limits
        — and we’ll tell you exactly when that is.
        Click any service below to see the details.
      </div>

      {/* Per-platform rows */}
      {['vercel', 'railway', 'supabase']
        .filter(p => PLATFORM_INFO[p])
        .map(p => (
          <PlatformRow
            key={p}
            platformId={p}
            deployed={p === 'vercel' ? hasVercel : p === 'railway' ? hasRailway : hasSupabase}
          />
        ))
      }

      {/* Footer note */}
      <div style={{ marginTop: 14, padding: '10px 14px', background: C.surface, borderRadius: 8, fontSize: 12, color: C.inkMid, lineHeight: 1.6 }}>
        <strong style={{ color: C.ink }}>🔔 Good to know:</strong> All prices are in USD and based on each platform’s publicly listed plans as of 2025.
        Pricing may change — check each platform’s website for the latest figures.
        <span style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
          {hasVercel   && <a href="https://vercel.com/pricing"   target="_blank" rel="noreferrer" style={{ color: C.amber, fontWeight: 600 }}>Vercel pricing ↗</a>}
          {hasRailway  && <a href="https://railway.app/pricing"  target="_blank" rel="noreferrer" style={{ color: C.amber, fontWeight: 600 }}>Railway pricing ↗</a>}
          {hasSupabase && <a href="https://supabase.com/pricing" target="_blank" rel="noreferrer" style={{ color: C.amber, fontWeight: 600 }}>Supabase pricing ↗</a>}
        </span>
      </div>
    </div>
  );
}
