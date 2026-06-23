const OSRM_BASE = 'https://router.project-osrm.org';
const TIMEOUT_MS = 10000;

async function fetchWithTimeout(url, ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('Request timed out. Check your internet connection.');
    throw e;
  }
}

export async function getDistanceMatrix(stops) {
  const coords = stops.map(s => `${s.lng},${s.lat}`).join(';');
  const url = `${OSRM_BASE}/table/v1/driving/${coords}?annotations=duration,distance`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`OSRM table request failed (HTTP ${res.status})`);
  const data = await res.json();
  if (data.code !== 'Ok') throw new Error('OSRM error: ' + (data.message || data.code));

  // Check for unreachable stops (OSRM returns very large values like 2^31 for unreachable pairs)
  const MAX_REALISTIC = 1e9;
  const unreachable = [];
  data.distances.forEach((row, i) => {
    row.forEach((val, j) => {
      if (i !== j && val > MAX_REALISTIC) {
        unreachable.push(i);
      }
    });
  });
  if (unreachable.length > 0) {
    const names = [...new Set(unreachable)].map(i => stops[i].label.split(',')[0]).join(', ');
    throw new Error(`Some stops are unreachable by road: ${names}`);
  }

  return {
    durations: data.durations,
    distances: data.distances
  };
}

export async function getRouteGeometry(orderedStops) {
  const coords = orderedStops.map(s => `${s.lng},${s.lat}`).join(';');
  const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`OSRM route request failed (HTTP ${res.status})`);
  const data = await res.json();
  if (data.code !== 'Ok') throw new Error('OSRM error: ' + (data.message || data.code));
  const route = data.routes[0];
  return {
    geometry: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    totalDistance: route.distance,
    totalDuration: route.duration,
    legs: route.legs.map(l => ({ distance: l.distance, duration: l.duration }))
  };
}
