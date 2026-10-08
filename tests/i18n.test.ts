import { describe, expect, it } from "vitest";
import nl from "../messages/nl.json";
import en from "../messages/en.json";

function keys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("i18n key parity", () => {
  const a = keys(nl).sort();
  const b = keys(en).sort();
  it("has no key that exists only in nl.json", () => {
    expect(a.filter((k) => !b.includes(k))).toEqual([]);
  });
  it("has no key that exists only in en.json", () => {
    expect(b.filter((k) => !a.includes(k))).toEqual([]);
  });
});
