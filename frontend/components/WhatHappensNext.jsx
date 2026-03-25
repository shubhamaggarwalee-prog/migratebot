/**
 * frontend/components/WhatHappensNext.jsx
 *
 * Plain-English "What Happens Next" guide shown after every successful migration.
 * Zero jargon. Usage:
 *   <WhatHappensNext deployedUrls={migration.deployed_urls} sourcePlatform="github" />
 */
import { useState } from 'react';
import Term from './Term';

const C = {
  amber: '#D97706', amberBg: '#FEF3C7', amberDark: '#B45309',
  ink: '#1A1814', inkMid: '#5C574E', inkLight: '#9B958A',
  border: '#E5E2DA', surface: '#F8F7F4',
  green: '#059669', greenBg: '#D1FAE5', greenDark: '#065F46',
  blue: '#2563EB', blueBg: '#DBEAFE',
  red: '#DC2626', redBg: '#FEE2E2',
  purple: '#7C3AED', purpleBg: '#EDE9FE',
};

// Single expandable step card
function StepCard({ number, icon, title, badge, badgeColor, badgeBg, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      border: `1px solid ${C.border}`,
      borderLeft: `4px solid ${badgeColor}`,
      overflow: 'hidden',
      marginBottom: 12,
      transition: 'box-shadow .2s',
      boxShadow: open ? '0 4px 20px rgba(0,0,0,.07)' : 'none',
    }}>
      {/* Header — always visible, click to expand */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 14,
          padding: '16px 18px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        {/* Step number bubble */}
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: badgeBg, color: badgeColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 14,
        }}>
          {number}
        </div>
        <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>{title}</div>
          <div style={{
            display: 'inline-block', marginTop: 3,
            background: badgeBg, color: badgeColor,
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
          }}>{badge}</div>
        </div>
        <span style={{
          color: C.inkLight, fontSize: 18,
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform .2s',
          display: 'inline-block',
        }}>▾</span>
      </button>

      {/* Body */}
      {open && (
        <div style={{
          padding: '0 18px 20px 18px',
          borderTop: `1px solid ${C.border}`,
          paddingTop: 16,
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

// Reusable numbered step row inside a card body
function MiniStep({ n, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        background: C.amber, color: '#fff',
        fontSize: 11, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, marginTop: 1,
      }}>{n}</div>
      <div style={{ fontSize: 14, color: C.inkMid, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

// Info callout box
function Callout({ icon = 'ℹ', color = C.blue, bg = C.blueBg, children }) {
  return (
    <div style={{
      background: bg, border: `1px solid ${color}33`,
      borderRadius: 8, padding: '10px 14px',
      display: 'flex', gap: 10, alignItems: 'flex-start',
      marginTop: 12,
    }}>
      <span style={{ color, fontSize: 15, flexShrink: 0 }}>{icon}</span>
      <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

export default function WhatHappensNext({ deployedUrls = {}, sourcePlatform = 'github' }) {
  const frontendUrl = deployedUrls?.frontend;
  const isGithub  = sourcePlatform === 'github';
  const isReplit  = sourcePlatform === 'replit';

  return (
    <div style={{ marginTop: 8 }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 20,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: C.amberBg, display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>📋</div>
        <div>
          <h2 style={{
            fontFamily: 'Georgia, serif', fontSize: 20,
            color: C.ink, margin: 0,
          }}>What happens next?</h2>
          <p style={{ fontSize: 13, color: C.inkLight, margin: 0, marginTop: 2 }}>
            Everything you need to know — in plain English, no tech knowledge required.
          </p>
        </div>
      </div>

      {/* ─── Step 1: How to update your app ─────────────────────────────── */}
      <StepCard
        number={1}
        icon="✏️"
        title="How to update your app"
        badge="Most common task"
        badgeColor={C.green}
        badgeBg={C.greenBg}
        defaultOpen
      >
        <p style={{ fontSize: 14, color: C.inkMid, marginBottom: 14, lineHeight: 1.7 }}>
          Made a change to your app? Here's how to get it live. The whole process takes under 2 minutes.
        </p>

        {isGithub && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.ink, marginBottom: 10 }}>
              If you edit your code on <Term id="github">GitHub</Term>:
            </div>
            <MiniStep n={1}>Make your changes in your <Term id="repo">GitHub repository</Term> — edit files, add new ones, whatever you need.</MiniStep>
            <MiniStep n={2}>Click the green <strong>"Commit changes"</strong> button (that's GitHub's word for "save"). Your changes are now saved.</MiniStep>
            <MiniStep n={3}><Term id="vercel">Vercel</Term> watches your <Term id="repo">repository</Term> automatically. Within about 60 seconds, it will notice the change and rebuild your app — no action needed from you.</MiniStep>
            <MiniStep n={4}>Visit your live app link. Your changes are now live for everyone to see. ✓</MiniStep>
            <Callout icon="💡" color={C.amber} bg={C.amberBg}>
              <strong>Didn't auto-deploy?</strong> Go to your <Term id="vercel">Vercel</Term> dashboard, find your project, and click <strong>"Redeploy"</strong>. That manually triggers an update.
            </Callout>
          </div>
        )}

        {isReplit && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.ink, marginBottom: 10 }}>
              If you edit your code on <Term id="replit">Replit</Term>:
            </div>
            <MiniStep n={1}>Make your changes inside your Replit project as normal.</MiniStep>
            <MiniStep n={2}>In Replit, click <strong>"Version control"</strong> → <strong>"Commit & push"</strong>. This sends your changes to GitHub.</MiniStep>
            <MiniStep n={3}><Term id="vercel">Vercel</Term> will spot the change automatically and redeploy within about 60 seconds.</MiniStep>
            <MiniStep n={4}>Visit your live link to confirm the update is showing. ✓</MiniStep>
          </div>
        )}

        {!isGithub && !isReplit && (
          <div>
            <MiniStep n={1}>Edit your code wherever you normally work on it.</MiniStep>
            <MiniStep n={2}>Push or commit your changes to your connected code repository.</MiniStep>
            <MiniStep n={3}><Term id="vercel">Vercel</Term> watches your repository and will automatically rebuild and redeploy your app — usually within 60 seconds.</MiniStep>
            <MiniStep n={4}>Check your live app link to confirm the update is live. ✓</MiniStep>
          </div>
        )}

        <Callout icon="🔄" color={C.blue} bg={C.blueBg}>
          <strong>Big change?</strong> You can also come back to MigrateBot and run a new <Term id="migration">migration</Term> — it'll redeploy everything from scratch with the latest version of your code.
        </Callout>
      </StepCard>

      {/* ─── Step 2: How to add a custom domain ──────────────────────────── */}
      <StepCard
        number={2}
        icon="🌐"
        title="How to add your own web address (domain)"
        badge="Optional but recommended"
        badgeColor={C.blue}
        badgeBg={C.blueBg}
      >
        <p style={{ fontSize: 14, color: C.inkMid, marginBottom: 14, lineHeight: 1.7 }}>
          Right now your app has an address that looks like <code style={{ background: C.surface, padding: '1px 5px', borderRadius: 4, fontSize: 13 }}>your-app.vercel.app</code>. If you want a proper address like <code style={{ background: C.surface, padding: '1px 5px', borderRadius: 4, fontSize: 13 }}>myapp.com</code>, here's how.
        </p>

        <div style={{ fontWeight: 700, fontSize: 13, color: C.ink, marginBottom: 10 }}>Part A — Buy a domain name (skip if you already have one)</div>
        <MiniStep n={1}>Go to a domain registrar — we recommend <a href="https://domains.google" target="_blank" rel="noreferrer" style={{ color: C.amber }}>Google Domains</a> or <a href="https://www.namecheap.com" target="_blank" rel="noreferrer" style={{ color: C.amber }}>Namecheap</a>.</MiniStep>
        <MiniStep n={2}>Search for the name you want (e.g. "myapp.com") and buy it. Costs around $10–15 per year.</MiniStep>

        <div style={{ fontWeight: 700, fontSize: 13, color: C.ink, marginBottom: 10, marginTop: 16 }}>Part B — Connect it to your app</div>
        <MiniStep n={1}>Go to <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer" style={{ color: C.amber }}>vercel.com/dashboard</a> and click on your project.</MiniStep>
        <MiniStep n={2}>Click <strong>"Settings"</strong> → <strong>"Domains"</strong> → <strong>"Add"</strong> and type in your domain name.</MiniStep>
        <MiniStep n={3}><Term id="vercel">Vercel</Term> will show you two pieces of information — a <strong>CNAME</strong> and an <strong>A Record</strong>. These are like a forwarding address for your domain.</MiniStep>
        <MiniStep n={4}>Go back to where you bought your domain (Google Domains, Namecheap, etc.), find <strong>"DNS settings"</strong>, and copy those two values in exactly as shown.</MiniStep>
        <MiniStep n={5}>Wait 10–30 minutes. Your domain will start pointing to your app. ✓</MiniStep>

        <Callout icon="💡" color={C.amber} bg={C.amberBg}>
          <strong>SSL / "https://" is automatic.</strong> Vercel gives your domain a security certificate for free the moment it connects — your visitors will see the padlock icon without you doing anything extra.
        </Callout>
        <Callout icon="🆘" color={C.blue} bg={C.blueBg}>
          <strong>Stuck on the DNS part?</strong> Email us at <a href="mailto:support@migratebot.io" style={{ color: C.blue }}>support@migratebot.io</a> — this is one of the most confusing parts for non-developers and we're happy to walk you through it.
        </Callout>
      </StepCard>

      {/* ─── Step 3: What to do if something breaks ──────────────────────── */}
      <StepCard
        number={3}
        icon="🆘"
        title="What to do if something breaks"
        badge="Don't panic — there's always a fix"
        badgeColor={C.purple}
        badgeBg={C.purpleBg}
      >
        <p style={{ fontSize: 14, color: C.inkMid, marginBottom: 14, lineHeight: 1.7 }}>
          Something's not working? Here's how to figure out what's wrong and fix it — step by step.
        </p>

        {[
          {
            q: '🌐 My app shows a blank white page or an error message',
            steps: [
              <span key="a">Go to <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer" style={{ color: C.amber }}>vercel.com/dashboard</a>, click your project, then click <strong>"Deployments"</strong>.</span>,
              'Find the most recent deployment and click it. Look for any red error messages — they usually say exactly what went wrong in plain English.',
              <span key="b">If you see something about a <strong>missing environment variable</strong>, that means a setting is missing. Email us and we\'ll sort it for you.</span>,
              'If you made a recent code change, click "Redeploy" on the previous deployment to roll back to the version that was working.',
            ],
          },
          {
            q: '💾 My app\'s data isn\'t saving or I can\'t log in',
            steps: [
              <span key="a">Go to <a href="https://app.supabase.com" target="_blank" rel="noreferrer" style={{ color: C.amber }}>app.supabase.com</a> and click on your project.</span>,
              <span key="b">Click <strong>"Table Editor"</strong> to check whether your data is actually there. If the tables are empty, there may be a <Term id="database">database</Term> connection issue.</span>,
              'Click "Logs" → "API logs" and look for any red error entries.',
              'If you see "connection refused" or "auth error", your database URL may have changed. Email us at support@migratebot.io with your project name and we\'ll fix it.',
            ],
          },
          {
            q: '⚙️ The backend / API part of my app isn\'t working',
            steps: [
              <span key="a">Go to <a href="https://railway.app/dashboard" target="_blank" rel="noreferrer" style={{ color: C.amber }}>railway.app/dashboard</a> and click on your project.</span>,
              <span key="b">Click on your service and look at the <strong>"Logs"</strong> tab. Errors will appear here in red.</span>,
              'If the service shows "Sleeping" or "Crashed", click "Restart" to bring it back online.',
              'If restarts don\'t help, click "Settings" → "Redeploy" to do a full fresh deploy of your backend.',
            ],
          },
          {
            q: '🐢 My app is working but feels very slow',
            steps: [
              'This is usually because your backend "goes to sleep" after a few minutes of no traffic — this is normal on free plans.',
              'The first visitor after a quiet period waits ~5–10 seconds for it to wake up. Subsequent visitors are fast again.',
              <span key="a">To prevent this, upgrade to a paid plan on <Term id="railway">Railway</Term> ($5/month) which keeps your server always awake.</span>,
              'Alternatively, use a free tool like UptimeRobot to ping your app every 5 minutes — this keeps it awake at no cost.',
            ],
          },
        ].map((item, i) => (
          <div key={i} style={{
            marginBottom: 18,
            paddingBottom: 18,
            borderBottom: i < 3 ? `1px dashed ${C.border}` : 'none',
          }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.ink, marginBottom: 10 }}>{item.q}</div>
            {item.steps.map((s, j) => (
              <MiniStep key={j} n={j + 1}>{s}</MiniStep>
            ))}
          </div>
        ))}

        <Callout icon="🆘" color={C.red} bg={'#FFF1F2'}>
          <strong>Still stuck?</strong> Email <a href="mailto:support@migratebot.io" style={{ color: C.red }}>support@migratebot.io</a> with your migration ID and a description of what's wrong. If the problem is on our end, we'll fix it for free and you'll hear back within a few hours.
        </Callout>
      </StepCard>

      {/* ─── Step 4: Keeping your app running long term ───────────────────── */}
      <StepCard
        number={4}
        icon="📊"
        title="Keeping your app healthy long-term"
        badge="Good to know"
        badgeColor={C.inkMid}
        badgeBg={C.surface}
      >
        <p style={{ fontSize: 14, color: C.inkMid, marginBottom: 14, lineHeight: 1.7 }}>
          Your app is live and running — here's what to keep an eye on so it stays that way.
        </p>

        {[
          {
            icon: '💸',
            title: 'Free tier limits',
            body: <span>
              <Term id="vercel">Vercel</Term>, <Term id="railway">Railway</Term>, and <Term id="supabase">Supabase</Term> all have generous free tiers.
              If you get a lot of traffic or store a lot of data, you may eventually be asked to upgrade to a paid plan — usually around $5–20/month.
              They'll email you well before anything stops working.
            </span>,
          },
          {
            icon: '🔑',
            title: 'Keep your API tokens safe',
            body: <span>
              The <Term id="api-token">API tokens</Term> you used during setup give access to your services.
              Never share them publicly or post them to social media.
              If you think one has been leaked, go to the service's website and delete the old token, then create a new one.
            </span>,
          },
          {
            icon: '🔁',
            title: 'Back up your data occasionally',
            body: <span>
              Your <Term id="database">database</Term> on <Term id="supabase">Supabase</Term> is backed up automatically.
              But for peace of mind, visit <a href="https://app.supabase.com" target="_blank" rel="noreferrer" style={{ color: C.amber }}>app.supabase.com</a> every few months, click your project → <strong>"Database"</strong> → <strong>"Backups"</strong>, and download a copy.
            </span>,
          },
          {
            icon: '📬',
            title: 'Watch for emails from your services',
            body: 'Vercel, Railway, and Supabase occasionally send important emails about usage limits or upcoming changes. Keep an eye on the inbox you used to sign up. Nothing bad will happen without plenty of warning.',
          },
        ].map((item, i) => (
          <div key={i} style={{
            display: 'flex', gap: 14, marginBottom: 16,
            paddingBottom: 16,
            borderBottom: i < 3 ? `1px dashed ${C.border}` : 'none',
          }}>
            <span style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>{item.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.ink, marginBottom: 4 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.7 }}>{item.body}</div>
            </div>
          </div>
        ))}
      </StepCard>

      {/* Footer CTA */}
      <div style={{
        background: C.amberBg, border: `1px solid ${C.amber}44`,
        borderRadius: 12, padding: '16px 18px',
        display: 'flex', alignItems: 'center', gap: 14, marginTop: 4,
      }}>
        <span style={{ fontSize: 28 }}>🙋</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.ink, marginBottom: 2 }}>Need help with anything?</div>
          <div style={{ fontSize: 13, color: C.inkMid }}>We're a small team and we actually reply. Email us at{' '}
            <a href="mailto:support@migratebot.io" style={{ color: C.amber, fontWeight: 600 }}>support@migratebot.io</a>
            {' '}— if it's our fault, we fix it for free.
          </div>
        </div>
      </div>
    </div>
  );
}
