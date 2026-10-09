import { describe, expect, it } from "vitest";
import { formatDutchPhone, isDutchMobile, normalizeDutchPhone, phoneSearchVariants } from "@/lib/domain/phone";

describe("Dutch phone numbers", () => {
  it.each([
    ["06 12345678", "+31612345678"],
    ["0612345678", "+31612345678"],
    ["06-12 34 56 78", "+31612345678"],
    ["+31 6 12345678", "+31612345678"],
    ["+31 (0)6 12345678", "+31612345678"],
    ["0031 6 12345678", "+31612345678"],
    ["010 1234567", "+31101234567"],
    ["+31 20 123 4567", "+31201234567"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeDutchPhone(input)).toBe(expected);
  });

  it.each(["+44 7911 123456", "+32 470 12 34 56", "0044 7911 123456", "06 1234567", "06 123456789", "0800 1234", "0900 1234567", "abc", "", "12345678"])(
    "rejects %s",
    (input) => {
      expect(normalizeDutchPhone(input)).toBeNull();
    },
  );

  it("is idempotent for stored numbers", () => {
    expect(normalizeDutchPhone("+31612345678")).toBe("+31612345678");
  });
  it("recognises mobiles", () => {
    expect(isDutchMobile("+31612345678")).toBe(true);
    expect(isDutchMobile("+31101234567")).toBe(false);
  });
  it("formats for display", () => {
    expect(formatDutchPhone("+31612345678")).toBe("06 12345678");
    expect(formatDutchPhone("+31101234567")).toBe("010 1234567");
    expect(formatDutchPhone("+31715123456")).toBe("071 5123456");
    expect(formatDutchPhone(null)).toBe("");
  });
  it("finds students by national or international digits", () => {
    expect(phoneSearchVariants("06 1234")).toEqual(["061234", "3161234"]);
    expect(phoneSearchVariants("12")).toEqual([]);
  });
});
