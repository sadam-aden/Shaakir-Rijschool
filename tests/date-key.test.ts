import { describe, expect, it } from "vitest";
import { addDays, isoWeekdayOfKey, mondayOfKey, nextWorkingDay } from "@/lib/date-key";

describe("date keys", () => {
  it("does calendar maths without timezone surprises", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30"); // across the DST change
    expect(isoWeekdayOfKey("2026-10-11")).toBe(7);
    expect(mondayOfKey("2026-10-14")).toBe("2026-10-12");
  });
  it("finds the next working day, skipping Sundays", () => {
    const mon_sat = [1, 2, 3, 4, 5, 6];
    expect(nextWorkingDay("2026-10-11", mon_sat)).toBe("2026-10-12"); // Sunday → Monday
    expect(nextWorkingDay("2026-10-13", mon_sat)).toBe("2026-10-13");
    expect(nextWorkingDay("2026-10-13", [])).toBe("2026-10-13");
    expect(nextWorkingDay("2026-10-13", [5])).toBe("2026-10-16");
  });
});
