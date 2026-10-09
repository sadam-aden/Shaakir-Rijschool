import { describe, expect, it } from "vitest";
import { formatPostcode, mapAddressDocs, solrValue } from "@/lib/address";

const doc = (over: object = {}) => ({
  weergavenaam: "Oostzeedijk 12A-01, 3063BB Rotterdam", straatnaam: "Oostzeedijk", huisnummer: 12, huisletter: "A", huisnummertoevoeging: "01",
  postcode: "3063BB", woonplaatsnaam: "Rotterdam", wijknaam: "Kralingen-Crooswijk", centroide_ll: "POINT(4.51353396 51.91975247)", ...over,
});

describe("address suggestions", () => {
  it("maps a PDOK document", () => {
    expect(mapAddressDocs([doc()])).toEqual([
      { address: "Oostzeedijk 12A", postcode: "3063 BB", city: "Rotterdam", wijk: "Kralingen-Crooswijk", lat: 51.919752, lng: 4.513534 },
    ]);
  });
  it("collapses apartment variants into one suggestion", () => {
    const out = mapAddressDocs([doc(), doc({ huisnummertoevoeging: "02" }), doc({ huisletter: "B", huisnummertoevoeging: undefined })]);
    expect(out.map((o) => o.address)).toEqual(["Oostzeedijk 12A", "Oostzeedijk 12B"]);
  });
  it("skips incomplete documents and respects the limit", () => {
    expect(mapAddressDocs([doc({ postcode: undefined }), doc({ centroide_ll: undefined })])).toEqual([]);
    const many = Array.from({ length: 20 }, (_, i) => doc({ huisnummer: i + 1, huisletter: undefined }));
    expect(mapAddressDocs(many, 5)).toHaveLength(5);
  });
  it("formats postcodes and quotes filter values safely", () => {
    expect(formatPostcode("3063bb")).toBe("3063 BB");
    expect(solrValue('Zuid-Holland" OR provincienaam:*')).toBe('"Zuid-Holland OR provincienaam:*"');
  });
});
