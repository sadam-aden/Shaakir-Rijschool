import { describe, expect, it } from "vitest";
import { ageOn, isAtLeastAge, isValidDateKey } from "@/lib/domain/age";

describe("student age rule", () => {
  it("counts completed years", () => {
    expect(ageOn("2008-10-10", "2026-10-09")).toBe(17); // turns 18 tomorrow
    expect(ageOn("2008-10-09", "2026-10-09")).toBe(18); // turns 18 today
    expect(ageOn("2000-01-01", "2026-10-09")).toBe(26);
  });
  it("accepts exactly 18 and rejects younger", () => {
    expect(isAtLeastAge("2008-10-09", "2026-10-09")).toBe(true);
    expect(isAtLeastAge("2008-10-10", "2026-10-09")).toBe(false);
    expect(isAtLeastAge("2026-10-09", "2026-10-09")).toBe(false); // born today
  });
  it("handles 29 February birthdays", () => {
    expect(isAtLeastAge("2008-02-29", "2026-02-28")).toBe(false);
    expect(isAtLeastAge("2008-02-29", "2026-03-01")).toBe(true);
  });
  it("validates calendar dates", () => {
    expect(isValidDateKey("2000-02-30")).toBe(false);
    expect(isValidDateKey("2000-13-01")).toBe(false);
    expect(isValidDateKey("not-a-date")).toBe(false);
    expect(isValidDateKey("2000-02-29")).toBe(true);
  });
});

import { latestBirthDate } from "@/lib/domain/age";

describe("latestBirthDate", () => {
  it("is exactly 18 years before today", () => {
    expect(latestBirthDate("2026-10-09")).toBe("2008-10-09");
    expect(isAtLeastAge(latestBirthDate("2026-10-09"), "2026-10-09")).toBe(true);
  });
  it("copes with 29 February", () => {
    expect(latestBirthDate("2028-02-29")).toBe("2010-02-28");
    expect(isAtLeastAge("2010-02-28", "2028-02-29")).toBe(true);
    expect(isAtLeastAge("2010-03-01", "2028-02-29")).toBe(false);
  });
});
