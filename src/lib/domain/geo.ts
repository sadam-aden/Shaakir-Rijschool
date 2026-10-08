export type LatLng = { lat: number; lng: number };

/** Great-circle distance in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** v1 travel estimate: straight line × urban factor at an average urban speed. */
export function travelMinutes(a: LatLng, b: LatLng, urbanFactor = 1.3, speedKmh = 40): number {
  return Math.ceil(((haversineKm(a, b) * urbanFactor) / speedKmh) * 60);
}

/** Approximate centre of Rotterdam areas, used by the seed and as geocoding fallback. */
export const AREA_COORDS: Record<string, LatLng> = {
  Kralingen: { lat: 51.9244, lng: 4.5013 },
  Blijdorp: { lat: 51.9355, lng: 4.4668 },
  Delfshaven: { lat: 51.9111, lng: 4.4504 },
  Hillegersberg: { lat: 51.9528, lng: 4.5189 },
  "Rotterdam Centraal": { lat: 51.9244, lng: 4.4691 },
};
