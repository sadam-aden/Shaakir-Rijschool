import { describe, expect, it } from "vitest";
import { dueState } from "@/lib/domain/due";

const now = new Date("2026-10-08T12:00:00Z");

describe("dueState", () => {
  it("has no state without a date", () => expect(dueState(null, now)).toEqual({ kind: "none" }));
  it("is ok beyond 30 days", () => expect(dueState(new Date("2026-12-01"), now)).toEqual({ kind: "ok", days: 54 }));
  it("is soon within 30 days", () => expect(dueState(new Date("2026-10-30"), now)).toEqual({ kind: "soon", days: 22 }));
  it("is today on the due date", () => expect(dueState(new Date("2026-10-08"), now)).toEqual({ kind: "today" }));
  it("is overdue after the due date", () => expect(dueState(new Date("2026-10-01"), now)).toEqual({ kind: "overdue", days: 7 }));
});
