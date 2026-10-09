import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { coordsFor, loadProvince, provinces, slugOfProvince } from "@/lib/places";

describe("Dutch places data", () => {
  it("has the 12 provinces", () => {
    expect(provinces).toHaveLength(12);
    expect(provinces.map((p) => p.name)).toContain("Zuid-Holland");
  });
  it("lists Rotterdam and its neighbourhoods under Zuid-Holland", async () => {
    const data = await loadProvince(slugOfProvince("Zuid-Holland")!);
    expect(data?.places.some((p) => p.name === "Rotterdam")).toBe(true);
    const wijken = data?.wijken["Rotterdam"]?.map((w) => w.name) ?? [];
    expect(wijken).toEqual(expect.arrayContaining(["Delfshaven", "Charlois", "Rotterdam Centrum"]));
  });
  it("returns villages too", async () => {
    const data = await loadProvince("zuid-holland");
    expect(data?.places.some((p) => p.name === "'s-Gravendeel")).toBe(true);
  });
  it("rejects unknown provinces", async () => {
    expect(await loadProvince("narnia")).toBeNull();
  });
  it("gives approximate coordinates, preferring the neighbourhood", async () => {
    const city = await coordsFor("Zuid-Holland", "Rotterdam");
    const wijk = await coordsFor("Zuid-Holland", "Rotterdam", "Delfshaven");
    expect(city!.lat).toBeCloseTo(51.92, 1);
    expect(wijk).not.toEqual(city);
    expect(await coordsFor("Zuid-Holland", "Atlantis")).toBeNull();
  });
});
