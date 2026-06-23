# 🗺️ Route Optimizer

A delivery route optimizer that finds the fastest road route for a single driver across multiple stops — built with React, Leaflet.js, OSRM, and a custom TSP solver.

🔗 **Live Demo:** https://route-optimizer-dax1mggio-radha6.vercel.app/

---

## Features

- 📍 **Address geocoding** via Nominatim (OpenStreetMap) — type any real address
- 🛣️ **Real road distances** via OSRM — not straight-line estimates
- 🧠 **TSP Solver** — Nearest Neighbor heuristic + 2-opt local search
- 🗺️ **Interactive map** — Leaflet.js with route polyline, direction arrows, per-leg popups
- 🔀 **Drag to reorder** stops before optimizing
- 📌 **Custom depot** — set any stop as the start/end point
- 📊 **Per-leg breakdown** — distance and drive time for every segment
- 📋 **Export route** — copy summary or download as `.txt`
- ⚡ Up to 10 stops

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite |
| Map | Leaflet.js + react-leaflet |
| Geocoding | Nominatim API (OpenStreetMap) |
| Routing | OSRM public API |
| Algorithm | Nearest Neighbor + 2-opt TSP |
| Drag & Drop | @dnd-kit |
| Deploy | Vercel |

---

## How It Works

1. User types addresses → **Nominatim** converts them to lat/lng coordinates
2. **OSRM Table API** returns an n×n matrix of real road distances between all stop pairs
3. **Nearest Neighbor** builds an initial route greedily (always go to the closest unvisited stop)
4. **2-opt** improves it by repeatedly uncrossing route legs until no improvement is possible
5. **OSRM Route API** fetches the actual road geometry for the final ordered route
6. **Leaflet** renders the polyline with direction arrows and per-leg distance tags on the map

---

## Run Locally

```bash
git clone https://github.com/radss11/Route-optimizer.git
cd Route-optimizer
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Or connect the GitHub repo at [vercel.com](https://vercel.com) → New Project.

---

## Algorithm Details

**Nearest Neighbor** — O(n²) greedy heuristic. Fast but can produce suboptimal routes with "crossing" legs.

**2-opt** — iteratively reverses segments of the route when doing so reduces total distance. Runs until no improving swap exists. Significantly reduces total distance vs. nearest neighbor alone.

Both algorithms run on the **real road distance matrix** from OSRM, not Euclidean distances — so the optimization is meaningful for actual driving.

---

## Project Structure

```
src/
  App.jsx                  # Main UI and state management
  index.css                # Design system (dark theme)
  components/
    SortableStop.jsx       # Draggable stop list item
    MapLoader.jsx          # Map overlay during API calls
    RouteLayer.jsx         # Polyline + arrows + leg markers
    MapSummaryCard.jsx     # Floating stats card on map
  utils/
    geocode.js             # Nominatim geocoding with retry
    osrm.js                # OSRM distance matrix + geometry
    solver.js              # TSP: nearest neighbor + 2-opt
```

---

*Built as a portfolio project. Uses free public APIs — please don't hammer them with automated requests.*
