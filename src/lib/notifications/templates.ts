import type { AppLocale } from "@/i18n/config";
import { formatDateLong, formatTime } from "@/lib/format";

export type LessonTemplateKind = "confirmation" | "change" | "cancellation" | "reminder24h";

type Vars = {
  school: string;
  studentName: string;
  startsAt: Date;
  durationMin: number;
  type: "PRACTICAL" | "THEORY" | "EXAM";
  instructor: string;
  pickup?: string | null;
};

const typeName = {
  nl: { PRACTICAL: "praktijkles", THEORY: "theorieles", EXAM: "CBR-examen" },
  en: { PRACTICAL: "practical lesson", THEORY: "theory lesson", EXAM: "CBR exam" },
} as const;

/** Text for e-mail and SMS in the student's language. Plain text on purpose: robust for every mail client and SMS. */
export function lessonMessage(kind: LessonTemplateKind, locale: AppLocale, v: Vars) {
  const when = `${formatDateLong(v.startsAt, locale)} ${locale === "nl" ? "om" : "at"} ${formatTime(v.startsAt, locale)}`;
  const what = typeName[locale][v.type];
  const where = v.pickup ? (locale === "nl" ? ` Ophaaladres: ${v.pickup}.` : ` Pick-up: ${v.pickup}.`) : "";
  const nl = locale === "nl";

  const subject = {
    confirmation: nl ? `Bevestiging ${what} · ${v.school}` : `Confirmation of your ${what} · ${v.school}`,
    change: nl ? `Wijziging ${what} · ${v.school}` : `Change to your ${what} · ${v.school}`,
    cancellation: nl ? `Annulering ${what} · ${v.school}` : `Cancellation of your ${what} · ${v.school}`,
    reminder24h: nl ? `Herinnering: ${what} morgen · ${v.school}` : `Reminder: ${what} tomorrow · ${v.school}`,
  }[kind];

  const body = {
    confirmation: nl
      ? `Beste ${v.studentName},\n\nje ${what} (${v.durationMin} min) met ${v.instructor} is ingepland op ${when}.${where}\n\nTot dan!\n${v.school}`
      : `Dear ${v.studentName},\n\nyour ${what} (${v.durationMin} min) with ${v.instructor} is scheduled for ${when}.${where}\n\nSee you then!\n${v.school}`,
    change: nl
      ? `Beste ${v.studentName},\n\nje ${what} is gewijzigd. De nieuwe tijd is ${when}.${where}\n\n${v.school}`
      : `Dear ${v.studentName},\n\nyour ${what} has been changed. The new time is ${when}.${where}\n\n${v.school}`,
    cancellation: nl
      ? `Beste ${v.studentName},\n\nje ${what} op ${when} is geannuleerd.\n\n${v.school}`
      : `Dear ${v.studentName},\n\nyour ${what} on ${when} has been cancelled.\n\n${v.school}`,
    reminder24h: nl
      ? `Beste ${v.studentName},\n\nherinnering: je ${what} is ${when}.${where}\n\n${v.school}`
      : `Dear ${v.studentName},\n\nreminder: your ${what} is ${when}.${where}\n\n${v.school}`,
  }[kind];

  const sms = {
    confirmation: nl ? `${v.school}: je ${what} is ingepland op ${when}.${where}` : `${v.school}: your ${what} is scheduled for ${when}.${where}`,
    change: nl ? `${v.school}: je ${what} is verplaatst naar ${when}.` : `${v.school}: your ${what} has moved to ${when}.`,
    cancellation: nl ? `${v.school}: je ${what} op ${when} is geannuleerd.` : `${v.school}: your ${what} on ${when} is cancelled.`,
    reminder24h: nl ? `${v.school}: herinnering, je ${what} is ${when}.${where}` : `${v.school}: reminder, your ${what} is ${when}.${where}`,
  }[kind];

  return { subject, text: body, sms };
}

/** "Running low on hours" message to a student (an iDEAL payment link is added in Phase 2). */
export function topUpMessage(locale: AppLocale, v: { school: string; studentName: string; hoursLeft: string }) {
  const nl = locale === "nl";
  return {
    subject: nl ? `Je lesuren raken op · ${v.school}` : `You are running low on lesson hours · ${v.school}`,
    text: nl
      ? `Beste ${v.studentName},\n\nje hebt nog ${v.hoursLeft} over in je lespakket. Wil je door blijven rijden? Neem contact met ons op voor een aanvullend pakket.\n\n${v.school}`
      : `Dear ${v.studentName},\n\nyou have ${v.hoursLeft} left in your package. Would you like to keep going? Contact us for an additional package.\n\n${v.school}`,
    sms: nl
      ? `${v.school}: je hebt nog ${v.hoursLeft} over. Neem contact op voor een aanvullend pakket.`
      : `${v.school}: you have ${v.hoursLeft} left. Contact us for an additional package.`,
  };
}
