/**
 * frontend/pages/privacy.jsx
 * Privacy Policy — required by Stripe for live mode activation.
 * Update CONTACT_EMAIL, COMPANY_NAME, and GOVERNING_LAW before go-live.
 */
import Head from 'next/head';
import Link from 'next/link';

const COMPANY_NAME   = 'MigrateBot';
const CONTACT_EMAIL  = 'legal@migratebot.io';   // ← update before go-live
const GOVERNING_LAW  = 'Ontario, Canada';        // ← update before go-live
const EFFECTIVE_DATE = 'April 1, 2026';

const C = {
  amber: '#D97706', amberDark: '#B45309',
  ink: '#1A1814', inkMid: '#6B6860', inkLight: '#9B958A',
  border: '#E5E2DA', surface: '#F8F7F4', bg: '#FFFFFF',
};

const s = {
  page:    { minHeight: '100vh', background: C.bg, fontFamily: "'Inter', -apple-system, sans-serif", color: C.ink },
  nav:     { borderBottom: `1px solid ${C.border}`, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  logo:    { fontSize: 20, fontWeight: 800, textDecoration: 'none', color: C.ink },
  logoSpan:{ color: C.amber },
  navLink: { fontSize: 14, color: C.inkMid, textDecoration: 'none' },
  wrap:    { maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' },
  badge:   { display: 'inline-block', background: C.amberDark, color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', borderRadius: 6, padding: '3px 10px', marginBottom: 16 },
  h1:      { fontSize: 32, fontWeight: 800, lineHeight: 1.2, marginBottom: 8 },
  meta:    { fontSize: 13, color: C.inkLight, marginBottom: 40, borderBottom: `1px solid ${C.border}`, paddingBottom: 24 },
  h2:      { fontSize: 18, fontWeight: 700, marginTop: 40, marginBottom: 10 },
  p:       { fontSize: 15, lineHeight: 1.75, color: '#333', marginBottom: 14 },
  li:      { fontSize: 15, lineHeight: 1.75, color: '#333', marginBottom: 6 },
  ul:      { paddingLeft: 20, marginBottom: 14 },
  table:   { width: '100%', borderCollapse: 'collapse', marginBottom: 20, fontSize: 14 },
  th:      { textAlign: 'left', padding: '10px 12px', background: C.surface, borderBottom: `2px solid ${C.border}`, fontWeight: 700 },
  td:      { padding: '10px 12px', borderBottom: `1px solid ${C.border}`, verticalAlign: 'top', lineHeight: 1.6 },
  footer:  { borderTop: `1px solid ${C.border}`, marginTop: 60, paddingTop: 24, fontSize: 13, color: C.inkLight, display: 'flex', gap: 16, flexWrap: 'wrap' },
  footLink:{ color: C.amber, textDecoration: 'none' },
};

export default function Privacy() {
  return (
    <>
      <Head>
        <title>Privacy Policy — {COMPANY_NAME}</title>
        <meta name="description" content={`${COMPANY_NAME} Privacy Policy`} />
      </Head>

      <div style={s.page}>
        {/* Nav */}
        <nav style={s.nav}>
          <Link href="/" style={s.logo}>
            Migrate<span style={s.logoSpan}>Bot</span>
          </Link>
          <Link href="/" style={s.navLink}>← Back to home</Link>
        </nav>

        <div style={s.wrap}>
          <div style={s.badge}>Legal</div>
          <h1 style={s.h1}>Privacy Policy</h1>
          <p style={s.meta}>Effective date: {EFFECTIVE_DATE} · Questions? <a href={`mailto:${CONTACT_EMAIL}`} style={s.footLink}>{CONTACT_EMAIL}</a></p>

          <p style={s.p}>
            This Privacy Policy explains how {COMPANY_NAME} collects, uses, and protects your personal information
            when you use our automated migration platform. We take privacy seriously and will never sell your data.
          </p>

          <h2 style={s.h2}>1. Information We Collect</h2>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Category</th>
                <th style={s.th}>What we collect</th>
                <th style={s.th}>Why</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={s.td}><strong>Account</strong></td>
                <td style={s.td}>Name, email address, hashed password</td>
                <td style={s.td}>Authentication and account management</td>
              </tr>
              <tr>
                <td style={s.td}><strong>Migration data</strong></td>
                <td style={s.td}>Source repository URL, migration logs, deployment status, live URLs</td>
                <td style={s.td}>Executing and tracking your migration</td>
              </tr>
              <tr>
                <td style={s.td}><strong>Credentials</strong></td>
                <td style={s.td}>Encrypted API tokens for Railway, Vercel, Supabase, GitHub, and Anthropic</td>
                <td style={s.td}>Deploying to third-party platforms on your behalf</td>
              </tr>
              <tr>
                <td style={s.td}><strong>Payment</strong></td>
                <td style={s.td}>Stripe customer ID, last-4 digits of card, transaction IDs</td>
                <td style={s.td}>Billing — full card details are stored only by Stripe, never by us</td>
              </tr>
              <tr>
                <td style={s.td}><strong>Usage</strong></td>
                <td style={s.td}>IP address, browser type, pages visited, error logs</td>
                <td style={s.td}>Security, debugging, and service improvement</td>
              </tr>
            </tbody>
          </table>

          <h2 style={s.h2}>2. How We Use Your Information</h2>
          <ul style={s.ul}>
            <li style={s.li}>To create and manage your account</li>
            <li style={s.li}>To execute and monitor your migration jobs</li>
            <li style={s.li}>To process payments via Stripe</li>
            <li style={s.li}>To send transactional emails (migration status, receipts, security alerts)</li>
            <li style={s.li}>To detect and prevent fraud and abuse</li>
            <li style={s.li}>To improve the service through aggregated, anonymised analytics</li>
          </ul>
          <p style={s.p}>
            We do not use your data for advertising. We do not sell, rent, or share your personal data
            with third parties for their own marketing purposes.
          </p>

          <h2 style={s.h2}>3. Credential Security</h2>
          <p style={s.p}>
            API tokens and keys you store in {COMPANY_NAME} are encrypted at rest using AES-256 encryption
            before being written to the database. Encryption keys are stored separately from the data.
            Credentials are decrypted only in memory, only at the moment a migration job needs them,
            and are never logged or transmitted to any party other than the target platform.
          </p>

          <h2 style={s.h2}>4. Third-Party Processors</h2>
          <p style={s.p}>We share data with the following sub-processors to operate the service:</p>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Processor</th>
                <th style={s.th}>Purpose</th>
                <th style={s.th}>Privacy Policy</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Supabase', 'Database and authentication', 'https://supabase.com/privacy'],
                ['Stripe', 'Payment processing', 'https://stripe.com/privacy'],
                ['SendGrid (Twilio)', 'Transactional email', 'https://www.twilio.com/legal/privacy'],
                ['Anthropic', 'AI-powered migration agent', 'https://www.anthropic.com/privacy'],
                ['Railway', 'Backend deployment (your apps)', 'https://railway.app/legal/privacy'],
                ['Vercel', 'Frontend deployment (your apps)', 'https://vercel.com/legal/privacy-policy'],
              ].map(([name, purpose, url]) => (
                <tr key={name}>
                  <td style={s.td}><strong>{name}</strong></td>
                  <td style={s.td}>{purpose}</td>
                  <td style={s.td}><a href={url} target="_blank" rel="noopener noreferrer" style={s.footLink}>{url.replace('https://', '')}</a></td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 style={s.h2}>5. Data Retention</h2>
          <ul style={s.ul}>
            <li style={s.li}><strong>Account data:</strong> Retained until you delete your account.</li>
            <li style={s.li}><strong>Migration logs:</strong> Retained for 12 months, then purged automatically.</li>
            <li style={s.li}><strong>Credentials:</strong> Deleted immediately when you remove them in Settings, or when your account is deleted.</li>
            <li style={s.li}><strong>On account deletion:</strong> All personal data is purged from our systems within 30 days. Anonymised aggregate data (e.g. migration counts) may be retained indefinitely.</li>
          </ul>

          <h2 style={s.h2}>6. Your Rights</h2>
          <p style={s.p}>
            Depending on your jurisdiction you may have the following rights regarding your personal data:
          </p>
          <ul style={s.ul}>
            <li style={s.li}><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
            <li style={s.li}><strong>Correction:</strong> Request correction of inaccurate data.</li>
            <li style={s.li}><strong>Deletion:</strong> Request deletion of your account and associated data (also available via Settings → Danger Zone).</li>
            <li style={s.li}><strong>Portability:</strong> Request your data in a machine-readable format.</li>
            <li style={s.li}><strong>Objection / Restriction:</strong> Object to or restrict certain processing.</li>
          </ul>
          <p style={s.p}>
            To exercise any of these rights, email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={s.footLink}>{CONTACT_EMAIL}</a>.
            We will respond within 30 days.
          </p>

          <h2 style={s.h2}>7. Cookies</h2>
          <p style={s.p}>
            {COMPANY_NAME} uses only strictly necessary session cookies required for authentication.
            We do not use tracking cookies or third-party analytics cookies.
          </p>

          <h2 style={s.h2}>8. Children's Privacy</h2>
          <p style={s.p}>
            {COMPANY_NAME} is not directed at children under 18. We do not knowingly collect personal
            data from anyone under 18. If you believe a child has provided us with personal data,
            please contact us at {CONTACT_EMAIL} and we will delete it promptly.
          </p>

          <h2 style={s.h2}>9. Changes to This Policy</h2>
          <p style={s.p}>
            We may update this Privacy Policy from time to time. We will notify you by email at least
            14 days before material changes take effect. The effective date at the top of this page
            will always reflect the most recent version.
          </p>

          <h2 style={s.h2}>10. Governing Law</h2>
          <p style={s.p}>
            This Privacy Policy is governed by the laws of {GOVERNING_LAW}.
          </p>

          <h2 style={s.h2}>11. Contact</h2>
          <p style={s.p}>
            For privacy questions or data requests, contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={s.footLink}>{CONTACT_EMAIL}</a>.
          </p>

          <div style={s.footer}>
            <span>© {new Date().getFullYear()} {COMPANY_NAME}</span>
            <Link href="/terms" style={s.footLink}>Terms of Service</Link>
            <Link href="/" style={s.footLink}>Home</Link>
          </div>
        </div>
      </div>
    </>
  );
}
