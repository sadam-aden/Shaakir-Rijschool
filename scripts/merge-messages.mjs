// Usage: node scripts/merge-messages.mjs fragment.json
// Fragment shape: { "nl": { ... }, "en": { ... } } — deep-merged into messages/nl.json and messages/en.json.
import fs from "node:fs";

const frag = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const merge = (a, b) => {
  for (const [k, v] of Object.entries(b)) {
    a[k] = v && typeof v === "object" && !Array.isArray(v) ? merge(a[k] ?? {}, v) : v;
  }
  return a;
};
for (const l of ["nl", "en"]) {
  const p = `messages/${l}.json`;
  const cur = JSON.parse(fs.readFileSync(p, "utf8"));
  fs.writeFileSync(p, JSON.stringify(merge(cur, frag[l] ?? {}), null, 2) + "\n");
}
