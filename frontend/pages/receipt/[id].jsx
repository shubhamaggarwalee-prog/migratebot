/**
 * frontend/pages/receipt/[id].jsx
 *
 * Public shareable migration receipt — Task 18
 *
 * No authentication required.  Accessible at /receipt/:migrationId.
 * Fetches a stripped-down public snapshot from GET /api/receipt/:id.
 *
 * Features:
 *  • Clean card layout: app name, migration date, tech stack, platforms
 *  • "Migrated with MigrateBot" badge with shield icon
 *  • One-click copy URL button
 *  • Twitter / X share button  (pre-filled text)
 *  • LinkedIn share button
 *  • "View live app" CTA when a live URL is present
 *  • OpenGraph meta tags for rich social previews
 *  • Print / save as PDF friendly (no nav chrome)
 */
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://migratebot.io';

const C = {
  amber: '#D97706', amberBg: '#FEF3C7', amberDark: '#B45309',
  ink: '#1A1814', inkMid: '#5C574E', inkLight: '#9B958A',
  border: '#E5E2DA', surface: '#F8F7F4',
  green: '#059669', greenBg: '#D1FAE5',
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return 'Unknown date';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function PillBadge({ icon, label, color = C.inkMid, bg = C.surface }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 12px', borderRadius: 20,
      background: bg, color,
      fontSize: 12, fontWeight: 600,
      border: `1px solid ${C.border}`,
    }}>
      <span>{icon}</span>{label}
    </span>
  );
}

function ShareBtn({ href, label, icon, bg, color = '#fff' }) {
  return (
    <a
      href={href} target="_blank" rel="noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '10px 18px', borderRadius: 8,
        background: bg, color,
        fontWeight: 700, fontSize: 13,
        textDecoration: 'none', border: 'none', cursor: 'pointer',
        transition: 'opacity .15s',
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>{label}
    </a>
  );
}

// ─── main component ──────────────────────────────────────────────────────────────

export default function ReceiptPage() {
  const router       = useRouter();
  const { id }       = router.query;
  const [receipt, setReceipt]   = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied]     = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`${API}/api/receipt/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => setReceipt(d.receipt))
      .catch(() => setNotFound(true));
  }, [id]);

  const receiptUrl = typeof window !== 'undefined'
    ? window.location.href
    : `${SITE}/receipt/${id}`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(receiptUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── meta helpers ──
  const ogTitle       = receipt ? `${receipt.appName} — Migrated with MigrateBot` : 'MigrateBot Receipt';
  const ogDescription = receipt
    ? `${receipt.appName} was successfully migrated and deployed on ${fmtDate(receipt.migratedAt)} using MigrateBot.`
    : 'View this migration receipt on MigrateBot.';
  const tweetText     = receipt
    ? encodeURIComponent(`🚀 Just deployed ${receipt.appName} with @MigrateBot — took minutes, not days! ${receiptUrl}`)
    : '';
  const liUrl         = receipt
    ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(receiptUrl)}`
    : '#';

  // ── loading state ──
  if (!receipt && !notFound) return (
    <div style={{ minHeight: '100vh', background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 14, color: C.inkLight }}>Loading receipt…</div>
    </div>
  );

  // ── not found ──
  if (notFound) return (
    <div style={{ minHeight: '100vh', background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: C.ink, marginBottom: 8 }}>Receipt not found</h1>
        <p style={{ fontSize: 14, color: C.inkMid, lineHeight: 1.7 }}>
          This receipt either doesn’t exist or the migration hasn’t completed yet.
        </p>
        <a href="https://migratebot.io" style={{ display: 'inline-block', marginTop: 20, color: C.amber, fontWeight: 700, fontSize: 14 }}>Go to MigrateBot →</a>
      </div>
    </div>
  );

  // ── receipt ──
  const { appName, migratedAt, techStack, platforms, liveUrl, sourcePlatform, tier } = receipt;

  return (
    <>
      <Head>
        <title>{ogTitle}</title>
        <meta name="description" content={ogDescription} />
        {/* OpenGraph */}
        <meta property="og:title"       content={ogTitle} />
        <meta property="og:description" content={ogDescription} />
        <meta property="og:url"         content={receiptUrl} />
        <meta property="og:type"        content="website" />
        <meta property="og:site_name"   content="MigrateBot" />
        {/* Twitter card */}
        <meta name="twitter:card"        content="summary" />
        <meta name="twitter:title"       content={ogTitle} />
        <meta name="twitter:description" content={ogDescription} />
        <meta name="twitter:site"        content="@MigrateBot" />
      </Head>

      {/* Full-page neutral background */}
      <div style={{ minHeight: '100vh', background: C.surface, padding: '40px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* ── Thin top bar with logo ── */}
        <div style={{ width: '100%', maxWidth: 600, marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="https://migratebot.io" style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 18, color: C.ink, textDecoration: 'none' }}>
            ⚡ Migrate<span style={{ color: C.amber }}>Bot</span>
          </a>
          <a href="https://migratebot.io/migrate" style={{ fontSize: 12, color: C.amber, fontWeight: 700, textDecoration: 'none' }}>Deploy your app →</a>
        </div>

        {/* ── Main receipt card ── */}
        <div style={{
          width: '100%', maxWidth: 600,
          background: '#fff',
          borderRadius: 20,
          border: `1.5px solid ${C.border}`,
          boxShadow: '0 4px 32px rgba(0,0,0,.06)',
          overflow: 'hidden',
        }}>

          {/* Card header — amber gradient strip */}
          <div style={{
            background: 'linear-gradient(135deg, #1A1814 0%, #2D2820 100%)',
            padding: '28px 32px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9B7E4A', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Migration Receipt</div>
                <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: '#fff', margin: 0, lineHeight: 1.2 }}>{appName}</h1>
                <div style={{ fontSize: 13, color: '#9B958A', marginTop: 8 }}>Deployed on {fmtDate(migratedAt)}</div>
              </div>
              {/* Big checkmark */}
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.greenBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 24, color: C.green }}>✓</span>
              </div>
            </div>
          </div>

          {/* Card body */}
          <div style={{ padding: '28px 32px' }}>

            {/* ── Live URL ── */}
            {liveUrl && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.inkLight, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Live App</div>
                <a
                  href={liveUrl}
                  target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: C.amberBg, border: `1px solid ${C.amber}44`, borderRadius: 10, color: C.amberDark, fontWeight: 700, fontSize: 14, textDecoration: 'none', wordBreak: 'break-all' }}
                >
                  <span>{liveUrl}</span>
                  <span style={{ flexShrink: 0, marginLeft: 8 }}>↗</span>
                </a>
              </div>
            )}

            {/* ── Tech stack row ── */}
            {(techStack.framework || techStack.language || techStack.database) && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.inkLight, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Tech Stack</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {techStack.framework && (
                    <PillBadge icon={techStack.frameworkIcon} label={techStack.framework} bg={C.surface} />
                  )}
                  {techStack.language && (
                    <PillBadge icon="💻" label={techStack.language} bg={C.surface} />
                  )}
                  {techStack.database && (
                    <PillBadge icon="🗄️" label={techStack.database} bg={C.surface} />
                  )}
                </div>
              </div>
            )}

            {/* ── Platforms row ── */}
            {platforms.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.inkLight, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Deployed To</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {platforms.map(p => (
                    <PillBadge key={p.name} icon={p.icon} label={p.name} color={p.color} bg="#fff" />
                  ))}
                </div>
              </div>
            )}

            {/* ── Source ── */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.inkLight, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Migrated From</div>
              <PillBadge icon={sourcePlatform.icon} label={sourcePlatform.name} bg="#fff" />
            </div>

            {/* ── MigrateBot badge ── */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 18px',
              background: 'linear-gradient(135deg, #1A1814, #2D2820)',
              borderRadius: 12, marginBottom: 28,
            }}>
              <span style={{ fontSize: 22 }}>⚡</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Migrated with MigrateBot</div>
                <div style={{ fontSize: 11, color: '#9B958A', marginTop: 1 }}>Deployed in minutes, not days — migratebot.io</div>
              </div>
              <div style={{ marginLeft: 'auto', background: C.green, color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>✓ VERIFIED</div>
            </div>

            {/* ── Share row ── */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.inkLight, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Share this receipt</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>

                {/* Copy link */}
                <button
                  onClick={handleCopy}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '10px 18px', borderRadius: 8,
                    background: copied ? C.green : C.surface,
                    color: copied ? '#fff' : C.ink,
                    fontWeight: 700, fontSize: 13,
                    border: `1px solid ${C.border}`, cursor: 'pointer',
                    transition: 'all .2s',
                  }}
                >
                  <span>{copied ? '✓' : '🔗'}</span>
                  {copied ? 'Copied!' : 'Copy link'}
                </button>

                {/* Twitter / X */}
                <ShareBtn
                  href={`https://twitter.com/intent/tweet?text=${tweetText}`}
                  label="Share on X"
                  icon="𝕏"
                  bg="#000"
                />

                {/* LinkedIn */}
                <ShareBtn
                  href={liUrl}
                  label="LinkedIn"
                  icon="in"
                  bg="#0A66C2"
                />

                {/* WhatsApp */}
                <ShareBtn
                  href={`https://wa.me/?text=${encodeURIComponent(`Check out my deployed app — ${appName}: ${receiptUrl}`)}`}
                  label="WhatsApp"
                  icon="💬"
                  bg="#25D366"
                />

              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 32, fontSize: 12, color: C.inkLight, textAlign: 'center', lineHeight: 1.8 }}>
          Want to deploy your own app in minutes?{' '}
          <a href="https://migratebot.io" style={{ color: C.amber, fontWeight: 700 }}>Try MigrateBot free →</a>
        </div>

      </div>
    </>
  );
}
