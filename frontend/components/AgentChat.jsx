/**
 * frontend/components/AgentChat.jsx
 *
 * Task 19: Mid-migration agent chat modal.
 *
 * Listens for the `agent:chat-needed` socket event emitted by migrationRunner
 * when a deployment step fails and the agent needs user input.
 *
 * Renders as a full-screen overlay with a chat interface. Sends messages to
 * POST /api/agent/chat. Closes automatically when the agent returns
 * resolved=true or the user chooses to skip the step.
 *
 * Uses the same `useMigrationSocket` hook and design system (C palette)
 * already used in migrate.jsx — no new dependencies.
 */
import { useState, useEffect, useRef } from 'react';
import { useMigrationSocket } from '../hooks/useSocket';

const C = {
  amber: '#D97706', amberBg: '#FEF3C7', amberDark: '#B45309',
  ink: '#1A1814', inkMid: '#5C574E', inkLight: '#9B958A',
  border: '#E5E2DA', surface: '#F8F7F4',
  green: '#059669', greenBg: '#D1FAE5',
  red: '#DC2626', redBg: '#FEE2E2',
};

export default function AgentChat({ migrationId }) {
  const socket = useMigrationSocket(migrationId);

  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState([]);   // [{ role: 'agent'|'user', content: string }]
  const [input,    setInput]    = useState('');
  const [sending,  setSending]  = useState(false);
  const [stepCtx,  setStepCtx]  = useState({});   // { stepName, explanation }
  const [resolved, setResolved] = useState(false);
  const bottomRef = useRef(null);

  // ── Listen for agent:chat-needed ───────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handler = ({ question, explanation, stepName }) => {
      setMessages([
        {
          role:    'agent',
          content: explanation
            ? `${explanation}\n\n${question}`
            : question,
        },
      ]);
      setStepCtx({ stepName, explanation });
      setResolved(false);
      setOpen(true);
    };

    socket.on('agent:chat-needed', handler);
    return () => socket.off('agent:chat-needed', handler);
  }, [socket]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send a message ──────────────────────────────────────────────────────────
  const send = async (overrideContent) => {
    const content = overrideContent ?? input.trim();
    if (!content || sending) return;

    const userMsg = { role: 'user', content };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setSending(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/agent/chat`,
        {
          method:  'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization:  `Bearer ${localStorage.getItem('mb_token')}`,
          },
          body: JSON.stringify({
            migration_id: migrationId,
            messages:     updatedMessages.map(m => ({
              role:    m.role === 'agent' ? 'assistant' : 'user',
              content: m.content,
            })),
            context: stepCtx,
          }),
        }
      );

      const data = await res.json();

      setMessages(prev => [...prev, { role: 'agent', content: data.reply || 'Got it — let me try that.' }]);

      if (data.resolved || data.skipStep) {
        setResolved(true);
        // Give the user a moment to read the final message before closing
        setTimeout(() => setOpen(false), 2200);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'agent', content: 'Sorry, I lost connection for a moment. Please try again.' },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!open) return null;

  return (
    // Full-screen overlay
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(26,24,20,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 16,
    }}>
      {/* Modal card */}
      <div style={{
        background: '#fff',
        borderRadius: 18,
        boxShadow: '0 8px 48px rgba(0,0,0,0.22)',
        width: '100%', maxWidth: 480,
        maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: `1px solid ${C.border}`,
          background: resolved ? C.greenBg : C.amberBg,
          transition: 'background .4s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>{resolved ? '✅' : '🧠'}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>
                {resolved ? 'All sorted! Continuing…' : 'Migration needs your help'}
              </div>
              <div style={{ fontSize: 12, color: C.inkMid, marginTop: 1 }}>
                {resolved
                  ? 'Your migration will resume in a moment.'
                  : stepCtx.stepName
                    ? `Paused at: ${stepCtx.stepName} step`
                    : 'Answer below to continue your migration'}
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '16px 18px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '86%',
            }}>
              <div style={{
                background: m.role === 'user' ? C.amber : C.surface,
                color:       m.role === 'user' ? '#fff'  : C.ink,
                borderRadius: m.role === 'user'
                  ? '14px 14px 4px 14px'
                  : '14px 14px 14px 4px',
                padding: '10px 14px',
                fontSize: 13,
                lineHeight: 1.55,
                border: m.role === 'user' ? 'none' : `1px solid ${C.border}`,
                whiteSpace: 'pre-wrap',
              }}>
                {m.content}
              </div>
              {m.role === 'agent' && (
                <div style={{ fontSize: 10, color: C.inkLight, marginTop: 3, marginLeft: 4 }}>
                  MigrateBot Agent
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div style={{ alignSelf: 'flex-start', fontSize: 12, color: C.inkLight, padding: '6px 10px' }}>
              Thinking…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        {!resolved && (
          <div style={{
            padding: '12px 16px',
            borderTop: `1px solid ${C.border}`,
            background: C.surface,
          }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending}
                placeholder="Type your answer here… (Enter to send)"
                rows={2}
                style={{
                  flex: 1, resize: 'none',
                  padding: '9px 12px',
                  border: `1.5px solid ${C.border}`,
                  borderRadius: 10,
                  fontSize: 13, lineHeight: 1.5,
                  fontFamily: 'inherit',
                  outline: 'none',
                  transition: 'border-color .15s',
                  background: sending ? C.surface : '#fff',
                }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || sending}
                style={{
                  padding: '0 18px',
                  background: !input.trim() || sending ? C.border : C.amber,
                  color: '#fff',
                  border: 'none', borderRadius: 10,
                  fontWeight: 700, fontSize: 14,
                  cursor: !input.trim() || sending ? 'default' : 'pointer',
                  transition: 'background .15s',
                  flexShrink: 0,
                }}
              >
                Send
              </button>
            </div>

            {/* Skip option */}
            <button
              onClick={() => send('Please skip this step and continue with the rest of the migration.')}
              disabled={sending}
              style={{
                width: '100%', padding: '8px',
                background: 'none',
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                fontSize: 12, color: C.inkMid,
                cursor: sending ? 'default' : 'pointer',
              }}
            >
              Skip this step and continue anyway
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
