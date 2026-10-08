import { describe, expect, it } from "vitest";
import { isLimited, rateLimit, recordHit, resetHits } from "@/lib/rate-limit";

describe("rate limiter", () => {
  it("blocks after the limit when every call counts", () => {
    const k = "t1";
    for (let i = 0; i < 3; i++) expect(rateLimit(k, 3, 60_000)).toBe(true);
    expect(rateLimit(k, 3, 60_000)).toBe(false);
  });
  it("only counts recorded failures for login-style limits and resets on success", () => {
    const k = "t2";
    expect(isLimited(k, 2, 60_000)).toBe(false);
    recordHit(k);
    recordHit(k);
    expect(isLimited(k, 2, 60_000)).toBe(true);
    resetHits(k);
    expect(isLimited(k, 2, 60_000)).toBe(false);
  });
});
