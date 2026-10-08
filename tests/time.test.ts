import { describe, expect, it } from "vitest";
import { greetingKey, isoWeek, isoWeekday, localParts, startOfIsoWeek, zonedToUtc } from "@/lib/domain/time";

describe("Europe/Amsterdam time handling", () => {
  it("converts winter local time (UTC+1)", () => {
    expect(zonedToUtc(2026, 1, 15, 9, 0).toISOString()).toBe("2026-01-15T08:00:00.000Z");
  });
  it("converts summer local time (UTC+2)", () => {
    expect(zonedToUtc(2026, 7, 15, 9, 0).toISOString()).toBe("2026-07-15T07:00:00.000Z");
  });
  it("handles the spring-forward day (29 March 2026 is 23 hours long)", () => {
    expect(zonedToUtc(2026, 3, 29, 1, 0).toISOString()).toBe("2026-03-29T00:00:00.000Z");
    expect(zonedToUtc(2026, 3, 29, 8, 0).toISOString()).toBe("2026-03-29T06:00:00.000Z");
    const a = zonedToUtc(2026, 3, 29, 0, 0).getTime();
    const b = zonedToUtc(2026, 3, 30, 0, 0).getTime();
    expect((b - a) / 3600000).toBe(23);
  });
  it("handles the fall-back day (25 October 2026 is 25 hours long)", () => {
    const a = zonedToUtc(2026, 10, 25, 0, 0).getTime();
    const b = zonedToUtc(2026, 10, 26, 0, 0).getTime();
    expect((b - a) / 3600000).toBe(25);
    expect(zonedToUtc(2026, 10, 25, 8, 0).toISOString()).toBe("2026-10-25T07:00:00.000Z");
  });
  it("round-trips through localParts", () => {
    const d = zonedToUtc(2026, 9, 28, 8, 30);
    expect(localParts(d)).toMatchObject({ year: 2026, month: 9, day: 28, minutes: 510 });
  });
  it("computes ISO week and weekday (28 Sep 2026 = Monday, week 40)", () => {
    const d = zonedToUtc(2026, 9, 28, 12, 0);
    expect(isoWeek(d)).toEqual({ week: 40, year: 2026 });
    expect(isoWeekday(d)).toBe(1);
  });
  it("uses the local date near midnight", () => {
    expect(isoWeekday(new Date("2026-09-27T23:30:00Z"))).toBe(1);
  });
  it("finds the Monday start of the week across DST", () => {
    const d = zonedToUtc(2026, 10, 28, 12, 0);
    expect(startOfIsoWeek(d).toISOString()).toBe(zonedToUtc(2026, 10, 26, 0, 0).toISOString());
  });
  it("picks the greeting by local hour", () => {
    expect(greetingKey(zonedToUtc(2026, 9, 28, 8, 0))).toBe("morning");
    expect(greetingKey(zonedToUtc(2026, 9, 28, 14, 0))).toBe("afternoon");
    expect(greetingKey(zonedToUtc(2026, 9, 28, 20, 0))).toBe("evening");
  });
});
