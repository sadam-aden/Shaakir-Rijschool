import { describe, expect, it } from "vitest";
import { layoutOverlaps, snapMinutes } from "@/lib/domain/calendar-layout";

describe("calendar layout", () => {
  it("gives non-overlapping items the full width", () => {
    const l = layoutOverlaps([{ id: "a", startMin: 480, endMin: 540 }, { id: "b", startMin: 540, endMin: 600 }]);
    expect(l.get("a")).toEqual({ col: 0, cols: 1 });
    expect(l.get("b")).toEqual({ col: 0, cols: 1 });
  });
  it("splits overlapping items into columns", () => {
    const l = layoutOverlaps([{ id: "a", startMin: 480, endMin: 600 }, { id: "b", startMin: 540, endMin: 660 }, { id: "c", startMin: 610, endMin: 700 }]);
    expect(l.get("a")).toEqual({ col: 0, cols: 2 });
    expect(l.get("b")).toEqual({ col: 1, cols: 2 });
    expect(l.get("c")).toEqual({ col: 0, cols: 2 });
  });
  it("snaps to 15 minutes and clamps to the grid", () => {
    expect(snapMinutes(8 * 60 + 7, 60)).toBe(8 * 60);
    expect(snapMinutes(8 * 60 + 8, 60)).toBe(8 * 60 + 15);
    expect(snapMinutes(5 * 60, 60)).toBe(8 * 60);
    expect(snapMinutes(19 * 60 + 40, 90)).toBe(18 * 60 + 30);
  });
});
