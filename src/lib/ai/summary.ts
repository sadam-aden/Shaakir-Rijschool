import type { Candidate, SchedulerResult, SkipReason } from "@/lib/domain/scheduler";
import { isExamCandidate } from "@/lib/domain/scheduler";
import { localParts } from "@/lib/domain/time";

/**
 * Short human summary of a generated draft.
 *
 * The LLM (Claude) is used for wording only. It never sees names, addresses or contact details, never decides
 * anything about the schedule, and the app works without it: without ANTHROPIC_API_KEY, or when the call fails,
 * a template summary is used instead.
 */
type Locale = "nl" | "en";

const REASONS: Record<Locale, Record<SkipReason, string>> = {
  nl: {
    noHours: "geen uren meer", unpaidOverdue: "te late factuur", notAvailableThatDay: "die dag niet beschikbaar", outsideAvailability: "geen vrij tijdstip binnen de beschikbaarheid",
    studentUnavailable: "die dag afwezig", noCar: "geen lesauto vrij", dayFull: "de dag zit vol", noSlot: "geen passend tijdstip", tooFarAway: "ophaaladres te ver van de andere lessen",
  },
  en: {
    noHours: "no hours left", unpaidOverdue: "overdue invoice", notAvailableThatDay: "not available that day", outsideAvailability: "no free time inside their availability",
    studentUnavailable: "away that day", noCar: "no car free", dayFull: "the day is full", noSlot: "no suitable time", tooFarAway: "pick-up too far from the other lessons",
  },
};

export const skipReasonText = (locale: Locale, r: SkipReason) => REASONS[locale][r];

const hm = (min: number) => `${Math.floor(min / 60)}${min % 60 ? `,${Math.round(((min % 60) / 60) * 10)}` : ""}`;

/** Template summary (also the fallback). */
export function templateSummary(result: SchedulerResult, locale: Locale, instructorName: string, examNames: string[]) {
  const { lessons, minutes } = result.stats;
  const nl = locale === "nl";
  const parts = [
    nl
      ? `${lessons} ${lessons === 1 ? "les" : "lessen"} (${hm(minutes)} u) ingepland voor ${instructorName}, allemaal binnen de beschikbaarheid van de leerling.`
      : `${lessons} ${lessons === 1 ? "lesson" : "lessons"} (${hm(minutes)} h) planned for ${instructorName}, all inside the student's availability.`,
  ];
  if (examNames.length) parts.push(nl ? `Examenkandidaten staan voorop: ${examNames.join(", ")}.` : `Exam candidates come first: ${examNames.join(", ")}.`);
  if (result.skipped.length) {
    const shown = result.skipped.slice(0, 3).map((s) => `${s.name.split(" ")[0]} (${REASONS[locale][s.reason]})`).join(", ");
    parts.push(nl ? `${result.skipped.length} leerlingen niet ingepland: ${shown}${result.skipped.length > 3 ? "…" : ""}.` : `${result.skipped.length} students not planned: ${shown}${result.skipped.length > 3 ? "…" : ""}.`);
  }
  return parts.join(" ");
}

/** What the model may see: labels instead of names, times and counts only. */
export function pseudonymise(result: SchedulerResult, candidates: Candidate[], now: Date) {
  const labels = new Map<string, { label: string; firstName: string }>();
  const label = (id: string, name: string) => {
    if (!labels.has(id)) labels.set(id, { label: `S${labels.size + 1}`, firstName: name.split(" ")[0] });
    return labels.get(id)!.label;
  };
  const byId = new Map(candidates.map((c) => [c.studentId, c]));
  const payload = {
    lessons: result.placements.map((p) => {
      const c = byId.get(p.studentId);
      const m = localParts(p.startsAt).minutes;
      return {
        student: label(p.studentId, p.name),
        start: `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
        minutes: p.durationMin,
        examCandidate: c ? isExamCandidate(c, now) : false,
        daysToExam: c?.exam ? Math.max(0, Math.round((+c.exam.at - +now) / 86_400_000)) : null,
      };
    }),
    notPlanned: result.skipped.map((s) => ({ student: label(s.studentId, s.name), reason: s.reason })),
    totals: { lessons: result.stats.lessons, minutes: result.stats.minutes, driveMinutes: result.stats.travelMinutes, idleMinutes: result.stats.idleMinutes },
  };
  return { payload, labels };
}

/** Puts the first names back into the model's text (S1 → Daan). */
export function restoreNames(text: string, labels: Map<string, { label: string; firstName: string }>) {
  let out = text;
  for (const { label, firstName } of labels.values()) out = out.replace(new RegExp(`\\b${label}\\b`, "g"), firstName);
  return out;
}

export async function summarizeDraft(
  result: SchedulerResult, candidates: Candidate[], now: Date, locale: Locale, instructorName: string,
  env: Record<string, string | undefined> = process.env,
): Promise<{ text: string; byAi: boolean }> {
  const examNames = result.placements.filter((p) => p.examCandidate).map((p) => p.name.split(" ")[0]);
  const fallback = { text: templateSummary(result, locale, instructorName, examNames), byAi: false };
  const key = env.ANTHROPIC_API_KEY;
  if (!key) return fallback;

  const { payload, labels } = pseudonymise(result, candidates, now);
  const language = locale === "nl" ? "Dutch" : "English";
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-5-5",
        max_tokens: 220,
        messages: [{
          role: "user",
          content:
            `You write a short note for a driving instructor about an automatically generated lesson schedule for one day. ` +
            `Write at most two sentences in ${language}. Mention how many lessons and hours were planned, whether exam candidates were placed first, ` +
            `and (briefly) why some students could not be planned. Use the student labels exactly as given (S1, S2, …), invent nothing, and add no greeting.\n\n` +
            JSON.stringify(payload),
        }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return fallback;
    const j = (await r.json()) as { content?: { type: string; text?: string }[] };
    const raw = j.content?.find((c) => c.type === "text")?.text?.trim();
    if (!raw || raw.length > 600) return fallback;
    return { text: restoreNames(raw, labels), byAi: true };
  } catch {
    return fallback;
  }
}
