"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { fail, ok } from "@/lib/action-result";
import { approveDraft, discardDraft, generateDraft, previewSchedule, removeDraftLesson, type GenerateOutcome } from "@/lib/dal/schedule";
import { requireUser } from "@/lib/dal/session";
import { addDays } from "@/lib/date-key";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function refresh() {
  revalidatePath("/agenda");
  revalidatePath("/lessen");
  revalidatePath("/leerlingen");
  revalidatePath("/");
}

/** Constraint preview shown in the "Generate schedule" dialog and on the dashboard banner. */
export async function previewScheduleAction(input: { instructorId?: string; dateKey: string }) {
  const user = await requireUser();
  const p = z.object({ instructorId: z.string().optional(), dateKey }).safeParse(input);
  if (!p.success) return fail("invalid");
  return previewSchedule(user, p.data.instructorId, p.data.dateKey, (await getLocale()) as "nl" | "en");
}

const generateSchema = z.object({ instructorId: z.string().optional(), from: dateKey, to: dateKey.optional(), replace: z.boolean().optional() });

/** Generates one draft per day (range of at most 14 days) for one instructor. */
export async function generateScheduleAction(input: z.input<typeof generateSchema>) {
  const user = await requireUser();
  const p = generateSchema.safeParse(input);
  if (!p.success) return fail("invalid");
  const { from, replace } = p.data;
  const to = p.data.to ?? from;
  if (to < from) return fail("invalid");
  const locale = (await getLocale()) as "nl" | "en";

  const days: { dateKey: string; outcome?: GenerateOutcome; error?: string }[] = [];
  for (let k = from, n = 0; k <= to && n < 14; k = addDays(k, 1), n++) {
    const r = await generateDraft(user, { instructorId: p.data.instructorId, dateKey: k, replace }, locale);
    days.push(r.ok ? { dateKey: k, outcome: r.data } : { dateKey: k, error: r.error });
  }
  refresh();
  if (days.every((d) => d.error === "draftExists")) return fail("draftExists");
  return ok({ days });
}

const notifySchema = z.object({ sms: z.boolean(), email: z.boolean(), reminder: z.boolean() });

/** Approve & notify students. */
export async function approveDraftAction(draftId: string, notify: z.input<typeof notifySchema>) {
  const user = await requireUser();
  const n = notifySchema.safeParse(notify);
  if (!n.success) return fail("invalid");
  const r = await approveDraft(user, draftId, n.data, (await getLocale()) as "nl" | "en");
  if (r.ok) refresh();
  return r;
}

export async function discardDraftAction(draftId: string) {
  const user = await requireUser();
  const r = await discardDraft(user, draftId);
  if (r.ok) refresh();
  return r;
}

/** Take a single lesson out of a draft during review. */
export async function removeDraftLessonAction(lessonId: string) {
  const user = await requireUser();
  const r = await removeDraftLesson(user, lessonId);
  if (r.ok) refresh();
  return r;
}
