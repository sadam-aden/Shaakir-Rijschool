import { afterEach, describe, expect, it, vi } from "vitest";
import { pseudonymise, restoreNames, summarizeDraft, templateSummary } from "@/lib/ai/summary";
import type { Candidate, SchedulerResult } from "@/lib/domain/scheduler";
import { zonedToUtc } from "@/lib/domain/time";

afterEach(() => vi.unstubAllGlobals());

const now = new Date("2026-10-12T08:00:00Z");
const result: SchedulerResult = {
  placements: [
    { studentId: "a", name: "Emma Visser", startsAt: zonedToUtc(2026, 10, 14, 9, 0), endsAt: zonedToUtc(2026, 10, 14, 10, 30), durationMin: 90, vehicleId: "v", pickup: { lat: 51.9, lng: 4.5 }, gearbox: "MANUAL", examCandidate: true },
    { studentId: "b", name: "Daan de Vries", startsAt: zonedToUtc(2026, 10, 14, 11, 0), endsAt: zonedToUtc(2026, 10, 14, 12, 0), durationMin: 60, vehicleId: "v", pickup: null, gearbox: "MANUAL", examCandidate: false },
  ],
  skipped: [{ studentId: "c", name: "Yusuf Demir", reason: "unpaidOverdue" }],
  stats: { candidates: 3, lessons: 2, minutes: 150, travelMinutes: 12, idleMinutes: 30, costBefore: 40, costAfter: 30 },
};
const candidates = [
  { studentId: "a", name: "Emma Visser", exam: { at: new Date("2026-10-15T08:00:00Z"), readiness: "READY", lessonsLeft: 0 }, examRequested: false },
  { studentId: "b", name: "Daan de Vries", exam: null, examRequested: false },
] as unknown as Candidate[];

describe("template summary (the fallback)", () => {
  it("writes Dutch and English text with the exam candidates and the reasons", () => {
    const nl = templateSummary(result, "nl", "Shaakir", ["Emma"]);
    expect(nl).toContain("2 lessen (2,5 u) ingepland voor Shaakir");
    expect(nl).toContain("Examenkandidaten staan voorop: Emma");
    expect(nl).toContain("Yusuf (te late factuur)");
    expect(templateSummary(result, "en", "Shaakir", [])).toContain("2 lessons (2,5 h) planned for Shaakir");
  });
});

describe("pseudonymisation", () => {
  it("replaces names by labels and keeps no personal data", () => {
    const { payload, labels } = pseudonymise(result, candidates, now);
    const json = JSON.stringify(payload);
    expect(json).not.toMatch(/Emma|Daan|Yusuf|Visser|51\.9/);
    expect(payload.lessons[0]).toMatchObject({ student: "S1", examCandidate: true, daysToExam: 3, start: "09:00", minutes: 90 });
    expect(restoreNames("S1 en S2 eerst, S3 niet.", labels)).toBe("Emma en Daan eerst, Yusuf niet.");
  });
});

describe("Claude summary", () => {
  it("is skipped without an API key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await summarizeDraft(result, candidates, now, "nl", "Shaakir", {});
    expect(r.byAi).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("sends only labels to the model and puts the names back in its answer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ content: [{ type: "text", text: "Twee lessen; S1 heeft binnenkort examen en staat eerst. S3 is niet ingepland." }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await summarizeDraft(result, candidates, now, "nl", "Shaakir", { ANTHROPIC_API_KEY: "sk-test" });
    expect(r.byAi).toBe(true);
    expect(r.text).toContain("Emma heeft binnenkort examen");
    expect(r.text).toContain("Yusuf is niet ingepland");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers["x-api-key"]).toBe("sk-test");
    expect(init.body).not.toMatch(/Emma|Daan|Yusuf|Visser/);
    expect(JSON.parse(init.body).messages[0].content).toContain("Dutch");
  });
  it("falls back to the template when the call fails or answers nonsense", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("{}", { status: 500 })).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(new Response(JSON.stringify({ content: [{ type: "text", text: "x".repeat(900) }] }), { status: 200 })));
    for (let i = 0; i < 3; i++) {
      const r = await summarizeDraft(result, candidates, now, "en", "Shaakir", { ANTHROPIC_API_KEY: "sk-test" });
      expect(r.byAi).toBe(false);
      expect(r.text).toContain("planned for Shaakir");
    }
  });
});
