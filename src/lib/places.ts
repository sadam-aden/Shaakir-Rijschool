import "server-only";
import index from "@/data/places/index.json";

/**
 * Dutch provinces → cities/villages → neighbourhoods (wijken), generated from the public PDOK data
 * (see scripts/build-places.mjs). One small file per province, loaded on demand.
 */
export type Place = { name: string; municipality: string; lat: number; lng: number };
export type Wijk = { name: string; lat: number; lng: number };
export type ProvinceData = { province: string; places: Place[]; wijken: Record<string, Wijk[]> };

export const provinces = index as { name: string; slug: string; places: number }[];

const loaders: Record<string, () => Promise<{ default: unknown }>> = {
  drenthe: () => import("@/data/places/drenthe.json"),
  flevoland: () => import("@/data/places/flevoland.json"),
  fryslan: () => import("@/data/places/fryslan.json"),
  gelderland: () => import("@/data/places/gelderland.json"),
  groningen: () => import("@/data/places/groningen.json"),
  limburg: () => import("@/data/places/limburg.json"),
  "noord-brabant": () => import("@/data/places/noord-brabant.json"),
  "noord-holland": () => import("@/data/places/noord-holland.json"),
  overijssel: () => import("@/data/places/overijssel.json"),
  utrecht: () => import("@/data/places/utrecht.json"),
  zeeland: () => import("@/data/places/zeeland.json"),
  "zuid-holland": () => import("@/data/places/zuid-holland.json"),
};

export async function loadProvince(slug: string): Promise<ProvinceData | null> {
  const load = loaders[slug];
  return load ? ((await load()).default as ProvinceData) : null;
}

export const slugOfProvince = (name: string) => provinces.find((p) => p.name === name)?.slug ?? null;

/** Approximate coordinates (centre of the chosen neighbourhood, else of the city) used for travel-time estimates. */
export async function coordsFor(province?: string | null, city?: string | null, wijk?: string | null) {
  const slug = province ? slugOfProvince(province) : null;
  const data = slug ? await loadProvince(slug) : null;
  if (!data || !city) return null;
  const place = data.places.find((p) => p.name === city);
  if (!place) return null;
  const w = wijk ? data.wijken[place.municipality]?.find((x) => x.name === wijk) : undefined;
  return { lat: (w ?? place).lat, lng: (w ?? place).lng };
}
