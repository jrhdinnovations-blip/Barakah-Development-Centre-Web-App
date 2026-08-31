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
  const url = `${NOMINATIM}/search?format=jsonv2&limit=5&countrycodes=ng&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) return [];
  const json: any[] = await res.json().catch(() => []);
  return (json ?? []).map((r) => ({
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
