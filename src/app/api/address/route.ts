import { NextResponse, type NextRequest } from "next/server";
import { mapAddressDocs, solrValue, type PdokAddressDoc } from "@/lib/address";
import { getSessionUser } from "@/lib/dal/session";
import { rateLimit } from "@/lib/rate-limit";

const PDOK = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest";

/**
 * GET /api/address?q=oostz&province=Zuid-Holland&city=Rotterdam
 * Address suggestions inside the chosen province (and city) from the free PDOK Locatieserver.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!rateLimit(`address:${user.id}`, 120, 60_000)) return NextResponse.json({ error: "tooMany" }, { status: 429 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const province = (req.nextUrl.searchParams.get("province") ?? "").trim();
  const city = (req.nextUrl.searchParams.get("city") ?? "").trim();
  if (q.length < 3 || q.length > 80 || !province) return NextResponse.json({ suggestions: [] });

  const url = new URL(PDOK);
  url.searchParams.set("q", q);
  url.searchParams.append("fq", "type:adres");
  url.searchParams.append("fq", `provincienaam:${solrValue(province)}`);
  if (city) url.searchParams.append("fq", `woonplaatsnaam:${solrValue(city)}`);
  url.searchParams.set("rows", "30");
  url.searchParams.set("fl", "weergavenaam,straatnaam,huisnummer,huisletter,huisnummertoevoeging,postcode,woonplaatsnaam,wijknaam,centroide_ll");

  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000), next: { revalidate: 3600 } });
    if (!r.ok) throw new Error(String(r.status));
    const j = (await r.json()) as { response?: { docs?: PdokAddressDoc[] } };
    return NextResponse.json({ suggestions: mapAddressDocs(j.response?.docs ?? []) });
  } catch {
    // the address service is optional: typing the address by hand always works
    return NextResponse.json({ suggestions: [], unavailable: true });
  }
}
