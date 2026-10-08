import { describe, expect, it } from "vitest";
import { buildIcs } from "@/lib/notifications/ics";
import { lessonMessage } from "@/lib/notifications/templates";
import { zonedToUtc } from "@/lib/domain/time";

const v = {
  school: "Shaakir Rijschool", studentName: "Kim", startsAt: zonedToUtc(2026, 9, 30, 11, 30), durationMin: 90,
  type: "PRACTICAL" as const, instructor: "Shaakir", pickup: "Oostzeedijk, Kralingen",
};

describe("lesson messages", () => {
  it("writes Dutch confirmations with a 24 h clock", () => {
    const m = lessonMessage("confirmation", "nl", v);
    expect(m.subject).toContain("Bevestiging praktijkles");
    expect(m.text).toContain("woensdag 30 september 2026 om 11:30");
    expect(m.text).toContain("Ophaaladres: Oostzeedijk, Kralingen");
  });
  it("writes English messages in the student's language", () => {
    const m = lessonMessage("reminder24h", "en", v);
    expect(m.subject).toContain("Reminder");
    expect(m.sms).toMatch(/Wednesday,? 30 September 2026 at 11:30/);
  });
  it("keeps SMS short enough for two segments", () => {
    expect(lessonMessage("confirmation", "nl", v).sms.length).toBeLessThan(300);
  });
});

describe("ICS", () => {
  it("builds a valid event in UTC with escaped text", () => {
    const ics = buildIcs({ uid: "abc", startsAt: v.startsAt, endsAt: new Date(+v.startsAt + 90 * 60000), summary: "Les; test", location: "Kralingen, Rotterdam", now: new Date("2026-09-01T00:00:00Z") });
    expect(ics).toContain("DTSTART:20260930T093000Z");
    expect(ics).toContain("DTEND:20260930T110000Z");
    expect(ics).toContain("SUMMARY:Les\\; test");
    expect(ics).toContain("LOCATION:Kralingen\\, Rotterdam");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  });
});
