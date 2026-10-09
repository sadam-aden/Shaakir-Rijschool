// One-off generator for src/data/places/<province>.json from the free PDOK Locatieserver (public Dutch open data).
// Run: node scripts/build-places.mjs      (the generated files are committed; the app never calls PDOK at runtime)
import fs from "node:fs";
import path from "node:path";

const BASE = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free";
const OUT = path.resolve("src/data/places");

const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const point = (p) => {
  const m = /POINT\(([\d.]+) ([\d.]+)\)/.exec(p ?? "");
  return m ? { lng: Math.round(Number(m[1]) * 1e4) / 1e4, lat: Math.round(Number(m[2]) * 1e4) / 1e4 } : null;
};

async function fetchAll(type, fields) {
  const rows = [];
  for (let start = 0; ; start += 100) {
    const url = `${BASE}?q=*&fq=type:${type}&rows=100&start=${start}&fl=${fields}&sort=${type === "wijk" ? "wijknaam" : "woonplaatsnaam"}%20asc`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`PDOK ${r.status}`);
    const j = await r.json();
    rows.push(...j.response.docs);
    if (start + 100 >= j.response.numFound) break;
  }
  return rows;
}

const places = await fetchAll("woonplaats", "woonplaatsnaam,gemeentenaam,provincienaam,centroide_ll");
const wijken = await fetchAll("wijk", "wijknaam,gemeentenaam,provincienaam,centroide_ll");
console.log(`fetched ${places.length} places and ${wijken.length} wijken`);

const byProvince = new Map();
const get = (name) => {
  if (!byProvince.has(name)) byProvince.set(name, { province: name, places: [], wijken: {} });
  return byProvince.get(name);
};
for (const p of places) {
  const c = point(p.centroide_ll);
  if (!p.provincienaam || !c) continue;
  get(p.provincienaam).places.push({ name: p.woonplaatsnaam, municipality: p.gemeentenaam, lat: c.lat, lng: c.lng });
}
for (const w of wijken) {
  const c = point(w.centroide_ll);
  if (!w.provincienaam || !c || !w.gemeentenaam) continue;
  const list = (get(w.provincienaam).wijken[w.gemeentenaam] ??= []);
  if (!list.some((x) => x.name === w.wijknaam)) list.push({ name: w.wijknaam, lat: c.lat, lng: c.lng });
}

fs.mkdirSync(OUT, { recursive: true });
const index = [];
for (const [name, data] of [...byProvince].sort((a, b) => a[0].localeCompare(b[0], "nl"))) {
  data.places.sort((a, b) => a.name.localeCompare(b.name, "nl"));
  for (const list of Object.values(data.wijken)) list.sort((a, b) => a.name.localeCompare(b.name, "nl"));
  fs.writeFileSync(path.join(OUT, `${slug(name)}.json`), JSON.stringify(data));
  index.push({ name, slug: slug(name), places: data.places.length });
}
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 1));
console.log(index.map((i) => `${i.name} (${i.places})`).join("\n"));
