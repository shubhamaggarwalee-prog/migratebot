/**
 * frontend/pages/terms.jsx
 * Terms of Service — required by Stripe for live mode activation.
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
  footer:  { borderTop: `1px solid ${C.border}`, marginTop: 60, paddingTop: 24, fontSize: 13, color: C.inkLight, display: 'flex', gap: 16, flexWrap: 'wrap' },
  footLink:{ color: C.amber, textDecoration: 'none' },
};

export default function Terms() {
  return (
    <>
      <Head>
        <title>Terms of Service — {COMPANY_NAME}</title>
        <meta name="description" content={`${COMPANY_NAME} Terms of Service`} />
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
          <h1 style={s.h1}>Terms of Service</h1>
          <p style={s.meta}>Effective date: {EFFECTIVE_DATE} · Questions? <a href={`mailto:${CONTACT_EMAIL}`} style={s.footLink}>{CONTACT_EMAIL}</a></p>

          <p style={s.p}>
            Please read these Terms of Service carefully before using {COMPANY_NAME}. By creating an account or
            initiating a migration you agree to be bound by these Terms. If you do not agree, do not use the service.
          </p>

          <h2 style={s.h2}>1. What MigrateBot Does</h2>
          <p style={s.p}>
            {COMPANY_NAME} is an automated migration platform that moves web applications from sources such as
            GitHub, Replit, and Emergent Code to deployment infrastructure comprising Vercel (frontend),
            Railway (backend), and Supabase (database). The migration is performed using an AI agent powered
            by Anthropic's Claude API.
          </p>

          <h2 style={s.h2}>2. Eligibility</h2>
          <p style={s.p}>
            You must be at least 18 years old and capable of entering into a binding contract to use {COMPANY_NAME}.
            By using the service you confirm that you meet these requirements.
          </p>

          <h2 style={s.h2}>3. Your Account</h2>
          <p style={s.p}>
            You are responsible for maintaining the confidentiality of your account credentials and for all
            activity that occurs under your account. You must notify us immediately at {CONTACT_EMAIL} if you
            suspect unauthorised access.
          </p>

          <h2 style={s.h2}>4. Payments</h2>
          <p style={s.p}>
            {COMPANY_NAME} charges a one-time fee per migration. Payments are processed securely by Stripe.
            You will be charged before the migration job begins.
          </p>
          <ul style={s.ul}>
            <li style={s.li}><strong>7-day money-back guarantee:</strong> If your migration has not yet started processing, you may request a full refund within 7 days of payment by emailing {CONTACT_EMAIL}.</li>
            <li style={s.li}><strong>No refunds after migration starts:</strong> Once the migration job is queued and processing has begun, the fee is non-refundable because compute, AI, and third-party API costs are incurred immediately.</li>
            <li style={s.li}>All prices are in US dollars unless stated otherwise.</li>
          </ul>

          <h2 style={s.h2}>5. Your Content and Credentials</h2>
          <p style={s.p}>
            You retain ownership of all code and data you provide to {COMPANY_NAME}. By using the service you
            grant us a limited, temporary licence to access, copy, and transform your code solely for the purpose
            of completing your migration.
          </p>
          <p style={s.p}>
            API keys and tokens you store in {COMPANY_NAME} (for Railway, Vercel, Supabase, GitHub, and Anthropic)
            are encrypted at rest using AES-256 encryption. We do not use your credentials for any purpose other
            than executing your migration.
          </p>

          <h2 style={s.h2}>6. Acceptable Use</h2>
          <p style={s.p}>You agree not to use {COMPANY_NAME} to:</p>
          <ul style={s.ul}>
            <li style={s.li}>Migrate applications that contain malware, illegal content, or material that infringes third-party rights</li>
            <li style={s.li}>Attempt to reverse-engineer, scrape, or abuse the platform's APIs</li>
            <li style={s.li}>Share your account with others or resell access to the service</li>
            <li style={s.li}>Circumvent any security or rate-limiting measures</li>
          </ul>

          <h2 style={s.h2}>7. Third-Party Services</h2>
          <p style={s.p}>
            {COMPANY_NAME} orchestrates deployments to third-party platforms including Vercel, Railway, Supabase,
            Stripe, GitHub, and Anthropic. Each platform has its own terms of service and privacy policy.
            {COMPANY_NAME} is not responsible for the availability, performance, or policies of these services.
            Your use of those platforms is governed by their respective terms.
          </p>

          <h2 style={s.h2}>8. Service Availability</h2>
          <p style={s.p}>
            We aim for high availability but do not guarantee uninterrupted service. We may suspend or discontinue
            the service at any time with reasonable notice. In the event of a planned shutdown we will provide at
            least 30 days' notice to registered users.
          </p>

          <h2 style={s.h2}>9. Disclaimer of Warranties</h2>
          <p style={s.p}>
            {COMPANY_NAME} is provided "as is" and "as available" without warranties of any kind, express or implied,
            including but not limited to warranties of merchantability, fitness for a particular purpose, or
            non-infringement. We do not warrant that the service will be error-free or that migrations will always
            succeed.
          </p>

          <h2 style={s.h2}>10. Limitation of Liability</h2>
          <p style={s.p}>
            To the maximum extent permitted by law, {COMPANY_NAME} shall not be liable for any indirect, incidental,
            special, consequential, or punitive damages, including loss of data, revenue, or profits, arising out
            of your use of or inability to use the service. Our total liability for any claim shall not exceed the
            amount you paid us in the 3 months preceding the claim.
          </p>

          <h2 style={s.h2}>11. Termination</h2>
          <p style={s.p}>
            You may delete your account at any time from the Settings page. We may terminate or suspend your account
            immediately if you breach these Terms. Upon termination, your right to use the service ceases and we will
            delete your stored credentials and personal data in accordance with our{' '}
            <Link href="/privacy" style={s.footLink}>Privacy Policy</Link>.
          </p>

          <h2 style={s.h2}>12. Changes to These Terms</h2>
          <p style={s.p}>
            We may update these Terms from time to time. We will notify you by email at least 14 days before
            material changes take effect. Continued use of the service after that date constitutes acceptance
            of the updated Terms.
          </p>

          <h2 style={s.h2}>13. Governing Law</h2>
          <p style={s.p}>
            These Terms are governed by the laws of {GOVERNING_LAW}. Any disputes shall be resolved in the courts
            of that jurisdiction.
          </p>

          <h2 style={s.h2}>14. Contact</h2>
          <p style={s.p}>
            For questions about these Terms please contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={s.footLink}>{CONTACT_EMAIL}</a>.
          </p>

          <div style={s.footer}>
            <span>© {new Date().getFullYear()} {COMPANY_NAME}</span>
            <Link href="/privacy" style={s.footLink}>Privacy Policy</Link>
            <Link href="/" style={s.footLink}>Home</Link>
          </div>
        </div>
      </div>
    </>
  );
}
