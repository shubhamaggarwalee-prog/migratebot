/**
 * frontend/components/TokenWalkthrough.jsx
 *
 * Inline animated step-by-step visual walkthrough for each platform's
 * token/API key setup. Rendered inside PlatformGuide in migrate.jsx.
 *
 * Uses pure SVG + CSS — no external images, no GIFs, no CDN deps.
 * Each slide is a labelled screenshot mockup of the real UI with an
 * animated pulsing cursor showing exactly where to click.
 */
import { useState, useEffect } from 'react';

const C = {
  amber: '#D97706', amberBg: '#FEF3C7', amberDark: '#B45309',
  ink: '#1A1814', inkMid: '#5C574E', inkLight: '#9B958A',
  border: '#E5E2DA', surface: '#F8F7F4',
  green: '#059669', greenBg: '#D1FAE5',
  blue: '#2563EB', blueBg: '#DBEAFE',
  red: '#DC2626',
};

// ─── Shared SVG primitives ───────────────────────────────────────────────────

/** Animated pulsing click cursor */
function Cursor({ x, y, color = C.amber }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle r="12" fill={color} opacity="0.2">
        <animate attributeName="r" values="10;18;10" dur="1.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0;0.3" dur="1.4s" repeatCount="indefinite" />
      </circle>
      <circle r="5" fill={color} opacity="0.9" />
      {/* pointer arrow */}
      <polygon points="0,-8 5,0 2,0 2,8 -2,8 -2,0 -5,0" fill={color} opacity="0.85"
        transform="rotate(-30) translate(4,-2) scale(0.7)" />
    </g>
  );
}

/** Pill button mockup */
function PillBtn({ x, y, w = 110, h = 26, label, color = '#111', bg = '#F3F4F6', highlight }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={highlight ? C.amber : bg}
        stroke={highlight ? C.amberDark : '#D1D5DB'} strokeWidth="1.2" />
      <text x={x + w / 2} y={y + h / 2 + 4.5} textAnchor="middle"
        fontSize="10" fontWeight={highlight ? '700' : '500'}
        fill={highlight ? '#fff' : color} fontFamily="system-ui, sans-serif">
        {label}
      </text>
    </g>
  );
}

/** Top nav bar mockup */
function NavBar({ title, avatarLabel = 'You' }) {
  return (
    <g>
      <rect x="0" y="0" width="480" height="34" fill="#1A1A1A" />
      <text x="16" y="22" fontSize="11" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">{title}</text>
      <circle cx="454" cy="17" r="10" fill="#4B5563" />
      <text x="454" y="21" textAnchor="middle" fontSize="8" fill="#fff" fontFamily="system-ui, sans-serif">{avatarLabel[0]}</text>
    </g>
  );
}

/** Sidebar item */
function SidebarItem({ y, label, active }) {
  return (
    <g>
      {active && <rect x="0" y={y} width="120" height="26" fill={C.amberBg} />}
      {active && <rect x="0" y={y} width="3" height="26" fill={C.amber} />}
      <text x="14" y={y + 16} fontSize="10" fill={active ? C.amberDark : C.inkMid}
        fontWeight={active ? '700' : '400'} fontFamily="system-ui, sans-serif">{label}</text>
    </g>
  );
}

/** Input field mockup */
function InputField({ x, y, w = 260, h = 28, placeholder, highlight }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={5}
        fill="#fff" stroke={highlight ? C.amber : '#D1D5DB'} strokeWidth={highlight ? '2' : '1'} />
      <text x={x + 10} y={y + h / 2 + 4} fontSize="9.5" fill="#9CA3AF" fontFamily="monospace, sans-serif">{placeholder}</text>
    </g>
  );
}

// ─── ANTHROPIC slides ─────────────────────────────────────────────────────────
const ANTHROPIC_SLIDES = [
  {
    label: 'Go to console.anthropic.com',
    caption: 'Open your browser and go to console.anthropic.com. Click "Sign up" if you don\'t have an account.',
    render: () => (
      <svg viewBox="0 0 480 200" style={{ width: '100%', borderRadius: 8, border: `1px solid ${C.border}` }}>
        <rect width="480" height="200" fill="#F9FAFB" />
        {/* browser chrome */}
        <rect width="480" height="28" fill="#E5E7EB" />
        <rect x="80" y="6" width="320" height="16" rx="8" fill="#fff" stroke="#D1D5DB" strokeWidth="1" />
        <text x="240" y="18" textAnchor="middle" fontSize="8.5" fill="#6B7280" fontFamily="monospace">console.anthropic.com</text>
        {/* page */}
        <text x="240" y="80" textAnchor="middle" fontSize="18" fontWeight="700" fill={C.ink} fontFamily="Georgia, serif">Anthropic Console</text>
        <PillBtn x={155} y={100} w={170} h={30} label="Sign in / Create account" highlight />
        <Cursor x={240} y={115} />
      </svg>
    ),
  },
  {
    label: 'Click "API Keys" in the left menu',
    caption: 'After logging in, look at the left sidebar. Click "API Keys".',
    render: () => (
      <svg viewBox="0 0 480 200" style={{ width: '100%', borderRadius: 8, border: `1px solid ${C.border}` }}>
        <rect width="480" height="200" fill="#F9FAFB" />
        <NavBar title="Anthropic Console" />
        {/* sidebar */}
        <rect x="0" y="34" width="120" height="166" fill="#111" />
        <SidebarItem y={50}  label="Overview" />
        <SidebarItem y={78}  label="API Keys" active />
        <SidebarItem y={106} label="Usage" />
        <SidebarItem y={134} label="Settings" />
        {/* main */}
        <text x="180" y="80" fontSize="13" fontWeight="700" fill={C.ink} fontFamily="system-ui">API Keys</text>
        <Cursor x={62} y={91} />
      </svg>
    ),
  },
  {
    label: 'Click "Create Key"',
    caption: 'On the API Keys page, click the orange "Create Key" button in the top right.',
    render: () => (
      <svg viewBox="0 0 480 200" style={{ width: '100%', borderRadius: 8, border: `1px solid ${C.border}` }}>
        <rect width="480" height="200" fill="#F9FAFB" />
        <NavBar title="Anthropic Console" />
        <rect x="0" y="34" width="120" height="166" fill="#111" />
        <SidebarItem y={78} label="API Keys" active />
        <text x="155" y="68" fontSize="13" fontWeight="700" fill={C.ink} fontFamily="system-ui">API Keys</text>
        <PillBtn x={345} y={55} w={108} h={26} label="+ Create Key" highlight />
        {/* existing key row */}
        <rect x="132" y="90" width="330" height="34" rx="6" fill="#fff" stroke="#E5E7EB" strokeWidth="1" />
        <text x="145" y="111" fontSize="9" fill="#9CA3AF" fontFamily="monospace">sk-ant-api03-••••••••••••••••••</text>
        <Cursor x={399} y={68} />
      </svg>
    ),
  },
  {
    label: 'Name it "MigrateBot" and copy the key',
    caption: 'Type "MigrateBot" as the name. The key starts with sk-ant-… — copy it and paste it into MigrateBot.',
    render: () => (
      <svg viewBox="0 0 480 200" style={{ width: '100%', borderRadius: 8, border: `1px solid ${C.border}` }}>
        <rect width="480" height="200" fill="rgba(0,0,0,0.4)" />
        {/* modal */}
        <rect x="100" y="30" width="280" height="150" rx="10" fill="#fff" stroke="#E5E7EB" strokeWidth="1.5" />
        <text x="240" y="60" textAnchor="middle" fontSize="13" fontWeight="700" fill={C.ink} fontFamily="system-ui">Create API Key</text>
        <text x="116" y="88" fontSize="10" fill={C.inkMid} fontFamily="system-ui">Key name</text>
        <InputField x={116} y={94} w={248} h={26} placeholder="MigrateBot" highlight />
        {/* key preview */}
        <rect x="116" y="134" width="248" height="26" rx="5" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="1" />
        <text x="126" y="151" fontSize="9" fill={C.green} fontFamily="monospace" fontWeight="700">sk-ant-api03-AbCdEfGh…</text>
        <PillBtn x={116} y={168} w={80} h={22} label="Copy key" highlight />
        <Cursor x={170} y={180} />
      </svg>
    ),
  },
];

// ─── SUPABASE slides ──────────────────────────────────────────────────────────
const SUPABASE_SLIDES = [
  {
    label: 'Go to app.supabase.com',
    caption: 'Open app.supabase.com in your browser and sign up or log in.',
    render: () => (
      <svg viewBox="0 0 480 200" style={{ width: '100%', borderRadius: 8, border: `1px solid ${C.border}` }}>
        <rect width="480" height="200" fill="#F9FAFB" />
        <rect width="480" height="28" fill="#E5E7EB" />
        <rect x="80" y="6" width="320" height="16" rx="8" fill="#fff" stroke="#D1D5DB" strokeWidth="1" />
        <text x="240" y="18" textAnchor="middle" fontSize="8.5" fill="#6B7280" fontFamily="monospace">app.supabase.com</text>
        <text x="240" y="75" textAnchor="middle" fontSize="17" fontWeight="700" fill="#1F2937" fontFamily="Georgia, serif">Supabase</text>
        <text x="240" y="96" textAnchor="middle" fontSize="10" fill={C.inkMid} fontFamily="system-ui">Build in a weekend. Scale to millions.</text>
        <PillBtn x={160} y={112} w={160} h={28} label="Start your project" highlight />
        <Cursor x={240} y={126} />
      </svg>
    ),
  },
  {
    label: 'Open Account Settings',
    caption: 'After logging in, click your profile picture or avatar in the top-right corner, then click "Account Settings".',
    render: () => (
      <svg viewBox="0 0 480 200" style={{ width: '100%', borderRadius: 8, border: `1px solid ${C.border}` }}>
        <rect width="480" height="200" fill="#F9FAFB" />
        <rect width="480" height="44" fill="#1C1C1C" />
        <text x="20" y="27" fontSize="13" fontWeight="700" fill="#3ECF8E" fontFamily="system-ui">Supabase</text>
        {/* avatar dropdown */}
        <circle cx="452" cy="22" r="12" fill="#3ECF8E" />
        <text x="452" y="26" textAnchor="middle" fontSize="9" fill="#fff" fontFamily="system-ui">You</text>
        {/* dropdown menu */}
        <rect x="360" y="44" width="110" height="80" rx="6" fill="#fff" stroke="#E5E7EB" strokeWidth="1" />
        <text x="370" y="64" fontSize="9.5" fill={C.ink} fontFamily="system-ui">Profile</text>
        <rect x="360" y="70" width="110" height="24" rx="0" fill={C.amberBg} />
        <text x="370" y="86" fontSize="9.5" fill={C.amberDark} fontWeight="700" fontFamily="system-ui">Account Settings</text>
        <text x="370" y="108" fontSize="9.5" fill={C.ink} fontFamily="system-ui">Sign out</text>
        <Cursor x={415} y={82} />
      </svg>
    ),
  },
  {
    label: 'Go to Access Tokens',
    caption: 'Inside Account Settings, click "Access Tokens" in the left menu.',
    render: () => (
      <svg viewBox="0 0 480 200" style={{ width: '100%', borderRadius: 8, border: `1px solid ${C.border}` }}>
        <rect width="480" height="200" fill="#F9FAFB" />
        <NavBar title="Supabase — Account Settings" />
        <rect x="0" y="34" width="130" height="166" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="1" />
        <SidebarItem y={50}  label="Profile" />
        <SidebarItem y={78}  label="Access Tokens" active />
        <SidebarItem y={106} label="Security" />
        <text x="160" y="80" fontSize="13" fontWeight="700" fill={C.ink} fontFamily="system-ui">Access Tokens</text>
        <Cursor x={65} y={91} />
      </svg>
    ),
  },
  {
    label: 'Generate new token',
    caption: 'Click "Generate new token", name it "MigrateBot", then copy the token that appears.',
    render: () => (
      <svg viewBox="0 0 480 200" style={{ width: '100%', borderRadius: 8, border: `1px solid ${C.border}` }}>
        <rect width="480" height="200" fill="#F9FAFB" />
        <NavBar title="Supabase — Access Tokens" />
        <text x="20" y="65" fontSize="12" fontWeight="700" fill={C.ink} fontFamily="system-ui">Access Tokens</text>
        <text x="20" y="82" fontSize="9.5" fill={C.inkMid} fontFamily="system-ui">Tokens have full access to your account</text>
        <PillBtn x={330} y={52} w={130} h={26} label="+ Generate new token" highlight />
        {/* token name input area */}
        <rect x="20" y="98" width="440" height="60" rx="8" fill="#fff" stroke={C.amber} strokeWidth="1.5" />
        <text x="32" y="116" fontSize="9" fill={C.inkMid} fontFamily="system-ui">Token name</text>
        <InputField x={30} y={120} w={200} h={24} placeholder="MigrateBot" highlight />
        <PillBtn x={246} y={120} w={80} h={24} label="Generate" highlight />
        <Cursor x={286} y={132} />
      </svg>
    ),
  },
];

// ─── VERCEL slides ────────────────────────────────────────────────────────────
const VERCEL_SLIDES = [
  {
    label: 'Go to vercel.com/account/tokens',
    caption: 'Open vercel.com in your browser. Sign up for free if you don\'t have an account yet.',
    render: () => (
      <svg viewBox="0 0 480 200" style={{ width: '100%', borderRadius: 8, border: `1px solid ${C.border}` }}>
        <rect width="480" height="200" fill="#000" />
        <rect width="480" height="28" fill="#111" />
        <rect x="80" y="6" width="320" height="16" rx="8" fill="#1A1A1A" stroke="#333" strokeWidth="1" />
        <text x="240" y="18" textAnchor="middle" fontSize="8.5" fill="#9CA3AF" fontFamily="monospace">vercel.com</text>
        {/* vercel logo */}
        <polygon points="240,60 260,90 220,90" fill="#fff" />
        <text x="240" y="115" textAnchor="middle" fontSize="16" fontWeight="700" fill="#fff" fontFamily="system-ui">Vercel</text>
        <PillBtn x={165} y={128} w={150} h={28} label="Start Deploying" bg="#fff" color="#000" highlight />
        <Cursor x={240} y={142} color="#fff" />
      </svg>
    ),
  },
  {
    label: 'Open Account Settings',
    caption: 'Click your profile avatar or name in the top-right, then select "Settings".',
    render: () => (
      <svg viewBox="0 0 480 200" style={{ width: '100%', borderRadius: 8, border: `1px solid ${C.border}` }}>
        <rect width="480" height="200" fill="#000" />
        <rect width="480" height="44" fill="#111" stroke="#222" strokeWidth="1" />
        <polygon points="22,12 32,30 12,30" fill="#fff" />
        <text x="42" y="27" fontSize="12" fontWeight="700" fill="#fff" fontFamily="system-ui">Vercel</text>
        <circle cx="452" cy="22" r="12" fill="#333" />
        <text x="452" y="26" textAnchor="middle" fontSize="9" fill="#fff" fontFamily="system-ui">You</text>
        {/* dropdown */}
        <rect x="360" y="44" width="110" height="82" rx="6" fill="#1A1A1A" stroke="#333" strokeWidth="1" />
        <text x="370" y="64" fontSize="9.5" fill="#9CA3AF" fontFamily="system-ui">Dashboard</text>
        <rect x="360" y="70" width="110" height="24" rx="0" fill="#292929" />
        <text x="370" y="86" fontSize="9.5" fill="#fff" fontWeight="700" fontFamily="system-ui">Settings</text>
        <text x="370" y="110" fontSize="9.5" fill="#9CA3AF" fontFamily="system-ui">Log out</text>
        <Cursor x={415} y={82} color="#fff" />
      </svg>
    ),
  },
  {
    label: 'Click "Tokens" in the sidebar',
    caption: 'In Account Settings, scroll down the left sidebar and click "Tokens".',
    render: () => (
      <svg viewBox="0 0 480 200" style={{ width: '100%', borderRadius: 8, border: `1px solid ${C.border}` }}>
        <rect width="480" height="200" fill="#000" />
        <rect width="480" height="34" fill="#111" />
        <text x="16" y="22" fontSize="11" fontWeight="700" fill="#fff" fontFamily="system-ui">Vercel — Account Settings</text>
        <rect x="0" y="34" width="130" height="166" fill="#111" stroke="#222" strokeWidth="1" />
        <text x="14" y="58" fontSize="10" fill="#9CA3AF" fontFamily="system-ui">General</text>
        <text x="14" y="82" fontSize="10" fill="#9CA3AF" fontFamily="system-ui">Billing</text>
        <rect x="0" y="92" width="130" height="24" fill="#1F1F1F" />
        <rect x="0" y="92" width="3" height="24" fill={C.amber} />
        <text x="14" y="108" fontSize="10" fill="#fff" fontWeight="700" fontFamily="system-ui">Tokens</text>
        <text x="14" y="132" fontSize="10" fill="#9CA3AF" fontFamily="system-ui">Security</text>
        <text x="150" y="75" fontSize="12" fontWeight="700" fill="#fff" fontFamily="system-ui">Tokens</text>
        <Cursor x={65} y={104} color="#fff" />
      </svg>
    ),
  },
  {
    label: 'Create a token named "MigrateBot"',
    caption: 'Click "Create", enter "MigrateBot" as the name, set scope to "Full Account", then copy the token.',
    render: () => (
      <svg viewBox="0 0 480 200" style={{ width: '100%', borderRadius: 8, border: `1px solid ${C.border}` }}>
        <rect width="480" height="200" fill="#000" />
        <rect width="480" height="34" fill="#111" />
        <text x="16" y="22" fontSize="11" fontWeight="700" fill="#fff" fontFamily="system-ui">Vercel — Tokens</text>
        <rect x="20" y="50" width="440" height="120" rx="8" fill="#111" stroke="#333" strokeWidth="1" />
        <text x="32" y="76" fontSize="10" fill="#9CA3AF" fontFamily="system-ui">Token name</text>
        <rect x="32" y="82" width="200" height="24" rx="5" fill="#1F1F1F" stroke={C.amber} strokeWidth="1.5" />
        <text x="42" y="98" fontSize="9" fill="#6B7280" fontFamily="monospace">MigrateBot</text>
        <text x="32" y="124" fontSize="10" fill="#9CA3AF" fontFamily="system-ui">Scope</text>
        <rect x="32" y="130" width="140" height="22" rx="5" fill="#1F1F1F" stroke="#444" strokeWidth="1" />
        <text x="42" y="145" fontSize="9" fill="#fff" fontFamily="system-ui">Full Account</text>
        <rect x="184" y="130" width="80" height="22" rx="5" fill={C.amber} />
        <text x="224" y="145" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#fff" fontFamily="system-ui">Create</text>
        <Cursor x={224} y={141} color="#fff" />
      </svg>
    ),
  },
];

// ─── RAILWAY slides ───────────────────────────────────────────────────────────
const RAILWAY_SLIDES = [
  {
    label: 'Go to railway.app',
    caption: 'Open railway.app in your browser and create a free account.',
    render: () => (
      <svg viewBox="0 0 480 200" style={{ width: '100%', borderRadius: 8, border: `1px solid ${C.border}` }}>
        <rect width="480" height="200" fill="#0B0D0E" />
        <rect width="480" height="28" fill="#131517" />
        <rect x="80" y="6" width="320" height="16" rx="8" fill="#1C1E20" stroke="#333" strokeWidth="1" />
        <text x="240" y="18" textAnchor="middle" fontSize="8.5" fill="#9CA3AF" fontFamily="monospace">railway.app</text>
        <text x="240" y="82" textAnchor="middle" fontSize="17" fontWeight="700" fill="#fff" fontFamily="Georgia, serif">Railway</text>
        <text x="240" y="100" textAnchor="middle" fontSize="10" fill="#9CA3AF" fontFamily="system-ui">Bring your code, we'll handle the rest</text>
        <PillBtn x={170} y={116} w={140} h={28} label="Start a New Project" bg="#7C3AED" color="#fff" highlight />
        <Cursor x={240} y={130} />
      </svg>
    ),
  },
  {
    label: 'Click your profile picture',
    caption: 'After logging in, click your profile avatar in the top-right corner of the dashboard.',
    render: () => (
      <svg viewBox="0 0 480 200" style={{ width: '100%', borderRadius: 8, border: `1px solid ${C.border}` }}>
        <rect width="480" height="200" fill="#0B0D0E" />
        <rect width="480" height="44" fill="#131517" stroke="#222" strokeWidth="1" />
        <text x="20" y="27" fontSize="13" fontWeight="700" fill="#fff" fontFamily="system-ui">Railway</text>
        <circle cx="452" cy="22" r="12" fill="#7C3AED" />
        <text x="452" y="26" textAnchor="middle" fontSize="9" fill="#fff" fontFamily="system-ui">You</text>
        {/* dropdown */}
        <rect x="360" y="44" width="116" height="90" rx="6" fill="#1C1E20" stroke="#333" strokeWidth="1" />
        <text x="372" y="64" fontSize="9.5" fill="#9CA3AF" fontFamily="system-ui">Dashboard</text>
        <rect x="360" y="70" width="116" height="24" rx="0" fill="#252729" />
        <text x="372" y="86" fontSize="9.5" fill="#fff" fontWeight="700" fontFamily="system-ui">Account Settings</text>
        <text x="372" y="110" fontSize="9.5" fill="#9CA3AF" fontFamily="system-ui">Log out</text>
        <Cursor x={418} y={82} color="#A78BFA" />
      </svg>
    ),
  },
  {
    label: 'Go to Tokens tab',
    caption: 'Inside Account Settings, click the "Tokens" tab.',
    render: () => (
      <svg viewBox="0 0 480 200" style={{ width: '100%', borderRadius: 8, border: `1px solid ${C.border}` }}>
        <rect width="480" height="200" fill="#0B0D0E" />
        <rect width="480" height="34" fill="#131517" />
        <text x="16" y="22" fontSize="11" fontWeight="700" fill="#fff" fontFamily="system-ui">Account Settings</text>
        {/* tab bar */}
        <rect x="0" y="34" width="480" height="32" fill="#131517" stroke="#222" strokeWidth="1" />
        <text x="20" y="54" fontSize="10" fill="#6B7280" fontFamily="system-ui">General</text>
        <rect x="70" y="34" width="56" height="32" fill="#131517" />
        <rect x="70" y="62" width="56" height="2" fill={C.amber} />
        <text x="98" y="54" textAnchor="middle" fontSize="10" fill="#fff" fontWeight="700" fontFamily="system-ui">Tokens</text>
        <text x="140" y="54" fontSize="10" fill="#6B7280" fontFamily="system-ui">Connected Apps</text>
        <text x="150" y="110" fontSize="12" fontWeight="700" fill="#fff" fontFamily="system-ui">API Tokens</text>
        <Cursor x={98} y={52} color="#A78BFA" />
      </svg>
    ),
  },
  {
    label: 'Create a new token',
    caption: 'Click "Create Token", give it the name "MigrateBot", then copy the token that appears.',
    render: () => (
      <svg viewBox="0 0 480 200" style={{ width: '100%', borderRadius: 8, border: `1px solid ${C.border}` }}>
        <rect width="480" height="200" fill="#0B0D0E" />
        <rect width="480" height="34" fill="#131517" />
        <text x="16" y="22" fontSize="11" fontWeight="700" fill="#fff" fontFamily="system-ui">Account Settings — Tokens</text>
        <PillBtn x={330} y={48} w={120} h={26} label="+ Create Token" bg="#7C3AED" color="#fff" highlight />
        {/* modal */}
        <rect x="80" y="80" width="320" height="100" rx="8" fill="#1C1E20" stroke="#333" strokeWidth="1.5" />
        <text x="240" y="104" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily="system-ui">New API Token</text>
        <text x="96" y="124" fontSize="9" fill="#9CA3AF" fontFamily="system-ui">Name</text>
        <rect x="96" y="130" width="180" height="22" rx="5" fill="#252729" stroke={C.amber} strokeWidth="1.5" />
        <text x="106" y="145" fontSize="9" fill="#6B7280" fontFamily="monospace">MigrateBot</text>
        <rect x="286" y="130" width="98" height="22" rx="5" fill="#7C3AED" />
        <text x="335" y="145" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#fff" fontFamily="system-ui">Create Token</text>
        <Cursor x={335} y={141} color="#A78BFA" />
      </svg>
    ),
  },
];

// ─── Slides map ───────────────────────────────────────────────────────────────
const SLIDES = {
  anthropic: ANTHROPIC_SLIDES,
  supabase:  SUPABASE_SLIDES,
  vercel:    VERCEL_SLIDES,
  railway:   RAILWAY_SLIDES,
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function TokenWalkthrough({ platformId }) {
  const slides = SLIDES[platformId];
  if (!slides) return null;

  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);

  // Auto-advance every 3.5 seconds when playing
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setCurrent(c => (c + 1) % slides.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [playing, slides.length]);

  const slide = slides[current];

  return (
    <div style={{
      background: C.surface,
      border: `1.5px solid ${C.border}`,
      borderRadius: 12,
      padding: '14px',
      marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.amberDark, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🎬</span> Visual guide — follow along
        </div>
        <button
          onClick={() => setPlaying(p => !p)}
          style={{
            fontSize: 11, color: C.inkMid, background: '#fff',
            border: `1px solid ${C.border}`, borderRadius: 6,
            padding: '3px 10px', cursor: 'pointer',
          }}
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
      </div>

      {/* Slide visual */}
      <div style={{ marginBottom: 10, position: 'relative' }}>
        {slide.render()}
      </div>

      {/* Step label */}
      <div style={{
        background: C.amberBg, borderRadius: 8,
        padding: '8px 12px', marginBottom: 10,
        display: 'flex', alignItems: 'flex-start', gap: 8,
      }}>
        <div style={{
          background: C.amber, color: '#fff',
          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
          fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{current + 1}</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.amberDark }}>{slide.label}</div>
          <div style={{ fontSize: 11, color: C.inkMid, marginTop: 2, lineHeight: 1.5 }}>{slide.caption}</div>
        </div>
      </div>

      {/* Dot navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <button
          onClick={() => { setCurrent(c => Math.max(0, c - 1)); setPlaying(false); }}
          disabled={current === 0}
          style={{
            background: 'none', border: 'none', cursor: current === 0 ? 'default' : 'pointer',
            color: current === 0 ? C.border : C.amber, fontSize: 16, padding: '0 4px',
          }}
        >‹</button>

        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => { setCurrent(i); setPlaying(false); }}
            style={{
              width: i === current ? 20 : 8,
              height: 8, borderRadius: 4,
              background: i === current ? C.amber : C.border,
              border: 'none', cursor: 'pointer', padding: 0,
              transition: 'all .25s',
            }}
          />
        ))}

        <button
          onClick={() => { setCurrent(c => Math.min(slides.length - 1, c + 1)); setPlaying(false); }}
          disabled={current === slides.length - 1}
          style={{
            background: 'none', border: 'none',
            cursor: current === slides.length - 1 ? 'default' : 'pointer',
            color: current === slides.length - 1 ? C.border : C.amber, fontSize: 16, padding: '0 4px',
          }}
        >›</button>
      </div>

      <div style={{ fontSize: 10, color: C.inkLight, textAlign: 'center', marginTop: 6 }}>
        Step {current + 1} of {slides.length} · Click ‹ › to navigate or pause to stop auto-play
      </div>
    </div>
  );
}
