/**
 * frontend/components/Term.jsx
 * Reusable tooltip for every technical term across the frontend.
 * Usage: <Term id="supabase" /> or <Term id="supabase">Supabase</Term>
 */
import { useState } from 'react';

export const TERMS = {
  supabase: {
    label: 'Supabase',
    tip: 'Supabase is your app\'s database — it stores all your data (users, posts, orders, etc.) like a giant, always-on spreadsheet your app can read and write to.',
  },
  railway: {
    label: 'Railway',
    tip: 'Railway runs your app\'s backend — the invisible engine that handles logins, data processing, emails, and any logic that happens behind the scenes.',
  },
  vercel: {
    label: 'Vercel',
    tip: 'Vercel puts your app on the internet. When someone types your app\'s address into their browser, Vercel is what delivers it to them — instantly, from anywhere.',
  },
  anthropic: {
    label: 'Anthropic',
    tip: 'Anthropic is the company that makes Claude AI. We use it to read and understand your code so we can deploy it correctly.',
  },
  'api-key': {
    label: 'API Key',
    tip: 'An API key is a secret password that lets one service talk to another. Like a key card — it proves you\'re allowed in without sharing your actual password.',
  },
  'api-token': {
    label: 'API Token',
    tip: 'An API token is a secret code that proves your identity to a service. Like a temporary ID badge — it grants access without revealing your real password.',
  },
  websocket: {
    label: 'WebSocket',
    tip: 'A WebSocket is a live, open connection between your browser and the server — like a phone call that stays open so updates arrive instantly without refreshing the page.',
  },
  postgresql: {
    label: 'PostgreSQL',
    tip: 'PostgreSQL (or "Postgres") is a powerful database system. Think of it as a very organised filing cabinet that your app uses to store and look up information.',
  },
  database: {
    label: 'Database',
    tip: 'A database is where your app stores all its information — user accounts, messages, orders — so it\'s remembered even after you close the app.',
  },
  backend: {
    label: 'Backend',
    tip: 'The backend is the hidden part of your app — the code running on a server that handles logins, saves data, sends emails, and does the logic users never see.',
  },
  frontend: {
    label: 'Frontend',
    tip: 'The frontend is everything a user sees and clicks — the buttons, pages, and design of your app that live in the browser.',
  },
  github: {
    label: 'GitHub',
    tip: 'GitHub is where developers store and share code online. Think of it like Google Drive, but specifically for code — with version history built in.',
  },
  replit: {
    label: 'Replit',
    tip: 'Replit is an online coding environment where you can build and run apps directly in your browser — no installation needed.',
  },
  'aes-256': {
    label: 'AES-256',
    tip: 'AES-256 is military-grade encryption — the same standard used by banks and governments to scramble data so only authorised parties can read it.',
  },
  encryption: {
    label: 'Encryption',
    tip: 'Encryption scrambles your data into unreadable code. Only someone with the correct key can unscramble it — keeping your information safe even if intercepted.',
  },
  deployment: {
    label: 'Deployment',
    tip: 'Deployment is the process of taking your app from your computer and putting it live on the internet so anyone in the world can use it.',
  },
  migration: {
    label: 'Migration',
    tip: 'A migration moves your app from one place to another — for example, from a development environment to a live, publicly accessible server.',
  },
  '2fa': {
    label: 'Two-Factor Authentication (2FA)',
    tip: '2FA adds a second login step — after your password, you also enter a short code from your phone. Even if someone steals your password, they can\'t get in without your phone.',
  },
  totp: {
    label: 'TOTP',
    tip: 'TOTP (Time-based One-Time Password) is the 6-digit code your authenticator app generates. It changes every 30 seconds and can only be used once.',
  },
  'backup-codes': {
    label: 'Backup Codes',
    tip: 'Backup codes are one-time emergency passwords. If you lose your phone and can\'t get your 2FA code, you use one of these to get back into your account.',
  },
  stripe: {
    label: 'Stripe',
    tip: 'Stripe is the payment processor we use. Your card details go directly to Stripe — they never touch our servers, keeping your payment information safe.',
  },
  domain: {
    label: 'Domain',
    tip: 'A domain is your app\'s address on the internet — like "yourapp.com". You can buy one and point it at your deployed app so people can find it easily.',
  },
  branch: {
    label: 'Branch',
    tip: 'A branch is a separate version of your code. "main" is usually the live version. Branches let developers work on new features without breaking the working app.',
  },
  repo: {
    label: 'Repository (Repo)',
    tip: 'A repository (or "repo") is the folder on GitHub that holds all of your app\'s code, along with the full history of every change ever made.',
  },
  claude: {
    label: 'Claude',
    tip: 'Claude is an AI assistant made by Anthropic. We use it to read and understand your code, then figure out exactly how to deploy it correctly.',
  },
  'payment-intent': {
    label: 'Payment Intent',
    tip: 'A payment intent is a behind-the-scenes record that tracks a payment as it\'s being processed — it ensures the transaction is completed safely and exactly once.',
  },
  jwt: {
    label: 'JWT (JSON Web Token)',
    tip: 'A JWT is a tiny, tamper-proof ticket your app issues when you log in. Every request you make carries this ticket so the server knows who you are — no password re-entry needed.',
  },
};

export default function Term({ id, children }) {
  const [show, setShow] = useState(false);
  const term = TERMS[id];
  if (!term) return children || null;

  return (
    <span
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span style={{
        borderBottom: '1px dashed #D97706',
        cursor: 'help',
        color: 'inherit',
      }}>
        {children || term.label}
      </span>
      {show && (
        <span style={{
          position: 'absolute',
          bottom: 'calc(100% + 6px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#1A1814',
          color: '#fff',
          padding: '10px 14px',
          borderRadius: 8,
          fontSize: 12,
          lineHeight: 1.6,
          width: 240,
          zIndex: 9999,
          boxShadow: '0 4px 16px rgba(0,0,0,.25)',
          pointerEvents: 'none',
          whiteSpace: 'normal',
          textAlign: 'left',
          fontWeight: 400,
        }}>
          <strong style={{ display: 'block', marginBottom: 3, color: '#FCD34D' }}>{term.label}</strong>
          {term.tip}
        </span>
      )}
    </span>
  );
}
