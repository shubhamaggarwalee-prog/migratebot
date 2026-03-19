/**
 * frontend/components/StatusBadge.jsx
 */
const COLORS = {
  pending:        { bg: '#F8F7F4', text: '#6B6860', border: '#E5E2DA' },
  analyzing:      { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  analyzed:       { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  paid:           { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
  deploying:      { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
  complete:       { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
  failed:         { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  payment_failed: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
};

export default function StatusBadge({ status }) {
  const c = COLORS[status] || COLORS.pending;
  return (
    <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
}
