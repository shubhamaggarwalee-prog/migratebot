/**
 * frontend/components/HealthWidget.jsx
 *
 * Shows a health status indicator for a deployed migration:
 *   • Green dot   = app is responding
 *   • Red dot     = app is down
 *   • Grey dot    = not yet checked / unknown
 *
 * Behaviour:
 *   - Fetches health on first mount.
 *   - Auto-refreshes every 5 minutes (300 000 ms).
 *   - User can also force-refresh via the ⟳ button.
 *   - If the app is down, shows a plain-English explanation
 *     and a one-click "Restart My App" button.
 *   - All network activity is shown with clear loading states.
 *
 * Props:
 *   migration  — full migration object from useMigrations()
 */
import { useState, useEffect, useRef, useCallback } from 'react';

const C = {
  amber: '#D97706', amberBg: '#FEF3C7', amberDark: '#B45309',
  ink: '#1A1814', inkMid: '#5C574E', inkLight: '#9B958A',
  border: '#E5E2DA', surface: '#F8F7F4',
  green: '#059669', greenBg: '#D1FAE5',
  red: '#DC2626',   redBg: '#FEE2E2',
};

const REFRESH_MS = 5 * 60 * 1000; // 5 minutes

function apiBase() { return process.env.NEXT_PUBLIC_API_URL || ''; }
function authHeader() {
  return { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('mb_token') : ''}` };
}

/** Animated pulsing dot */
function Dot({ status }) {
  const color = status === 'up' ? C.green : status === 'down' ? C.red : C.inkLight;
  const pulse = status === 'up' || status === 'down';
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, flexShrink: 0 }}>
      {pulse && (
        <span style={{
          position: 'absolute', width: 14, height: 14, borderRadius: '50%',
          background: color, opacity: 0.3,
          animation: 'mb-ping 2s cubic-bezier(0,0,.2,1) infinite',
        }} />
      )}
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'block', position: 'relative' }} />
      <style>{`
        @keyframes mb-ping {
          75%, 100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
    </span>
  );
}

/** Human-readable "last checked" label */
function lastCheckedLabel(isoDate) {
  if (!isoDate) return 'Not checked yet';
  const diff = Math.round((Date.now() - new Date(isoDate)) / 1000);
  if (diff < 60)  return `Checked ${diff}s ago`;
  if (diff < 3600) return `Checked ${Math.round(diff / 60)}m ago`;
  return `Checked at ${new Date(isoDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default function HealthWidget({ migration }) {
  const [health,      setHealth]      = useState(null);   // API response
  const [checking,    setChecking]    = useState(false);
  const [restarting,  setRestarting]  = useState(false);
  const [restartMsg,  setRestartMsg]  = useState('');
  const [error,       setError]       = useState('');
  const timerRef = useRef(null);

  const check = useCallback(async (silent = false) => {
    if (!silent) setChecking(true);
    setError('');
    try {
      const res  = await fetch(`${apiBase()}/api/app-health/${migration.id}`, { headers: authHeader() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Health check failed.');
      setHealth(data);
    } catch (e) {
      setError(e.message);
    } finally {
      if (!silent) setChecking(false);
    }
  }, [migration.id]);

  // Initial check + auto-refresh every 5 min
  useEffect(() => {
    check(true);
    timerRef.current = setInterval(() => check(true), REFRESH_MS);
    return () => clearInterval(timerRef.current);
  }, [check]);

  const handleRestart = async () => {
    setRestarting(true);
    setRestartMsg('');
    setError('');
    try {
      const res  = await fetch(`${apiBase()}/api/app-health/${migration.id}/restart`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Restart failed.');
      setRestartMsg(data.message);
      // Re-check after 90 s to update the dot
      setTimeout(() => check(true), 90_000);
    } catch (e) {
      setError(e.message);
    } finally {
      setRestarting(false);
    }
  };

  // Don't render for non-deployed migrations
  if (migration.status !== 'complete') return null;

  const status     = health?.status || 'unknown';
  const isDown     = status === 'down';
  const isUp       = status === 'up';
  const isUnknown  = status === 'unknown' || status === 'not_deployed';

  const borderColor = isUp ? C.green : isDown ? C.red : C.border;
  const bgColor     = isUp ? C.greenBg : isDown ? C.redBg : C.surface;

  return (
    <div style={{
      border: `1.5px solid ${borderColor}`,
      borderRadius: 12,
      background: bgColor,
      padding: '14px 16px',
      marginBottom: 16,
      transition: 'all .3s',
    }}>
      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Dot status={status} />

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>
            {isUp      && 'Your app is online ✅'}
            {isDown    && 'Your app appears to be down ⚠️'}
            {isUnknown && 'Checking your app…'}
          </div>
          <div style={{ fontSize: 11, color: C.inkMid, marginTop: 2 }}>
            {lastCheckedLabel(health?.checkedAt)}
            {health?.latencyMs && isUp && (
              <span style={{ marginLeft: 8, color: health.latencyMs < 500 ? C.green : C.amber }}>
                {health.latencyMs}ms
              </span>
            )}
          </div>
        </div>

        {/* Manual refresh button */}
        <button
          onClick={() => check(false)}
          disabled={checking}
          title="Check now"
          style={{
            width: 30, height: 30, borderRadius: '50%',
            border: `1px solid ${C.border}`, background: '#fff',
            cursor: checking ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: checking ? C.inkLight : C.inkMid,
            flexShrink: 0, transition: 'all .15s',
            animation: checking ? 'mb-spin .8s linear infinite' : 'none',
          }}
        >
          ⟳
          <style>{`@keyframes mb-spin { to { transform: rotate(360deg); } }`}</style>
        </button>
      </div>

      {/* ── Down state ── */}
      {isDown && !restartMsg && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.6, marginBottom: 12 }}>
            <strong style={{ color: C.red }}>What does this mean?</strong>{' '}
            Your app isn’t responding right now — visitors trying to open it would see an error page.
            This can happen if Vercel paused it due to inactivity, a recent code change caused a crash,
            or there was a temporary outage. <strong>Click below to restart it.</strong>
          </p>
          <button
            onClick={handleRestart}
            disabled={restarting}
            style={{
              width: '100%', padding: '11px',
              background: restarting ? C.inkLight : C.red,
              color: '#fff', border: 'none', borderRadius: 8,
              fontWeight: 700, fontSize: 14, cursor: restarting ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background .15s',
            }}
          >
            {restarting
              ? <><span style={{ animation: 'mb-spin .8s linear infinite', display: 'inline-block' }}>⟳</span> Restarting…</>
              : <>🔄 Restart My App</>}
          </button>
        </div>
      )}

      {/* ── Restart success message ── */}
      {restartMsg && (
        <div style={{ marginTop: 10, padding: '10px 12px', background: C.amberBg, border: `1px solid ${C.amber}44`, borderRadius: 8 }}>
          <div style={{ fontSize: 13, color: C.amberDark, fontWeight: 600 }}>⏳ {restartMsg}</div>
          <div style={{ fontSize: 11, color: C.inkMid, marginTop: 4 }}>We’ll automatically re-check in 90 seconds.</div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div style={{ marginTop: 10, fontSize: 12, color: C.red }}>{error}</div>
      )}

      {/* ── Up state: latency bar ── */}
      {isUp && health?.latencyMs && (
        <div style={{ marginTop: 10 }}>
          <div style={{ height: 3, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width : `${Math.min(100, (health.latencyMs / 2000) * 100)}%`,
              background: health.latencyMs < 500 ? C.green : health.latencyMs < 1200 ? C.amber : C.red,
              borderRadius: 2, transition: 'width .4s',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
            <span style={{ fontSize: 10, color: C.inkLight }}>Response time</span>
            <span style={{ fontSize: 10, color: health.latencyMs < 500 ? C.green : C.amber }}>
              {health.latencyMs < 500 ? 'Fast ✓' : health.latencyMs < 1200 ? 'Moderate' : 'Slow'}
            </span>
          </div>
        </div>
      )}

      {/* ── Footer: next auto-check ── */}
      <div style={{ marginTop: 10, fontSize: 10, color: C.inkLight, textAlign: 'right' }}>
        Auto-checks every 5 minutes
      </div>
    </div>
  );
}
