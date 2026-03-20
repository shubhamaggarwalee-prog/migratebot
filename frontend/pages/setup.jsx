/**
 * frontend/pages/setup.jsx
 * Initial setup / onboarding page placeholder.
 */
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function SetupPage() {
  const router = useRouter();

  return (
    <>
      <Head><title>Setup — MigrateBot</title></Head>
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#F8F7F4',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, marginBottom: 16 }}>
            Migrate<span style={{ color: '#D97706' }}>Bot</span>
          </div>
          <p style={{ color: '#5C574E', marginBottom: 24 }}>Setting up your account…</p>
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              padding: '10px 24px', background: '#D97706', color: '#fff',
              border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer',
            }}
          >Go to Dashboard</button>
        </div>
      </div>
    </>
  );
}
