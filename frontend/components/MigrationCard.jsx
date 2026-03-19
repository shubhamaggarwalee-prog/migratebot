/**
 * frontend/components/MigrationCard.jsx
 */
import { useRouter } from 'next/router';
import StatusBadge from './StatusBadge';

const SOURCE_ICONS = { github: '🐙', replit: '🔄', emergent: '🌱' };

export default function MigrationCard({ migration }) {
  const router = useRouter();
  return (
    <div
      onClick={() => router.push(`/migrations/${migration.id}`)}
      style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E2DA', padding: '1.25rem', cursor: 'pointer', transition: 'border-color 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = '#D97706'}
      onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E2DA'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 16 }}>{SOURCE_ICONS[migration.source_platform] || '📦'}</span>
            <span style={{ fontWeight: 600, color: '#1A1814', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {migration.reponame || migration.repourl}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#9B9890' }}>
            {migration.tier} • {new Date(migration.created_at).toLocaleDateString()}
          </div>
        </div>
        <StatusBadge status={migration.status} />
      </div>
    </div>
  );
}
