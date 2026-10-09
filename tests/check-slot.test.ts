import { describe, expect, it } from "vitest";
import { checkSlot, type SlotContext, type SlotInput } from "@/lib/domain/check-slot";
import { zonedToUtc } from "@/lib/domain/time";

// Wednesday 30 September 2026
const at = (h: number, m = 0) => zonedToUtc(2026, 9, 30, h, m);
const slot = (h: number, m: number, dur: number, extra: Partial<SlotInput> = {}): SlotInput => ({
  startsAt: at(h, m), endsAt: at(h, m + dur), type: "PRACTICAL", gearbox: "AUTOMATIC", ...extra,
});

function ctx(over: Partial<SlotContext> = {}): SlotContext {
  return {
    settings: { travelBufferMin: 10 },
    instructor: {
      id: "i1", maxMinutesPerDay: 480, defaultVehicleId: "polo",
      workingHours: [{ weekday: 3, startMin: 8 * 60, endMin: 20 * 60 }],
      timeOff: [],
      busy: [{ id: "l1", kind: "LESSON", label: "Daan", startsAt: at(10, 30), endsAt: at(11, 30) }],
    },
    student: {
      id: "s1", minutesAvailable: 480, unavailability: [], busy: [],
      availability: [{ weekday: 3, part: "MORNING" }, { weekday: 3, part: "AFTERNOON" }],
    },
    vehicles: [
      { id: "polo", name: "Polo", gearbox: "MANUAL", status: "ACTIVE", apkDueDate: null, unavailability: [], busy: [] },
      { id: "kia", name: "Kia", gearbox: "AUTOMATIC", status: "ACTIVE", apkDueDate: null, unavailability: [], busy: [] },
    ],
    ...over,
  };
}
const keys = (r: ReturnType<typeof checkSlot>) => r.conflicts.map((c) => c.key);

describe("checkSlot", () => {
  it("accepts a free slot and assigns a matching car", () => {
    const r = checkSlot(ctx(), slot(13, 0, 90));
    expect(r.ok).toBe(true);
    expect(r.vehicleId).toBe("kia");
  });
  it("rejects outside working hours", () => {
    expect(keys(checkSlot(ctx(), slot(6, 0, 60)))).toContain("outsideWorkingHours");
    expect(keys(checkSlot(ctx(), slot(19, 30, 60)))).toContain("outsideWorkingHours");
  });
  it("rejects time off", () => {
    const c = ctx();
    c.instructor.timeOff = [{ startsAt: at(12), endsAt: at(14) }];
    expect(keys(checkSlot(c, slot(13, 0, 60)))).toContain("instructorTimeOff");
  });
  it("reports an overlap with another lesson, naming it", () => {
    const r = checkSlot(ctx(), slot(10, 0, 60));
    expect(r.conflicts[0]).toEqual({ key: "instructorBusy", params: { with: "Daan" } });
  });
  it("enforces the travel buffer between lessons", () => {
    expect(keys(checkSlot(ctx(), slot(11, 35, 60)))).toContain("travelTooLong"); // 5 min gap < 10
    expect(keys(checkSlot(ctx(), slot(11, 45, 60)))).not.toContain("travelTooLong"); // 15 min gap
  });
  it("uses estimated driving time when both pickups have coordinates", () => {
    const c = ctx();
    c.instructor.busy[0] = { ...c.instructor.busy[0], lat: 51.9244, lng: 4.5013 };
    const far = { lat: 51.9528, lng: 4.5189 }; // Hillegersberg, ~3.5 km
    const r = checkSlot(c, slot(11, 35, 60, { pickup: far }));
    expect(r.conflicts.find((x) => x.key === "travelTooLong")?.params?.needed).toBeGreaterThan(5);
  });
  it("respects student availability, and an admin can override it", () => {
    const evening = slot(18, 0, 60);
    expect(keys(checkSlot(ctx(), evening))).toContain("outsideStudentAvailability");
    const o = checkSlot(ctx(), { ...evening, overrides: { availability: true } });
    expect(o.ok).toBe(true);
    expect(o.overridden.map((c) => c.key)).toContain("outsideStudentAvailability");
  });
  it("treats a student without availability as always available", () => {
    const c = ctx();
    c.student!.availability = [];
    expect(checkSlot(c, slot(18, 0, 60)).ok).toBe(true);
  });
  it("rejects student unavailability and student double booking", () => {
    const c = ctx();
    c.student!.unavailability = [{ startsAt: at(13), endsAt: at(14) }];
    c.student!.busy = [{ id: "x", kind: "LESSON", label: "Other", startsAt: at(15), endsAt: at(16) }];
    expect(keys(checkSlot(c, slot(13, 0, 60)))).toContain("studentUnavailable");
    expect(keys(checkSlot(c, slot(15, 0, 60)))).toContain("studentBusy");
  });
  it("blocks booking beyond remaining hours unless overridden", () => {
    const c = ctx();
    c.student!.minutesAvailable = 60;
    expect(keys(checkSlot(c, slot(13, 0, 90)))).toContain("notEnoughHours");
    expect(checkSlot(c, { ...slot(13, 0, 90), overrides: { hours: true } }).ok).toBe(true);
  });
  it("needs an ACTIVE car with the right gearbox that is free", () => {
    const c = ctx();
    c.vehicles[1].busy = [{ id: "other", startsAt: at(13), endsAt: at(14) }];
    const r = checkSlot(c, slot(13, 0, 60));
    expect(r.conflicts[0]).toEqual({ key: "noVehicle", params: { gearbox: "AUTOMATIC" } });
    c.vehicles[1].busy = [];
    c.vehicles[1].status = "IN_MAINTENANCE";
    expect(keys(checkSlot(c, slot(13, 0, 60)))).toContain("noVehicle");
  });
  it("says so when the school has no car of that type at all", () => {
    const c = ctx();
    c.vehicles = c.vehicles.filter((v) => v.gearbox !== "AUTOMATIC"); // only a manual car is registered
    const r = checkSlot(c, slot(13, 0, 60));
    expect(r.conflicts[0]).toEqual({ key: "noVehicleRegistered", params: { gearbox: "AUTOMATIC" } });
    // a car exists but is busy: that is a normal clash, not "not registered"
    const d = ctx();
    d.vehicles[1].busy = [{ id: "x", startsAt: at(13), endsAt: at(14) }];
    expect(checkSlot(d, slot(13, 0, 60)).conflicts[0].key).toBe("noVehicle");
  });
  it("blocks booking while an invoice is overdue, unless the school allows it or an admin overrides", () => {
    const c = ctx();
    c.student!.hasOverdueInvoice = true;
    expect(keys(checkSlot(c, slot(13, 0, 60)))).toContain("unpaidOverdue");
    const o = checkSlot(c, { ...slot(13, 0, 60), overrides: { payment: true } });
    expect(o.ok).toBe(true);
    expect(o.overridden.map((x) => x.key)).toContain("unpaidOverdue");
    c.settings.allowBookingOnUnpaid = true;
    expect(checkSlot(c, slot(13, 0, 60)).ok).toBe(true);
  });
  it("skips cars whose APK has expired", () => {
    const c = ctx();
    c.vehicles[1].apkDueDate = new Date("2026-09-01T00:00:00Z");
    expect(keys(checkSlot(c, slot(13, 0, 60)))).toContain("noVehicle");
  });
  it("prefers the instructor's default car, then the preferred one", () => {
    const c = ctx();
    c.vehicles.push({ id: "polo2", name: "Yaris", gearbox: "MANUAL", status: "ACTIVE", apkDueDate: null, unavailability: [], busy: [] });
    expect(checkSlot(c, slot(13, 0, 60, { gearbox: "MANUAL" })).vehicleId).toBe("polo");
    expect(checkSlot(c, slot(13, 0, 60, { gearbox: "MANUAL", preferredVehicleId: "polo2" })).vehicleId).toBe("polo2");
  });
  it("enforces the 8 hour teaching limit per day", () => {
    const c = ctx();
    c.instructor.busy = [{ id: "big", kind: "LESSON", label: "Block", startsAt: at(8), endsAt: at(15, 30) }]; // 7.5 h
    expect(keys(checkSlot(c, slot(16, 0, 60, { gearbox: "AUTOMATIC" })))).toContain("dayLimit");
  });
  it("ignores the lesson being edited", () => {
    const r = checkSlot(ctx(), slot(10, 30, 60, { excludeLessonId: "l1" }));
    expect(keys(r)).not.toContain("instructorBusy");
  });
  it("theory lessons need no car", () => {
    const r = checkSlot(ctx({ student: undefined }), slot(13, 0, 60, { type: "THEORY", gearbox: null }));
    expect(r.ok).toBe(true);
    expect(r.vehicleId).toBeNull();
  });
});
