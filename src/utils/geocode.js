// Nominatim (OpenStreetMap) geocoder with retry + rate limit handling
export async function geocodeAddress(address, retries = 2) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'RouteOptimizer/1.0' }
      });

      if (res.status === 429) {
        // Rate limited — wait 1.5s then retry
        if (attempt < retries) {
          await sleep(1500);
          continue;
        }
        throw new Error('Too many requests. Wait a moment and try again.');
      }

      if (!res.ok) throw new Error(`Geocoding failed (HTTP ${res.status})`);

      const data = await res.json();
      if (!data.length) throw new Error(`No results found for "${address}". Try a more specific address.`);

      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        label: data[0].display_name.split(',').slice(0, 3).join(', ')
      };
    } catch (e) {
      if (attempt === retries) throw e;
      await sleep(800);
    }
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
