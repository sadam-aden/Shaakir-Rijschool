/** Maps PDOK Locatieserver address documents to the suggestions shown in the student form. Pure, so it can be unit tested. */
export type PdokAddressDoc = {
  weergavenaam?: string;
  straatnaam?: string;
  huisnummer?: number;
  huisletter?: string;
  huisnummertoevoeging?: string;
  postcode?: string;
  woonplaatsnaam?: string;
  wijknaam?: string;
  centroide_ll?: string;
};

export type AddressSuggestion = {
  /** what goes into the address field, e.g. "Oostzeedijk 12A" */
  address: string;
  postcode: string;
  city: string;
  wijk: string | null;
  lat: number;
  lng: number;
};

const point = (p?: string) => {
  const m = /POINT\(([\d.]+) ([\d.]+)\)/.exec(p ?? "");
  return m ? { lng: Math.round(Number(m[1]) * 1e6) / 1e6, lat: Math.round(Number(m[2]) * 1e6) / 1e6 } : null;
};

/** Postcodes are shown as "3063 BB". */
export const formatPostcode = (p: string) => p.replace(/^(\d{4})\s?([A-Za-z]{2})$/, (_, d, l) => `${d} ${String(l).toUpperCase()}`);

/**
 * Apartment variants ("12A-01", "12A-02") collapse to one suggestion per house number + letter,
 * so the list stays short; the user can add the extension by hand.
 */
export function mapAddressDocs(docs: PdokAddressDoc[], limit = 8): AddressSuggestion[] {
  const seen = new Set<string>();
  const out: AddressSuggestion[] = [];
  for (const d of docs) {
    const c = point(d.centroide_ll);
    if (!d.straatnaam || d.huisnummer == null || !d.postcode || !d.woonplaatsnaam || !c) continue;
    const address = `${d.straatnaam} ${d.huisnummer}${d.huisletter ?? ""}`;
    const key = `${address}|${d.postcode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ address, postcode: formatPostcode(d.postcode), city: d.woonplaatsnaam, wijk: d.wijknaam ?? null, lat: c.lat, lng: c.lng });
    if (out.length >= limit) break;
  }
  return out;
}

/** Solr filter values are quoted; strip anything that could break out of the quotes. */
export const solrValue = (v: string) => `"${v.replace(/["\\]/g, "")}"`;
