import { describe, expect, it } from "vitest";
import { explanationFactors, rankSlots } from "@/lib/domain/best-fit";
import type { SlotContext } from "@/lib/domain/check-slot";
import { fitsAvailability, groupByPart, windowsFor } from "@/lib/domain/availability";
import { estimateReadiness, deriveStatus } from "@/lib/domain/student-status";
import { zonedToUtc, localParts } from "@/lib/domain/time";

const at = (h: number, m = 0) => zonedToUtc(2026, 9, 30, h, m);
const day = { year: 2026, month: 9, day: 30 };

function ctx(): SlotContext {
  return {
    settings: { travelBufferMin: 10 },
    instructor: {
      id: "i1", maxMinutesPerDay: 480, defaultVehicleId: "kia",
      workingHours: [{ weekday: 3, startMin: 480, endMin: 1200 }], timeOff: [],
      busy: [
        { id: "a", kind: "LESSON", label: "Julia", startsAt: at(9), endsAt: at(10) },
        { id: "b", kind: "LESSON", label: "Daan", startsAt: at(10, 30), endsAt: at(11, 30) },
        { id: "t", kind: "THEORY", label: "Theory", startsAt: at(13), endsAt: at(14, 30) },
      ],
    },
    student: { id: "s", minutesAvailable: 480, unavailability: [], busy: [], availability: [{ weekday: 3, part: "MORNING" }, { weekday: 3, part: "AFTERNOON" }] },
    vehicles: [{ id: "kia", name: "Kia", gearbox: "AUTOMATIC", status: "ACTIVE", apkDueDate: null, unavailability: [], busy: [] }],
  };
}

describe("rankSlots", () => {
  const ranked = rankSlots(ctx(), { type: "PRACTICAL", gearbox: "AUTOMATIC" }, day, 90);
  it("marks exactly one best slot, and it is valid", () => {
    const best = ranked.filter((s) => s.best);
    expect(best).toHaveLength(1);
    expect(best[0].ok).toBe(true);
  });
  it("only offers 90 min slots that fit inside the availability", () => {
    const ok = ranked.filter((s) => s.ok);
    expect(ok.length).toBeGreaterThan(0);
    for (const s of ok) expect(fitsAvailability([{ weekday: 3, part: "MORNING" }, { weekday: 3, part: "AFTERNOON" }], s.startsAt, s.endsAt)).toBe(true);
  });
  it("prefers the slot right after the theory group (no dead time)", () => {
    const best = ranked.find((s) => s.best)!;
    expect(localParts(best.startsAt).minutes).toBe(14 * 60 + 45);
    expect(explanationFactors(best).some((f) => f.key === "adjacentBefore")).toBe(true);
  });
  it("reports clashes as disabled slots with reasons", () => {
    const clash = ranked.find((s) => localParts(s.startsAt).minutes === 9 * 60 + 30)!;
    expect(clash.ok).toBe(false);
    expect(clash.conflicts[0].key).toBe("instructorBusy");
  });
});

describe("availability helpers", () => {
  it("merges adjacent day parts into one window", () => {
    const a = [{ weekday: 3, part: "MORNING" as const }, { weekday: 3, part: "AFTERNOON" as const }];
    expect(windowsFor(a, 3)).toEqual([[480, 1020]]);
  });
  it("groups weekdays per day part", () => {
    const a = [{ weekday: 3, part: "MORNING" as const }, { weekday: 6, part: "MORNING" as const }, { weekday: 2, part: "EVENING" as const }];
    expect(groupByPart(a)).toEqual([{ part: "MORNING", days: [3, 6] }, { part: "EVENING", days: [2] }]);
  });
});

describe("derived student status", () => {
  const now = new Date("2026-10-08T10:00:00Z");
  const base = { status: "ACTIVE" as const, track: "PRACTICAL" as const, minutesAvailable: 600, hasUpcomingLesson: true, exams: [], now };
  it("exam requested beats everything", () => {
    expect(deriveStatus({ ...base, minutesAvailable: 30, exams: [{ kind: "PRACTICAL", status: "REQUESTED", scheduledAt: null }] }).kind).toBe("examRequested");
  });
  it("CBR exam beats theory exam and low hours", () => {
    const exams = [
      { kind: "THEORY" as const, status: "SCHEDULED", scheduledAt: new Date("2026-10-12T08:00:00Z") },
      { kind: "PRACTICAL" as const, status: "SCHEDULED", scheduledAt: new Date("2026-10-11T08:00:00Z") },
    ];
    expect(deriveStatus({ ...base, minutesAvailable: 30, exams }).kind).toBe("cbrExam");
  });
  it("low hours, unscheduled, theory only, active in that order", () => {
    expect(deriveStatus({ ...base, minutesAvailable: 150, hasUpcomingLesson: false }).kind).toBe("lowHours");
    expect(deriveStatus({ ...base, hasUpcomingLesson: false }).kind).toBe("unscheduled");
    expect(deriveStatus({ ...base, track: "THEORY_ONLY" }).kind).toBe("theoryOnly");
    expect(deriveStatus(base).kind).toBe("active");
  });
  it("ignores past exams", () => {
    const exams = [{ kind: "PRACTICAL" as const, status: "SCHEDULED", scheduledAt: new Date("2026-10-01T08:00:00Z") }];
    expect(deriveStatus({ ...base, exams }).kind).toBe("active");
  });
  it("estimates exam readiness from skills", () => {
    expect(estimateReadiness([90, 85, 82, 80], 20)).toEqual({ readiness: "READY", lessonsLeft: 0 });
    const r = estimateReadiness([60, 60, 60, 60], 12);
    expect(r.readiness).toBe("NEEDS_LESSONS");
    expect(r.lessonsLeft).toBe(4);
  });
});

import { pickDisplaySlots } from "@/lib/domain/best-fit";

describe("pickDisplaySlots", () => {
  it("includes the best fit, spaces OK slots, sorts by time and adds blocked reasons", () => {
    const ranked = rankSlots(ctx(), { type: "PRACTICAL", gearbox: "AUTOMATIC" }, day, 60);
    const shown = pickDisplaySlots(ranked);
    expect(shown.some((s) => s.best)).toBe(true);
    const times = shown.map((s) => +s.startsAt);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    const ok = shown.filter((s) => s.ok);
    for (let i = 1; i < ok.length; i++) expect(+ok[i].startsAt - +ok[i - 1].startsAt).toBeGreaterThanOrEqual(30 * 60_000);
    expect(shown.some((s) => !s.ok && s.conflicts[0].key === "instructorBusy")).toBe(true);
  });
});
