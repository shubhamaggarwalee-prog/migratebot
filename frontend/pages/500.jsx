import Link from 'next/link';
export default function ServerError() {
  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
      <div>
        <div style={{ fontSize: 80, marginBottom: 16 }}>500</div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: '#1A1814' }}>Server Error</h1>
        <p style={{ color: '#6B6860', marginBottom: '2rem' }}>Something went wrong on our end.</p>
        <Link href="/dashboard" style={{ padding: '12px 24px', background: '#D97706', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>Go to Dashboard</Link>
      </div>
    </div>
  );
}
