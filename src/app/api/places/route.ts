import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/dal/session";
import { loadProvince, provinces } from "@/lib/places";

/**
 * GET /api/places                       → the provinces
 * GET /api/places?province=zuid-holland → cities/villages and wijken of that province
 */
export async function GET(req: NextRequest) {
  if (!(await getSessionUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("province");
  if (!slug) return NextResponse.json({ provinces: provinces.map(({ name, slug }) => ({ name, slug })) });
  const data = await loadProvince(slug);
  if (!data) return NextResponse.json({ error: "notFound" }, { status: 404 });
  return NextResponse.json(
    { places: data.places.map((p) => ({ name: p.name, municipality: p.municipality })), wijken: Object.fromEntries(Object.entries(data.wijken).map(([m, l]) => [m, l.map((w) => w.name)])) },
    { headers: { "Cache-Control": "private, max-age=86400" } },
  );
}
