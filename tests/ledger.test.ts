import { describe, expect, it } from "vitest";
import {
  canBook, consumeLines, isChargeableCancellation, releaseLines, reserveLines, resizeLines, summarize, type LedgerLine,
} from "@/lib/domain/ledger";

const purchase: LedgerLine = { type: "PURCHASE", minutes: 600 };

describe("hours ledger", () => {
  it("a purchase adds remaining and available hours", () => {
    expect(summarize([purchase])).toEqual({ remaining: 600, reserved: 0, available: 600 });
  });
  it("booking reserves hours without consuming them", () => {
    expect(summarize([purchase, ...reserveLines(90)])).toEqual({ remaining: 600, reserved: 90, available: 510 });
  });
  it("completing releases the reservation and consumes the hours", () => {
    expect(summarize([purchase, ...reserveLines(90), ...consumeLines(90)])).toEqual({ remaining: 510, reserved: 0, available: 510 });
  });
  it("free cancellation returns the hours", () => {
    expect(summarize([purchase, ...reserveLines(60), ...releaseLines(60)])).toEqual({ remaining: 600, reserved: 0, available: 600 });
  });
  it("chargeable cancellation / no-show consumes the hours", () => {
    expect(summarize([purchase, ...reserveLines(60), ...consumeLines(60)]).remaining).toBe(540);
  });
  it("adjustments and refunds change remaining hours", () => {
    expect(summarize([purchase, { type: "ADJUST", minutes: 30 }, { type: "REFUND", minutes: -60 }]).remaining).toBe(570);
  });
  it("resizing a planned lesson holds or frees the difference", () => {
    expect(resizeLines(60, 90)).toEqual([{ type: "RESERVE", minutes: -30 }]);
    expect(resizeLines(90, 60)).toEqual([{ type: "RELEASE", minutes: 30 }]);
    expect(resizeLines(60, 60)).toEqual([]);
  });
  it("rejects booking beyond available hours", () => {
    expect(canBook(60, 90)).toEqual({ ok: false, shortBy: 30 });
    expect(canBook(90, 90)).toEqual({ ok: true });
  });
  it("cancellation inside the 24 h window is chargeable", () => {
    const start = new Date("2026-10-10T10:00:00Z");
    expect(isChargeableCancellation(start, new Date("2026-10-09T12:00:00Z"), 24)).toBe(true);
    expect(isChargeableCancellation(start, new Date("2026-10-09T09:00:00Z"), 24)).toBe(false);
  });
});
