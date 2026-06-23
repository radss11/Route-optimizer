// TSP solver: Nearest Neighbor heuristic + 2-opt improvement
// depot is always index 0, must start and end there

function totalDistance(route, distMatrix) {
  let d = 0;
  for (let i = 0; i < route.length - 1; i++) {
    d += distMatrix[route[i]][route[i + 1]];
  }
  return d;
}

function nearestNeighbor(distMatrix, depot = 0) {
  const n = distMatrix.length;
  const visited = new Array(n).fill(false);
  const route = [depot];
  visited[depot] = true;

  for (let step = 1; step < n; step++) {
    const last = route[route.length - 1];
    let nearest = -1;
    let minDist = Infinity;
    for (let j = 0; j < n; j++) {
      if (!visited[j] && distMatrix[last][j] < minDist) {
        minDist = distMatrix[last][j];
        nearest = j;
      }
    }
    route.push(nearest);
    visited[nearest] = true;
  }

  route.push(depot); // return to depot
  return route;
}

function twoOpt(route, distMatrix) {
  let improved = true;
  let best = [...route];

  while (improved) {
    improved = false;
    for (let i = 1; i < best.length - 2; i++) {
      for (let j = i + 1; j < best.length - 1; j++) {
        const before = distMatrix[best[i - 1]][best[i]] + distMatrix[best[j]][best[j + 1]];
        const after  = distMatrix[best[i - 1]][best[j]] + distMatrix[best[i]][best[j + 1]];
        if (after < before - 1e-6) {
          // Reverse segment between i and j
          const segment = best.slice(i, j + 1).reverse();
          best = [...best.slice(0, i), ...segment, ...best.slice(j + 1)];
          improved = true;
        }
      }
    }
  }
  return best;
}

export function solveTSP(distMatrix) {
  const nn = nearestNeighbor(distMatrix, 0);
  const optimized = twoOpt(nn, distMatrix);
  return optimized; // array of stop indices, starts and ends at 0
}
