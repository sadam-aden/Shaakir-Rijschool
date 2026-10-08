import "server-only";
import type { AppLocale } from "@/i18n/config";
import { db } from "@/lib/db";
import { getEmailProvider } from "@/lib/providers/email";
import { getSmsProvider } from "@/lib/providers/sms";
import { getSchoolSettings } from "@/lib/queries/settings";
import { buildIcs } from "./ics";
import { lessonMessage, type LessonTemplateKind } from "./templates";

type Channels = { sms: boolean; email: boolean };

async function loadLesson(lessonId: string) {
  return db.lesson.findUnique({
    where: { id: lessonId },
    include: { student: true, instructor: { select: { displayName: true } }, school: true },
  });
}

/**
 * Sends (and logs) a lesson message to the student in the student's own language.
 * Respects consent, never throws: failures are stored on the Notification row.
 */
export async function sendLessonNotification(lessonId: string, kind: LessonTemplateKind, channels: Channels) {
  const lesson = await loadLesson(lessonId);
  const student = lesson?.student;
  if (!lesson || !student) return;
  const { settings } = await getSchoolSettings(lesson.schoolId);
  const locale = student.locale as AppLocale;
  const msg = lessonMessage(kind, locale, {
    school: lesson.school.name, studentName: student.firstName, startsAt: lesson.startsAt, durationMin: lesson.durationMin,
    type: lesson.type, instructor: lesson.instructor.displayName, pickup: lesson.pickupAddress,
  });

  const log = async (channel: "EMAIL" | "SMS", send: () => Promise<{ id: string }>) => {
    const row = await db.notification.create({
      data: { schoolId: lesson.schoolId, studentId: student.id, channel, template: `lesson.${kind}`, locale, payload: { lessonId } },
    });
    try {
      const { id } = await send();
      await db.notification.update({ where: { id: row.id }, data: { status: "SENT", providerId: id, sentAt: new Date() } });
    } catch (e) {
      await db.notification.update({ where: { id: row.id }, data: { status: "FAILED", error: String(e).slice(0, 300) } });
    }
  };

  if (channels.email && student.emailConsent && student.email) {
    const attachments =
      kind === "cancellation"
        ? undefined
        : [{
            filename: "les.ics", contentType: "text/calendar",
            content: buildIcs({
              uid: lesson.id, startsAt: lesson.startsAt, endsAt: lesson.endsAt, summary: `${lesson.school.name} · ${lesson.instructor.displayName}`,
              location: lesson.pickupAddress, description: msg.text,
            }),
          }];
    await log("EMAIL", () =>
      getEmailProvider().send({ to: student.email!, subject: msg.subject, text: msg.text, fromName: lesson.school.name, attachments }),
    );
  }
  if (channels.sms && student.smsConsent && student.phone) {
    await log("SMS", () => getSmsProvider().send({ to: student.phone!, body: msg.sms, sender: settings.smsSender }));
  }
}

/** Queues the 24 h reminder (sent by the reminder job in Phase 2). */
export async function scheduleReminder(lessonId: string, channels: Channels) {
  const lesson = await loadLesson(lessonId);
  if (!lesson?.student) return;
  const { settings } = await getSchoolSettings(lesson.schoolId);
  const when = new Date(lesson.startsAt.getTime() - 24 * 3_600_000);
  if (!settings.reminder24h || when <= new Date()) return;
  const locale = lesson.student.locale;
  const rows = (["EMAIL", "SMS"] as const)
    .filter((c) => (c === "EMAIL" ? channels.email : channels.sms))
    .map((channel) => ({
      schoolId: lesson.schoolId, studentId: lesson.student!.id, channel, template: "lesson.reminder24h", locale,
      scheduledFor: when, payload: { lessonId },
    }));
  if (rows.length) await db.notification.createMany({ data: rows });
}

/** Cancels queued reminders for a lesson that moved or was cancelled. */
export async function dropQueuedReminders(lessonId: string) {
  await db.notification.updateMany({
    where: { status: "QUEUED", template: "lesson.reminder24h", payload: { path: ["lessonId"], equals: lessonId } },
    data: { status: "SKIPPED" },
  });
}

/** Sends a free-form message (e.g. top-up request) to a student in their language, with consent checks and logging. */
export async function sendStudentMessage(
  studentId: string,
  template: string,
  build: (ctx: { locale: AppLocale; school: string; studentName: string }) => { subject: string; text: string; sms: string },
  channels: Channels = { sms: true, email: true },
) {
  const student = await db.student.findUnique({ where: { id: studentId }, include: { school: true } });
  if (!student) return { sent: 0 };
  const { settings } = await getSchoolSettings(student.schoolId);
  const locale = student.locale as AppLocale;
  const msg = build({ locale, school: student.school.name, studentName: student.firstName });
  let sent = 0;
  const log = async (channel: "EMAIL" | "SMS", send: () => Promise<{ id: string }>) => {
    const row = await db.notification.create({ data: { schoolId: student.schoolId, studentId, channel, template, locale } });
    try {
      const { id } = await send();
      await db.notification.update({ where: { id: row.id }, data: { status: "SENT", providerId: id, sentAt: new Date() } });
      sent++;
    } catch (e) {
      await db.notification.update({ where: { id: row.id }, data: { status: "FAILED", error: String(e).slice(0, 300) } });
    }
  };
  if (channels.email && student.emailConsent && student.email) {
    await log("EMAIL", () => getEmailProvider().send({ to: student.email!, subject: msg.subject, text: msg.text, fromName: student.school.name }));
  }
  if (channels.sms && student.smsConsent && student.phone) {
    await log("SMS", () => getSmsProvider().send({ to: student.phone!, body: msg.sms, sender: settings.smsSender }));
  }
  return { sent };
}
