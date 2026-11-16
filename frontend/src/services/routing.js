import { calculateHaversineDistance, estimateETA } from '../utils/clientDistance';

// In-memory route cache to minimize public OSRM server load
const routeCache = new Map();

/**
 * Fetch road-following route from OSRM demo server with fallback to Haversine straight line.
 * Note: OSRM public demo server is rate-limited and intended for prototypes.
 * @param {Object} from { lat, lng }
 * @param {Object} to { lat, lng }
 * @param {string} profile 'driving' | 'walking'
 * @returns {Promise<Object>} { coordinates: [[lat, lng], ...], distanceKm, durationMin, isRoadRoute: boolean }
 */
export async function getRoute(from, to, profile = 'driving') {
  if (!from?.lat || !from?.lng || !to?.lat || !to?.lng) {
    return null;
  }

  const cacheKey = `${from.lat.toFixed(4)},${from.lng.toFixed(4)}->${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  const cached = routeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 30000) {
    return cached.data;
  }

  // Fallback straight line
  const straightDist = calculateHaversineDistance(from.lat, from.lng, to.lat, to.lng);
  const fallback = {
    coordinates: [
      [from.lat, from.lng],
      [to.lat, to.lng]
    ],
    distanceKm: straightDist,
    durationMin: estimateETA(straightDist),
    isRoadRoute: false
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    // Note: OSRM expects coordinates in lng,lat order
    const url = `https://router.project-osrm.org/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return fallback;
    }

    const data = await res.json();
    if (!data.routes || data.routes.length === 0) {
      return fallback;
    }

    const primaryRoute = data.routes[0];
    // GeoJSON coordinates are [lng, lat], convert to Leaflet [lat, lng]
    const leafletCoords = primaryRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

    const result = {
      coordinates: leafletCoords,
      distanceKm: Math.round((primaryRoute.distance / 1000) * 10) / 10,
      durationMin: Math.max(1, Math.round(primaryRoute.duration / 60)),
      isRoadRoute: true
    };

    routeCache.set(cacheKey, { timestamp: Date.now(), data: result });
    return result;
  } catch (err) {
    clearTimeout(timeoutId);
    return fallback;
  }
}
