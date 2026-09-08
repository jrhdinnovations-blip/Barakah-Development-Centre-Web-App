/**
 * Map/location abstraction layer — all provider calls live here so the
 * provider can be swapped later. Current providers (no API key required):
 *  - Geocoding/search: OpenStreetMap Nominatim (server-side only)
 *  - Distance/time: haversine + city-speed estimate
 * Never expose a provider key in the frontend: any future keyed provider
 * must be proxied through these server functions.
 */

const NOMINATIM = "https://nominatim.openstreetmap.org";
const UA = "BarakahSwiftMove/1.0 (contact@barakahdevelopmentcentre.org)";

export interface GeoResult {
  label: string;
  lat: number;
  lng: number;
}

export async function searchAddress(query: string): Promise<GeoResult[]> {
  const trimmed = query?.trim();
  if (!trimmed) return [];

  // Enforce Plateau / Jos context if not already present
  let q = trimmed;
  if (!q.toLowerCase().includes('plateau') && !q.toLowerCase().includes('jos')) {
    q = `${q}, Jos, Plateau State, Nigeria`;
  } else if (!q.toLowerCase().includes('nigeria')) {
    q = `${q}, Nigeria`;
  }

  // Bounded viewbox around Plateau State: lon 8.4 -> 9.4, lat 9.4 -> 10.3
  const url = `${NOMINATIM}/search?format=jsonv2&limit=8&countrycodes=ng&viewbox=8.4,10.3,9.4,9.4&bounded=0&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) return [];
  const json: any[] = await res.json().catch(() => []);

  // Filter out any results that explicitly belong to other states (Kano, Kaduna, Abuja/FCT, Lagos)
  const isQueryExplicitState = trimmed.toLowerCase().includes('kano') || trimmed.toLowerCase().includes('kaduna') || trimmed.toLowerCase().includes('abuja');
  const filtered = (json ?? []).filter((r) => {
    if (isQueryExplicitState) return true;
    const name = (r.display_name || '').toLowerCase();
    return !name.includes('kano') && !name.includes('kaduna') && !name.includes('abuja') && !name.includes('fct') && !name.includes('lagos');
  });

  return filtered.map((r) => ({
    label: r.display_name as string,
    lat: Number(r.lat),
    lng: Number(r.lon),
  }));
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = `${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) return null;
  const json: any = await res.json().catch(() => null);
  return json?.display_name ?? null;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Rough urban driving estimate: road factor 1.3x, average 22 km/h. */
export function estimateDurationMin(distanceKm: number) {
  return Math.max(2, Math.round(((distanceKm * 1.3) / 22) * 60));
}

export interface ServerRouteResult {
  success: boolean;
  distanceKm: number;
  distanceMeters: number;
  durationSeconds: number;
  durationText: string;
  polylinePoints: [number, number][];
  isFallback: boolean;
  error?: string;
}

/**
 * Calculates real turn-by-turn road route via OSRM driving engine.
 */
export async function calculateServerRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<ServerRouteResult> {
  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(osrmUrl, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data: any = await res.json();
      if (data?.code === "Ok" && Array.isArray(data?.routes) && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceMeters = Number(route.distance) || 0;
        const distanceKm = Math.max(0.2, Math.round((distanceMeters / 1000) * 10) / 10);
        const durationSeconds = Math.round(Number(route.duration) || distanceKm * 120);
        const durationMinutes = Math.max(2, Math.round(durationSeconds / 60));
        const durationText = `${durationMinutes} mins`;

        const coordinates = route?.geometry?.coordinates;
        const polylinePoints: [number, number][] =
          Array.isArray(coordinates) && coordinates.length > 0
            ? coordinates.map(([lng, lat]: [number, number]) => [lat, lng])
            : [
                [originLat, originLng],
                [destLat, destLng],
              ];

        return {
          success: true,
          distanceKm,
          distanceMeters: Math.round(distanceMeters),
          durationSeconds,
          durationText,
          polylinePoints,
          isFallback: false,
        };
      }
    }
  } catch (err: any) {
    // Fall through to calibrated local road estimate
  }

  // Calibrated urban road network calculation
  const straight = haversineKm(originLat, originLng, destLat, destLng);
  // Real Jos road multiplier based on distance: short hops ~1.35x, longer cross-city trips ~1.42x
  const multiplier = straight < 5 ? 1.32 : straight < 15 ? 1.40 : 1.45;
  const distanceKm = Math.max(0.5, Math.round(straight * multiplier * 10) / 10);
  const durationMin = estimateDurationMin(distanceKm);

  return {
    success: true,
    distanceKm,
    distanceMeters: Math.round(distanceKm * 1000),
    durationSeconds: durationMin * 60,
    durationText: `~${durationMin} mins`,
    polylinePoints: [
      [originLat, originLng],
      [destLat, destLng],
    ],
    isFallback: true,
  };
}
