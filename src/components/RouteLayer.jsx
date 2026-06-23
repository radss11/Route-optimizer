import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-polylinedecorator';

function formatDist(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}
function formatTime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

export default function RouteLayer({ routeInfo }) {
  const map = useMap();
  const layerRef = useRef([]);

  useEffect(() => {
    // Clear previous layers
    layerRef.current.forEach(l => map.removeLayer(l));
    layerRef.current = [];

    if (!routeInfo?.geometry) return;

    const { geometry, legs, order, reordered } = routeInfo;

    // --- Main route polyline (glow effect: wide dim + narrow bright) ---
    const glow = L.polyline(geometry, {
      color: '#4ade80',
      weight: 10,
      opacity: 0.15,
    }).addTo(map);

    const line = L.polyline(geometry, {
      color: '#4ade80',
      weight: 3.5,
      opacity: 0.9,
    }).addTo(map);

    // --- Direction arrows along the route ---
    const decorator = L.polylineDecorator(line, {
      patterns: [{
        offset: '5%',
        repeat: '12%',
        symbol: L.Symbol.arrowHead({
          pixelSize: 10,
          polygon: false,
          pathOptions: {
            color: '#4ade80',
            fillOpacity: 1,
            weight: 2,
            opacity: 0.8,
          }
        })
      }]
    }).addTo(map);

    layerRef.current.push(glow, line, decorator);

    // --- Per-leg clickable segments ---
    if (legs && order && reordered) {
      // Split geometry into per-leg segments using OSRM leg distances as guide
      // We'll approximate by splitting the full geometry proportionally
      // But best approach: re-request per leg — instead we add midpoint markers

      legs.forEach((leg, i) => {
        const fromStop = reordered[order[i]];
        const toStop   = reordered[order[i + 1]];
        if (!fromStop || !toStop) return;

        // Midpoint between the two stops (approx)
        const midLat = (fromStop.lat + toStop.lat) / 2;
        const midLng = (fromStop.lng + toStop.lng) / 2;

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            background: #181c27;
            border: 1.5px solid #4ade80;
            color: #4ade80;
            font-family: 'Space Grotesk', sans-serif;
            font-size: 10px;
            font-weight: 600;
            padding: 3px 7px;
            border-radius: 20px;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
            cursor: pointer;
          ">${formatDist(leg.distance)}</div>`,
          iconAnchor: [0, 0],
        });

        const marker = L.marker([midLat, midLng], { icon, interactive: true })
          .bindPopup(`
            <div style="font-family:'Space Grotesk',sans-serif; min-width:160px;">
              <div style="font-weight:700; font-size:13px; margin-bottom:6px; color:#111;">
                Leg ${i + 1} → ${i + 2}
              </div>
              <div style="font-size:12px; color:#444; margin-bottom:2px;">
                <b>From:</b> ${fromStop.label.split(',')[0]}
              </div>
              <div style="font-size:12px; color:#444; margin-bottom:8px;">
                <b>To:</b> ${toStop.label.split(',')[0]}
              </div>
              <div style="display:flex; gap:12px;">
                <div>
                  <div style="font-size:10px;color:#888;">Distance</div>
                  <div style="font-size:14px;font-weight:700;color:#16a34a;">${formatDist(leg.distance)}</div>
                </div>
                <div>
                  <div style="font-size:10px;color:#888;">Drive time</div>
                  <div style="font-size:14px;font-weight:700;color:#16a34a;">${formatTime(leg.duration)}</div>
                </div>
              </div>
            </div>
          `, { maxWidth: 220 })
          .addTo(map);

        layerRef.current.push(marker);
      });
    }

    return () => {
      layerRef.current.forEach(l => map.removeLayer(l));
      layerRef.current = [];
    };
  }, [routeInfo, map]);

  return null;
}
