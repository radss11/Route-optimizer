import { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, arrayMove
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';

import { geocodeAddress } from './utils/geocode';
import { getDistanceMatrix, getRouteGeometry } from './utils/osrm';
import { solveTSP } from './utils/solver';
import { buildRouteSummary, downloadTxt, copyToClipboard } from './utils/export';
import SortableStop from './components/SortableStop';
import MapLoader from './components/MapLoader';
import RouteLayer from './components/RouteLayer';
import MapSummaryCard from './components/MapSummaryCard';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function makeIcon(color, label) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${color};color:#0f1117;
      font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:11px;
      width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 8px rgba(0,0,0,0.4);border:2px solid rgba(255,255,255,0.2);
    "><span style="transform:rotate(45deg)">${label}</span></div>`,
    iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -30],
  });
}

function FitBounds({ stops }) {
  const map = useMap();
  if (stops.length > 1) {
    map.fitBounds(L.latLngBounds(stops.map(s => [s.lat, s.lng])), { padding: [60, 60] });
  }
  return null;
}

function formatDist(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}
function formatTime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

const MAX_STOPS = 10;

export default function App() {
  const [input, setInput]           = useState('');
  const [stops, setStops]           = useState([]);
  const [depotId, setDepotId]       = useState(null);
  const [status, setStatus]         = useState('');
  const [statusType, setStatusType] = useState('');
  const [loadingMsg, setLoadingMsg] = useState('');
  const [geocoding, setGeocoding]   = useState(false);
  const [routeInfo, setRouteInfo]   = useState(null);
  const [copied, setCopied]         = useState(false);
  const inputRef = useRef();

  // Update page title based on state
  useEffect(() => {
    if (routeInfo) {
      document.title = `Route ready · ${stops.length} stops — Route Optimizer`;
    } else if (stops.length > 0) {
      document.title = `${stops.length} stop${stops.length > 1 ? 's' : ''} added — Route Optimizer`;
    } else {
      document.title = 'Route Optimizer';
    }
  }, [routeInfo, stops.length]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function showStatus(msg, type = '') { setStatus(msg); setStatusType(type); }

  function getDepotId(currentStops, currentDepotId) {
    if (currentDepotId && currentStops.find(s => s.id === currentDepotId)) return currentDepotId;
    return currentStops[0]?.id ?? null;
  }

  async function addStop() {
    const addr = input.trim();
    if (!addr) return;
    if (stops.length >= MAX_STOPS) { showStatus(`Max ${MAX_STOPS} stops reached.`, 'error'); return; }
    setGeocoding(true);
    showStatus('Geocoding address…', 'loading');
    try {
      const loc = await geocodeAddress(addr);
      const newStop = { ...loc, id: Date.now() };
      setStops(prev => {
        const next = [...prev, newStop];
        if (!depotId) setDepotId(next[0].id);
        return next;
      });
      setInput('');
      showStatus('');
      setRouteInfo(null);
      inputRef.current?.focus();
    } catch (e) {
      showStatus(e.message, 'error');
    } finally {
      setGeocoding(false);
    }
  }

  function removeStop(id) {
    setStops(prev => {
      const next = prev.filter(s => s.id !== id);
      if (depotId === id) setDepotId(next[0]?.id ?? null);
      return next;
    });
    setRouteInfo(null);
    showStatus('');
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setStops(prev => {
        const oldIdx = prev.findIndex(s => s.id === active.id);
        const newIdx = prev.findIndex(s => s.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
      setRouteInfo(null);
    }
  }

  function setDepot(id) {
    setDepotId(id);
    setRouteInfo(null);
    showStatus('Depot updated. Re-optimize to apply.', '');
  }

  async function optimize() {
    if (stops.length < 2) { showStatus('Add at least 2 stops.', 'error'); return; }
    const effectiveDepotId = getDepotId(stops, depotId);
    const depotIdx = stops.findIndex(s => s.id === effectiveDepotId);
    const reordered = [stops[depotIdx], ...stops.filter((_, i) => i !== depotIdx)];

    setLoadingMsg('Fetching road distances…');
    try {
      const { distances } = await getDistanceMatrix(reordered);
      setLoadingMsg('Solving route…');
      const order = solveTSP(distances);
      setLoadingMsg('Building road geometry…');
      const orderedStops = order.map(i => reordered[i]);
      const geo = await getRouteGeometry(orderedStops);
      setRouteInfo({ ...geo, order, reordered });
      showStatus('');
    } catch (e) {
      showStatus(e.message, 'error');
    } finally {
      setLoadingMsg('');
    }
  }

  async function handleCopy() {
    const text = buildRouteSummary(routeInfo, stops);
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const text = buildRouteSummary(routeInfo, stops);
    downloadTxt(text, 'optimized-route.txt');
  }

  const effectiveDepotId = getDepotId(stops, depotId);
  const isOptimized = !!routeInfo;

  const displayStops = isOptimized
    ? routeInfo.order.slice(0, -1).map(i => routeInfo.reordered[i])
    : stops;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>Route Optimizer</h1>
          <p>Real road routing · up to {MAX_STOPS} stops</p>
        </div>

        <div className="sidebar-body">
          {/* Address input */}
          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>Add Stop</div>
            <div className="input-row">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !geocoding && addStop()}
                placeholder="Search address or place…"
                disabled={geocoding || stops.length >= MAX_STOPS || isOptimized}
              />
              <button
                className="btn btn-primary"
                onClick={addStop}
                disabled={geocoding || !input.trim() || stops.length >= MAX_STOPS || isOptimized}
              >+</button>
            </div>
            {status && <div className={`status ${statusType}`} style={{ marginTop: 6 }}>{status}</div>}
          </div>

          {/* Stop list */}
          {stops.length > 0 && (
            <div>
              <div className="section-label" style={{ marginBottom: 8 }}>
                Stops ({stops.length}/{MAX_STOPS})
                {!isOptimized && stops.length > 1 && (
                  <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 6, textTransform: 'none', fontSize: 11 }}>
                    · drag to reorder
                  </span>
                )}
              </div>

              {isOptimized ? (
                <div className="stop-list">
                  {displayStops.map((s, i) => (
                    <div className="stop-item" key={s.id}>
                      <span className="stop-index">{i + 1}</span>
                      <span className="stop-name" title={s.label}>{s.label}</span>
                      {s.id === effectiveDepotId && <span className="depot-badge">depot</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                  modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                >
                  <SortableContext items={stops.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="stop-list">
                      {stops.map((s, i) => (
                        <SortableStop
                          key={s.id}
                          stop={s}
                          index={i}
                          isDepot={s.id === effectiveDepotId}
                          onRemove={removeStop}
                          onSetDepot={setDepot}
                          disabled={isOptimized}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          )}

          {/* Optimize button */}
          {stops.length >= 2 && !isOptimized && (
            <button className="btn btn-optimize" onClick={optimize} disabled={!!loadingMsg}>
              {loadingMsg ? loadingMsg : '⚡ Optimize Route'}
            </button>
          )}

          {/* Stats */}
          {routeInfo && (
            <div className="stats-panel">
              <div className="section-label">Route Summary</div>
              <div className="stat">
                <span className="stat-label">Total distance</span>
                <span className="stat-value">{formatDist(routeInfo.totalDistance)}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Estimated time</span>
                <span className="stat-value">{formatTime(routeInfo.totalDuration)}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Stops</span>
                <span className="stat-value">{stops.length}</span>
              </div>
            </div>
          )}

          {/* Export buttons */}
          {isOptimized && (
            <div>
              <div className="section-label" style={{ marginBottom: 8 }}>Export</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={handleCopy}>
                  {copied ? '✓ Copied!' : '📋 Copy Route'}
                </button>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={handleDownload}>
                  ⬇ Download .txt
                </button>
              </div>
            </div>
          )}

          {/* Leg breakdown */}
          {routeInfo?.legs && (
            <div>
              <div className="section-label" style={{ marginBottom: 8 }}>
                Leg Breakdown
                <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 6, textTransform: 'none', fontSize: 11 }}>
                  · click tags on map
                </span>
              </div>
              <div className="leg-list">
                {routeInfo.legs.map((leg, i) => {
                  const from = routeInfo.reordered[routeInfo.order[i]];
                  return (
                    <div className="leg-item" key={i}>
                      <span className="leg-from">{i + 1}→{i + 2} &nbsp;{from?.label?.split(',')[0]}</span>
                      <span className="leg-dist">{formatDist(leg.distance)} · {formatTime(leg.duration)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottom actions */}
          {isOptimized && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setRouteInfo(null); showStatus(''); }}>
                ← Edit Stops
              </button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setRouteInfo(null); setStops([]); setDepotId(null); showStatus(''); }}>
                Start Over
              </button>
            </div>
          )}

          {/* Empty state */}
          {stops.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🗺️</div>
              <div className="empty-title">No stops yet</div>
              <div className="empty-sub">
                Type an address above and press Enter.<br />
                First stop becomes the depot.<br />
                <span style={{ color: 'var(--muted)', fontSize: 11 }}>Use ⚑ to change depot anytime.</span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Map */}
      <div className="map-wrap">
        <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ width: '100%', height: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {stops.length > 0 && <FitBounds stops={stops} />}

          {stops.map((s) => {
            const isDepot = s.id === effectiveDepotId;
            let displayIdx;
            if (isOptimized) {
              displayIdx = routeInfo.order.slice(0, -1).findIndex(i => routeInfo.reordered[i]?.id === s.id);
            } else {
              displayIdx = stops.findIndex(x => x.id === s.id);
            }
            const color = isDepot ? '#f59e0b' : '#4ade80';
            const label = isDepot && !isOptimized ? 'D' : String(displayIdx + 1);
            return (
              <Marker key={s.id} position={[s.lat, s.lng]} icon={makeIcon(color, label)}>
                <Popup>
                  <strong style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13 }}>
                    Stop {displayIdx + 1}{isDepot ? ' (Depot)' : ''}
                  </strong><br />
                  <span style={{ fontSize: 12, color: '#555' }}>{s.label}</span>
                </Popup>
              </Marker>
            );
          })}

          <RouteLayer routeInfo={routeInfo} />
        </MapContainer>

        <MapSummaryCard routeInfo={routeInfo} stopCount={stops.length} />
        {loadingMsg && <MapLoader message={loadingMsg} />}
      </div>
    </div>
  );
}
