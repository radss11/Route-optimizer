// Floating summary card on the map (top-right)
function formatDist(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}
function formatTime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

export default function MapSummaryCard({ routeInfo, stopCount }) {
  if (!routeInfo) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 16, right: 16,
      zIndex: 500,
      background: 'rgba(24,28,39,0.92)',
      backdropFilter: 'blur(8px)',
      border: '1px solid #252a38',
      borderRadius: 12,
      padding: '14px 18px',
      display: 'flex',
      gap: 20,
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      fontFamily: "'Space Grotesk', sans-serif",
      pointerEvents: 'none',
    }}>
      <Stat label="Distance" value={formatDist(routeInfo.totalDistance)} />
      <Stat label="Est. Time" value={formatTime(routeInfo.totalDuration)} />
      <Stat label="Stops" value={stopCount} />
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#4ade80', fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
    </div>
  );
}
