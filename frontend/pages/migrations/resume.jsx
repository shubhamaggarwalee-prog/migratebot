/**
 * frontend/pages/migrations/resume.jsx
 * Gap 2: Resume a paused migration via chat.
 *
 * Shown when a migration is in status 'paused' or 'chat-needed'.
 * The agent asked a question mid-deployment and the user closed the tab.
 * This page lets them come back, see the pending question, answer it,
 * and resume the deployment — exactly as the AgentChat overlay would have.
 *
 * Route: /migrations/resume?id=<migrationId>
 */
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/api';
import { useMigrationSocket } from '../../hooks/useSocket';

const C = {
  amber: '#D97706', amberBg: '#FEF3C7', amberDark: '#B45309',
  ink: '#1A1814', inkMid: '#5C574E', inkLight: '#9B958A',
  border: '#E5E2DA', surface: '#F8F7F4',
  green: '#059669', greenBg: '#D1FAE5',
  red: '#DC2626', redBg: '#FEE2E2',
  blue: '#2563EB', blueBg: '#DBEAFE',
};

// Status badge helper
function StatusPill({ status }) {
  const map = {
    paused:       { bg: C.amberBg,  color: C.amberDark, label: '⏸ Paused — waiting for your answer' },
    'chat-needed':{ bg: C.amberBg,  color: C.amberDark, label: '💬 Input needed' },
    deploying:    { bg: C.blueBg,   color: C.blue,       label: '⚡ Deploying…' },
    complete:     { bg: C.greenBg,  color: C.green,      label: '✅ Complete' },
    failed:       { bg: C.redBg,    color: C.red,        label: '❌ Failed' },
  };
  const s = map[status] || { bg: C.surface, color: C.inkMid, label: status };
  return (
    <span style={{ display: 'inline-block', padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export default function ResumeMigration() {
  const router = useRouter();
  const { id } = router.query;
  const { user, loading } = useAuth();

  const [migration,  setMigration]  = useState(null);
  const [messages,   setMessages]   = useState([]);
  const [input,      setInput]      = useState('');
  const [sending,    setSending]    = useState(false);
  const [skipping,   setSkipping]   = useState(false);
  const [error,      setError]      = useState('');
  const [done,       setDone]       = useState(false);
  const [resumed,    setResumed]    = useState(false);
  const bottomRef = useRef(null);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  // Load migration + pending chat context
  useEffect(() => {
    if (!id) return;
    apiClient.get(`/api/migrations/${id}`)
      .then(r => {
        setMigration(r.migration);
        // Load any pending agent messages from the migration's chat_context field
        const ctx = r.migration?.chat_context;
        if (ctx?.messages?.length) {
          setMessages(ctx.messages);
        } else if (ctx?.question) {
          setMessages([{ role: 'agent', text: ctx.question }]);
        } else {
          setMessages([{
            role: 'agent',
            text: 'Hi! Your deployment was paused because I needed some information. Please describe what you\'d like me to do next, and I\'ll resume from where we left off.',
          }]);
        }
      })
      .catch(() => setError('Could not load this migration. Please try again.'));
  }, [id]);

  // Socket — listen for resume events
  const socket = useMigrationSocket(id);
  useEffect(() => {
    if (!socket) return;
    socket.on('migration:complete', () => {
      setMigration(m => m ? { ...m, status: 'complete' } : m);
      setDone(true);
    });
    socket.on('migration:error', ({ error: err }) => {
      setMigration(m => m ? { ...m, status: 'failed', error_message: err } : m);
    });
    socket.on('agent:chat-needed', ({ question }) => {
      setMessages(prev => [...prev, { role: 'agent', text: question }]);
      setResumed(false);
    });
    return () => {
      socket.off('migration:complete');
      socket.off('migration:error');
      socket.off('agent:chat-needed');
    };
  }, [socket]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendAnswer = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setError('');
    const updated = [...messages, { role: 'user', text }];
    setMessages(updated);
    setSending(true);
    try {
      await apiClient.post(`/api/migrations/${id}/chat-reply`, {
        message: text,
        resume: true,
      });
      setResumed(true);
      setMessages(prev => [...prev, {
        role: 'agent',
        text: '✅ Got it! Resuming your deployment now… keep this tab open.',
      }]);
    } catch (e) {
      setError(e.message || 'Failed to send reply. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const skipStep = async () => {
    setSkipping(true);
    setError('');
    try {
      await apiClient.post(`/api/migrations/${id}/chat-reply`, {
        message: '__skip__',
        resume: true,
      });
      setResumed(true);
      setMessages(prev => [...prev, {
        role: 'agent',
        text: '⏩ Skipping this step and continuing deployment…',
      }]);
    } catch (e) {
      setError(e.message || 'Failed to skip. Please try again.');
    } finally {
      setSkipping(false);
    }
  };

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAnswer(); }
  };

  if (!migration && !error) {
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: '4rem', color: C.inkLight }}>Loading…</div>
      </Layout>
    );
  }

  const isPaused   = ['paused', 'chat-needed'].includes(migration?.status);
  const isComplete = migration?.status === 'complete';
  const isFailed   = migration?.status === 'failed';

  return (
    <>
      <Head>
        <title>Resume Deployment — MigrateBot</title>
      </Head>
      <Layout>
        <button
          onClick={() => router.push(`/migrations/${id}`)}
          style={{ background: 'none', border: 'none', color: C.amber, cursor: 'pointer', marginBottom: 16, padding: 0, fontSize: 14 }}
        >
          ← Back to migration
        </button>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: C.ink, margin: 0 }}>
              Resume Deployment
            </h1>
            {migration && <StatusPill status={migration.status} />}
          </div>
          <p style={{ color: C.inkMid, fontSize: 14, margin: 0 }}>
            {migration?.reponame || migration?.repourl}
          </p>
        </div>

        {/* Explanation card */}
        {isPaused && !resumed && (
          <div style={{
            background: C.amberBg, border: `1px solid ${C.amber}44`,
            borderRadius: 12, padding: '14px 18px', marginBottom: 24,
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>⏸</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.amberDark, marginBottom: 4 }}>
                Your deployment is paused
              </div>
              <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.6 }}>
                The AI agent hit a point where it needed your help. Answer its question below
                and it will pick up right where it left off — no need to start over.
              </div>
            </div>
          </div>
        )}

        {/* Resumed / deploying notice */}
        {resumed && !isComplete && !isFailed && (
          <div style={{
            background: C.blueBg, border: `1px solid ${C.blue}33`,
            borderRadius: 12, padding: '14px 18px', marginBottom: 24,
            display: 'flex', gap: 12, alignItems: 'center',
          }}>
            <span style={{ fontSize: 20 }}>⚡</span>
            <div style={{ fontSize: 14, color: C.blue, fontWeight: 600 }}>
              Deployment is running… please keep this tab open.
            </div>
          </div>
        )}

        {/* Complete */}
        {isComplete && (
          <div style={{
            background: C.greenBg, border: `1px solid ${C.green}44`,
            borderRadius: 12, padding: '20px 24px', marginBottom: 24, textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: C.green, marginBottom: 6 }}>Your app is live!</div>
            <div style={{ fontSize: 14, color: '#166534', marginBottom: 16 }}>
              Deployment completed successfully.
            </div>
            <button
              onClick={() => router.push(`/migrations/${id}`)}
              style={{ padding: '11px 24px', background: C.green, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            >
              View full report →
            </button>
          </div>
        )}

        {/* Failed */}
        {isFailed && (
          <div style={{
            background: C.redBg, border: `1px solid ${C.red}44`,
            borderRadius: 12, padding: '16px 20px', marginBottom: 24,
          }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.red, marginBottom: 4 }}>❌ Deployment failed</div>
            <div style={{ fontSize: 13, color: C.red, opacity: 0.85 }}>
              {migration.error_message || 'An error occurred. A full refund will be issued within 24 hours.'}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: C.redBg, border: `1px solid ${C.red}44`, borderRadius: 8, padding: '10px 14px', color: C.red, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Chat thread */}
        {!isComplete && (
          <div style={{ background: '#fff', borderRadius: 14, border: `1.5px solid ${C.amber}`, overflow: 'hidden', marginBottom: 16 }}>
            {/* Chat header */}
            <div style={{
              background: C.amberBg, padding: '12px 18px',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.ink }}>MigrateBot AI Agent</div>
                <div style={{ fontSize: 11, color: C.inkMid }}>Waiting for your answer to continue deployment</div>
              </div>
            </div>

            {/* Messages */}
            <div style={{
              minHeight: 180, maxHeight: 340, overflowY: 'auto',
              padding: '16px', display: 'flex', flexDirection: 'column', gap: 10,
              background: C.surface,
            }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '82%', padding: '10px 14px',
                    borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    background: m.role === 'user' ? C.amber : '#fff',
                    color: m.role === 'user' ? '#fff' : C.ink,
                    fontSize: 14, lineHeight: 1.6,
                    border: m.role === 'agent' ? `1px solid ${C.border}` : 'none',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {sending && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ padding: '10px 14px', borderRadius: '12px 12px 12px 2px', background: '#fff', border: `1px solid ${C.border}`, fontSize: 14, color: C.inkLight }}>Agent is processing…</div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            {!resumed && (
              <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, background: '#fff', display: 'flex', gap: 8 }}>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Type your answer… (Enter to send)"
                  rows={2}
                  style={{
                    flex: 1, padding: '10px 12px',
                    border: `1px solid ${C.border}`, borderRadius: 8,
                    fontSize: 14, resize: 'none', outline: 'none',
                    fontFamily: 'inherit', lineHeight: 1.5,
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button
                    onClick={sendAnswer}
                    disabled={sending || !input.trim()}
                    style={{
                      padding: '10px 18px',
                      background: sending || !input.trim() ? C.border : C.amber,
                      color: '#fff', border: 'none', borderRadius: 8,
                      fontWeight: 700, fontSize: 14,
                      cursor: sending || !input.trim() ? 'default' : 'pointer',
                      flex: 1,
                    }}
                  >
                    {sending ? '…' : 'Send'}
                  </button>
                  <button
                    onClick={skipStep}
                    disabled={skipping || sending}
                    style={{
                      padding: '6px 10px',
                      background: 'none', color: C.inkLight,
                      border: `1px solid ${C.border}`, borderRadius: 8,
                      fontSize: 11, cursor: skipping ? 'default' : 'pointer',
                    }}
                  >
                    {skipping ? '…' : 'Skip step'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Back link */}
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <button
            onClick={() => router.push('/dashboard')}
            style={{ background: 'none', border: 'none', color: C.inkMid, cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}
          >
            ← Go to dashboard
          </button>
        </div>
      </Layout>
    </>
  );
}
