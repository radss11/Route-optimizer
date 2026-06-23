// Overlay shown on map while OSRM is fetching
export default function MapLoader({ message }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(15,17,23,0.6)',
      backdropFilter: 'blur(3px)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    }}>
      <div className="spinner" />
      <span style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#4ade80', fontSize: 14, fontWeight: 600 }}>
        {message}
      </span>
    </div>
  );
}
