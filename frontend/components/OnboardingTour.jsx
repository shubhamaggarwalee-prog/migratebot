/**
 * frontend/components/OnboardingTour.jsx
 * G1: First-time user onboarding tour shown on the dashboard.
 *
 * - Renders a spotlight overlay highlighting 4 key dashboard areas one by one
 * - Tooltip with progress dots, next/skip controls
 * - Persisted to localStorage — never shows again after completion or skip
 * - Safe for SSR (all window references are guarded)
 */
import { useState, useEffect } from 'react';

const TOUR_KEY = 'mb_tour_done';

const STEPS = [
  {
    id:       'new-migration',
    title:    '🚀 Deploy your first app',
    body:     "Click here to start the 5-step wizard. It takes about 5 minutes and you don't need any technical knowledge.",
    anchor:   'tour-new-migration',
    position: 'below',
  },
  {
    id:       'stats',
    title:    '📊 Your migration stats',
    body:     'This row shows how many deployments you have — total, live, in progress, or failed.',
    anchor:   'tour-stats',
    position: 'below',
  },
  {
    id:       'migrations-list',
    title:    '📋 Your migrations list',
    body:     "Every app you've deployed appears here. Click any row to see full logs, live URLs, and the AI health report.",
    anchor:   'tour-migrations-list',
    position: 'above',
  },
  {
    id:       'settings',
    title:    '⚙️ Settings & API keys',
    body:     'Head here to update your API keys, enable two-factor login, or manage notification preferences.',
    anchor:   'tour-settings',
    position: 'below',
  },
];

const C = {
  amber: '#D97706', amberBg: '#FEF3C7', amberDark: '#B45309',
  ink: '#1A1814', inkMid: '#5C574E', border: '#E5E2DA',
};

export default function OnboardingTour() {
  const [stepIndex, setStepIndex] = useState(0);
  const [visible,   setVisible]   = useState(false);
  const [box,       setBox]       = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem(TOUR_KEY)) {
      const t = setTimeout(() => setVisible(true), 900);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const step = STEPS[stepIndex];
    const el   = document.getElementById(step.anchor);
    if (el) {
      const rect = el.getBoundingClientRect();
      setBox({
        top:    rect.top    + window.scrollY,
        left:   rect.left   + window.scrollX,
        width:  rect.width,
        height: rect.height,
      });
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [stepIndex, visible]);

  const dismiss = () => {
    if (typeof window !== 'undefined') localStorage.setItem(TOUR_KEY, '1');
    setVisible(false);
  };

  const next = () => {
    if (stepIndex < STEPS.length - 1) setStepIndex(i => i + 1);
    else dismiss();
  };

  if (!visible || !box) return null;

  const step      = STEPS[stepIndex];
  const isLast    = stepIndex === STEPS.length - 1;
  const SP        = 8;
  const TW        = 300;
  const vpW       = typeof window !== 'undefined' ? window.innerWidth  : 1200;
  const scrollY   = typeof window !== 'undefined' ? window.scrollY : 0;
  const scrollX   = typeof window !== 'undefined' ? window.scrollX : 0;

  const tooltipTop = step.position === 'below'
    ? box.top + box.height + SP + 12 - scrollY
    : box.top - SP - 160 - scrollY;

  const tooltipLeft = Math.max(12, Math.min(box.left + box.width / 2 - TW / 2 - scrollX, vpW - TW - 12));

  return (
    <>
      {/* Overlay */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(26,24,20,0.6)', pointerEvents: 'none' }} />

      {/* Spotlight ring around the anchor element */}
      <div
        style={{
          position:   'fixed',
          top:        box.top    - SP - scrollY,
          left:       box.left   - SP - scrollX,
          width:      box.width  + SP * 2,
          height:     box.height + SP * 2,
          zIndex:     9001,
          borderRadius: 10,
          boxShadow:  `0 0 0 9999px rgba(26,24,20,0.6)`,
          border:     `2.5px solid ${C.amber}`,
          pointerEvents: 'none',
          transition: 'all 0.3s ease',
        }}
      />

      {/* Tooltip */}
      <div
        style={{
          position:     'fixed',
          top:          tooltipTop,
          left:         tooltipLeft,
          width:        TW,
          zIndex:       9002,
          background:   '#fff',
          borderRadius: 14,
          boxShadow:    '0 8px 32px rgba(0,0,0,0.2)',
          padding:      '18px 20px',
          border:       `1.5px solid ${C.amber}`,
          transition:   'all 0.3s ease',
        }}
      >
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width:      i === stepIndex ? 18 : 7,
              height:     7,
              borderRadius: 4,
              background: i === stepIndex ? C.amber : C.border,
              transition: 'width 0.25s',
            }} />
          ))}
        </div>

        <div style={{ fontWeight: 700, fontSize: 15, color: C.ink, marginBottom: 6 }}>{step.title}</div>
        <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.6, marginBottom: 16 }}>{step.body}</div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={dismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.inkMid, textDecoration: 'underline' }}>Skip tour</button>
          <button onClick={next} style={{ padding: '8px 20px', background: C.amber, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 3px 10px rgba(217,119,6,.25)' }}>
            {isLast ? 'Done ✓' : 'Next →'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: C.inkMid, textAlign: 'center', marginTop: 10 }}>
          {stepIndex + 1} of {STEPS.length}
        </div>
      </div>
    </>
  );
}

// Dev helper — call resetTour() in the browser console to replay the tour
if (typeof window !== 'undefined') {
  window.resetTour = () => { localStorage.removeItem(TOUR_KEY); window.location.reload(); };
}
