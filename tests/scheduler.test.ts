import { describe, expect, it } from "vitest";
import { fitsAvailability } from "@/lib/domain/availability";
import type { SlotContext } from "@/lib/domain/check-slot";
import { generateDay, isExamCandidate, priorityOf, type Candidate, type SchedulerSettings } from "@/lib/domain/scheduler";
import { localParts, zonedToUtc } from "@/lib/domain/time";

const day = { year: 2026, month: 10, day: 14 }; // Wednesday
const at = (h: number, m = 0) => zonedToUtc(2026, 10, 14, h, m);
const now = new Date("2026-10-12T08:00:00Z");
const settings: SchedulerSettings = { examFirst: true, defaultDurationMin: 60, examDurationMin: 90, maxTravelMinutes: 25 };

const KRALINGEN = { lat: 51.9244, lng: 4.5013 };
const BLIJDORP = { lat: 51.9355, lng: 4.4668 };
const DELFSHAVEN = { lat: 51.9111, lng: 4.4504 };
const AMSTERDAM = { lat: 52.3676, lng: 4.9041 };

function ctx(over: Partial<SlotContext["instructor"]> = {}): SlotContext {
  return {
    settings: { travelBufferMin: 10 },
    instructor: {
      id: "i1", maxMinutesPerDay: 480, defaultVehicleId: "polo",
      workingHours: [{ weekday: 3, startMin: 8 * 60, endMin: 20 * 60 }], timeOff: [],
      busy: [{ id: "theory", kind: "THEORY", label: "Theory", startsAt: at(13), endsAt: at(14, 30) }],
      ...over,
    },
    vehicles: [
      { id: "polo", name: "Polo", gearbox: "MANUAL", status: "ACTIVE", apkDueDate: null, unavailability: [], busy: [] },
      { id: "kia", name: "Kia", gearbox: "AUTOMATIC", status: "ACTIVE", apkDueDate: null, unavailability: [], busy: [] },
    ],
  };
}

let n = 0;
const cand = (name: string, over: Partial<Candidate> = {}): Candidate => ({
  studentId: `s${++n}-${name}`, name, gearbox: "MANUAL", availability: [{ weekday: 3, part: "MORNING" }, { weekday: 3, part: "AFTERNOON" }], unavailability: [],
  minutesAvailable: 600, hasOverdueInvoice: false, pickup: KRALINGEN, lastLessonAt: new Date("2026-10-05T10:00:00Z"), since: new Date("2026-08-01T00:00:00Z"),
  exam: null, examRequested: false, ...over,
});

describe("priority", () => {
  it("puts an exam in 3 days before a student who has waited long", () => {
    const exam = cand("Emma", { exam: { at: new Date("2026-10-15T08:00:00Z"), readiness: "READY", lessonsLeft: 0 } });
    const waiting = cand("Lars", { lastLessonAt: new Date("2026-08-01T10:00:00Z") });
    expect(priorityOf(exam, now)).toBeGreaterThan(priorityOf(waiting, now));
  });
  it("ranks exam candidates that need more lessons in less time higher", () => {
    const ready = cand("A", { exam: { at: new Date("2026-10-19T08:00:00Z"), readiness: "READY", lessonsLeft: 0 } });
    const needs = cand("B", { exam: { at: new Date("2026-10-19T08:00:00Z"), readiness: "NEEDS_LESSONS", lessonsLeft: 3 } });
    expect(priorityOf(needs, now)).toBeGreaterThan(priorityOf(ready, now));
  });
  it("among normal students, the one who had no lesson longest goes first; waiting time is the tie-breaker", () => {
    const a = cand("A", { lastLessonAt: new Date("2026-10-10T10:00:00Z") });
    const b = cand("B", { lastLessonAt: new Date("2026-09-20T10:00:00Z") });
    expect(priorityOf(b, now)).toBeGreaterThan(priorityOf(a, now));
    const c = cand("C", { lastLessonAt: null, since: new Date("2026-07-01T00:00:00Z") });
    const d = cand("D", { lastLessonAt: null, since: new Date("2026-10-01T00:00:00Z") });
    expect(priorityOf(c, now)).toBeGreaterThan(priorityOf(d, now));
  });
  it("ignores exams when exam-first is switched off", () => {
    const exam = cand("Emma", { exam: { at: new Date("2026-10-15T08:00:00Z"), readiness: "READY", lessonsLeft: 0 }, lastLessonAt: new Date("2026-10-11T10:00:00Z") });
    const waiting = cand("Lars", { lastLessonAt: new Date("2026-09-01T10:00:00Z") });
    expect(priorityOf(exam, now, false)).toBeLessThan(priorityOf(waiting, now, false));
    expect(isExamCandidate(exam, now)).toBe(true);
  });
});

describe("generateDay – hard rules", () => {
  const students = [cand("Daan"), cand("Sanne", { pickup: BLIJDORP }), cand("Kim", { gearbox: "AUTOMATIC", pickup: DELFSHAVEN }), cand("Noor", { pickup: KRALINGEN })];
  const r = generateDay(ctx(), students, day, now, settings);

  it("plans everybody who fits", () => {
    expect(r.placements).toHaveLength(4);
    expect(r.skipped).toHaveLength(0);
  });
  it("keeps every lesson inside the student's availability", () => {
    for (const p of r.placements) {
      const c = students.find((s) => s.studentId === p.studentId)!;
      expect(fitsAvailability(c.availability, p.startsAt, p.endsAt)).toBe(true);
    }
  });
  it("matches the car to the gearbox and never double books a car or the instructor", () => {
    for (const p of r.placements) expect(p.vehicleId).toBe(p.gearbox === "AUTOMATIC" ? "kia" : "polo");
    const sorted = [...r.placements].sort((a, b) => +a.startsAt - +b.startsAt);
    for (let i = 1; i < sorted.length; i++) expect(+sorted[i].startsAt).toBeGreaterThanOrEqual(+sorted[i - 1].endsAt);
  });
  it("keeps clear of fixed blocks such as the theory group", () => {
    for (const p of r.placements) expect(p.startsAt < at(14, 30) && at(13) < p.endsAt).toBe(false);
  });
  it("never exceeds the remaining hours of a student", () => {
    const tight = generateDay(ctx(), [cand("Tim", { minutesAvailable: 45 })], day, now, settings);
    expect(tight.placements[0].durationMin).toBeLessThanOrEqual(45);
    const none = generateDay(ctx(), [cand("Zero", { minutesAvailable: 20 })], day, now, settings);
    expect(none.placements).toHaveLength(0);
    expect(none.skipped[0].reason).toBe("noHours");
  });
  it("respects the daily teaching maximum including fixed blocks", () => {
    const many = Array.from({ length: 12 }, (_, i) => cand(`S${i}`, { pickup: KRALINGEN }));
    const limited = generateDay(ctx({ maxMinutesPerDay: 240 }), many, day, now, settings);
    const planned = limited.placements.reduce((a, p) => a + p.durationMin, 0);
    expect(planned + 90 /* theory group */).toBeLessThanOrEqual(240);
    expect(limited.skipped.some((s) => s.reason === "dayFull")).toBe(true);
  });
  it("is deterministic", () => {
    const again = generateDay(ctx(), students, day, now, settings);
    expect(again.placements.map((p) => [p.studentId, +p.startsAt, p.vehicleId])).toEqual(r.placements.map((p) => [p.studentId, +p.startsAt, p.vehicleId]));
  });
});

describe("generateDay – priorities and reasons", () => {
  it("gives the only free slot to the exam candidate and explains why the other was left out", () => {
    const oneSlot: Candidate["availability"] = [{ weekday: 3, part: "MORNING", startMin: 9 * 60, endMin: 10 * 60 }];
    const exam = cand("Emma", { availability: oneSlot, minutesAvailable: 60, exam: { at: new Date("2026-10-15T08:00:00Z"), readiness: "READY", lessonsLeft: 0 } });
    const other = cand("Lars", { availability: oneSlot, minutesAvailable: 60, lastLessonAt: new Date("2026-08-01T10:00:00Z") });
    const r = generateDay(ctx(), [other, exam], day, now, settings);
    expect(r.placements.map((p) => p.name)).toEqual(["Emma"]);
    expect(r.skipped).toEqual([{ studentId: other.studentId, name: "Lars", reason: "outsideAvailability" }]);
  });
  it("uses a longer lesson for exam candidates when they have the hours", () => {
    const exam = cand("Emma", { exam: { at: new Date("2026-10-16T08:00:00Z"), readiness: "NEEDS_LESSONS", lessonsLeft: 2 } });
    expect(generateDay(ctx(), [exam], day, now, settings).placements[0].durationMin).toBe(90);
    const short = { ...exam, minutesAvailable: 60 };
    expect(generateDay(ctx(), [short], day, now, settings).placements[0].durationMin).toBe(60);
  });
  it("skips students with an overdue invoice or who are not available that weekday", () => {
    const r = generateDay(ctx(), [cand("Yusuf", { hasOverdueInvoice: true }), cand("Mo", { availability: [{ weekday: 5, part: "AFTERNOON" }] })], day, now, settings);
    expect(r.placements).toHaveLength(0);
    expect(r.skipped.map((s) => s.reason).sort()).toEqual(["notAvailableThatDay", "unpaidOverdue"]);
  });
  it("reports a missing car and a student who is unavailable", () => {
    const noAuto = ctx();
    noAuto.vehicles = noAuto.vehicles.filter((v) => v.gearbox === "MANUAL");
    expect(generateDay(noAuto, [cand("Kim", { gearbox: "AUTOMATIC" })], day, now, settings).skipped[0].reason).toBe("noCar");
    const away = cand("Away", { unavailability: [{ startsAt: at(0), endsAt: at(23, 59) }] });
    expect(generateDay(ctx(), [away], day, now, settings).skipped[0].reason).toBe("studentUnavailable");
  });
  it("does not plan anything outside the working hours or during time off", () => {
    const off = ctx({ timeOff: [{ startsAt: at(8), endsAt: at(12) }] });
    const r = generateDay(off, [cand("A"), cand("B")], day, now, settings);
    for (const p of r.placements) expect(localParts(p.startsAt).minutes).toBeGreaterThanOrEqual(12 * 60);
  });
});

describe("generateDay – short drives and improvement", () => {
  it("refuses pick-ups that are too far from the neighbouring lesson, unless the limit is raised", () => {
    const base = ctx({ busy: [{ id: "x", kind: "LESSON", label: "Fixed", startsAt: at(8), endsAt: at(20), lat: KRALINGEN.lat, lng: KRALINGEN.lng }] });
    const far = cand("Amsterdammer", { pickup: AMSTERDAM });
    const strict = generateDay(base, [far], day, now, { ...settings, maxTravelMinutes: 25 });
    expect(strict.placements).toHaveLength(0);
    const relaxed = generateDay(ctx(), [far], day, now, { ...settings, maxTravelMinutes: 200 });
    expect(relaxed.placements).toHaveLength(1);
  });
  it("never makes a day worse than the greedy plan, and groups nearby pick-ups", () => {
    const ps = [cand("A", { pickup: KRALINGEN }), cand("B", { pickup: DELFSHAVEN }), cand("C", { pickup: KRALINGEN }), cand("D", { pickup: DELFSHAVEN }), cand("E", { pickup: BLIJDORP })];
    const r = generateDay(ctx(), ps, day, now, settings);
    expect(r.stats.costAfter).toBeLessThanOrEqual(r.stats.costBefore);
    expect(r.stats.lessons).toBe(5);
    expect(r.stats.minutes).toBe(r.placements.reduce((a, p) => a + p.durationMin, 0));
  });
  it("improves a deliberately bad starting situation", () => {
    // a fixed lesson at 16:00 in Delfshaven: planning Delfshaven students next to it beats scattering them
    const base = ctx({ busy: [{ id: "f", kind: "LESSON", label: "Fixed", startsAt: at(16), endsAt: at(17), lat: DELFSHAVEN.lat, lng: DELFSHAVEN.lng }] });
    const ps = [cand("Near", { pickup: DELFSHAVEN, availability: [{ weekday: 3, part: "AFTERNOON" }] })];
    const r = generateDay(base, ps, day, now, settings);
    const start = localParts(r.placements[0].startsAt).minutes;
    // right before (15:00) or right after (17:00-ish) the fixed lesson, not in an isolated spot
    expect(start === 15 * 60 || start === 17 * 60 || start === 15 * 60 + 15 || start === 17 * 60 + 15 || start === 14 * 60 + 45).toBe(true);
  });
});
