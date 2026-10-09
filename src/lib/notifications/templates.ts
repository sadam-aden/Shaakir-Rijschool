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

type MoneyVars = { school: string; studentName: string; number: string; total: string; owed: string; due: string; payUrl?: string | null; description?: string };

/** The invoice itself (PDF attached to the e-mail) with an optional iDEAL link. */
export function invoiceMessage(locale: AppLocale, v: MoneyVars) {
  const nl = locale === "nl";
  const link = v.payUrl ? (nl ? `\n\nBetaal direct met iDEAL: ${v.payUrl}` : `\n\nPay directly with iDEAL: ${v.payUrl}`) : "";
  return {
    subject: nl ? `Factuur ${v.number} · ${v.school}` : `Invoice ${v.number} · ${v.school}`,
    text: nl
      ? `Beste ${v.studentName},\n\nin de bijlage vind je factuur ${v.number}${v.description ? ` voor ${v.description}` : ""} van ${v.total}. Betaal graag vóór ${v.due}.${link}\n\n${v.school}`
      : `Dear ${v.studentName},\n\nattached is invoice ${v.number}${v.description ? ` for ${v.description}` : ""} for ${v.total}. Please pay before ${v.due}.${link}\n\n${v.school}`,
    sms: nl ? `${v.school}: factuur ${v.number} (${v.total}), betaal vóór ${v.due}.${v.payUrl ? ` ${v.payUrl}` : ""}` : `${v.school}: invoice ${v.number} (${v.total}), pay before ${v.due}.${v.payUrl ? ` ${v.payUrl}` : ""}`,
  };
}

/** "Send iDEAL link": just the amount and the link. */
export function paymentLinkMessage(locale: AppLocale, v: MoneyVars & { payUrl: string }) {
  const nl = locale === "nl";
  return {
    subject: nl ? `Betaallink factuur ${v.number} · ${v.school}` : `Payment link for invoice ${v.number} · ${v.school}`,
    text: nl
      ? `Beste ${v.studentName},\n\nje kunt ${v.owed} van factuur ${v.number} direct betalen met iDEAL:\n${v.payUrl}\n\n${v.school}`
      : `Dear ${v.studentName},\n\nyou can pay ${v.owed} of invoice ${v.number} directly with iDEAL:\n${v.payUrl}\n\n${v.school}`,
    sms: nl ? `${v.school}: betaal ${v.owed} (factuur ${v.number}) met iDEAL: ${v.payUrl}` : `${v.school}: pay ${v.owed} (invoice ${v.number}) with iDEAL: ${v.payUrl}`,
  };
}

/** Level 1 = friendly nudge (3 days overdue), level 2 = firmer (10 days overdue). */
export function reminderMessage(locale: AppLocale, level: number, v: MoneyVars & { days: number }) {
  const nl = locale === "nl";
  const link = v.payUrl ? (nl ? `\n\nBetaal direct met iDEAL: ${v.payUrl}` : `\n\nPay directly with iDEAL: ${v.payUrl}`) : "";
  const firm = level >= 2;
  return {
    subject: nl ? `${firm ? "Tweede herinnering" : "Herinnering"}: factuur ${v.number} · ${v.school}` : `${firm ? "Second reminder" : "Reminder"}: invoice ${v.number} · ${v.school}`,
    text: nl
      ? `Beste ${v.studentName},\n\n${firm ? `ondanks eerdere herinnering hebben we factuur ${v.number} nog niet ontvangen.` : `we zagen dat factuur ${v.number} nog openstaat.`} Het openstaande bedrag is ${v.owed} (${v.days} dagen na de vervaldatum). ${firm ? "Wil je dit direct voldoen?" : "Heb je al betaald? Dan kun je dit bericht negeren."}${link}\n\n${v.school}`
      : `Dear ${v.studentName},\n\n${firm ? `despite an earlier reminder we have not yet received invoice ${v.number}.` : `we noticed invoice ${v.number} is still open.`} The outstanding amount is ${v.owed} (${v.days} days past the due date). ${firm ? "Please pay it right away." : "If you have already paid, please ignore this message."}${link}\n\n${v.school}`,
    sms: nl ? `${v.school}: factuur ${v.number} staat nog open (${v.owed}).${v.payUrl ? ` Betaal met iDEAL: ${v.payUrl}` : ""}` : `${v.school}: invoice ${v.number} is still open (${v.owed}).${v.payUrl ? ` Pay with iDEAL: ${v.payUrl}` : ""}`,
  };
}

/** Top-up request with the new package and its iDEAL link. */
export function topUpOfferMessage(locale: AppLocale, v: { school: string; studentName: string; hoursLeft: string; packageName: string; price: string; payUrl: string }) {
  const nl = locale === "nl";
  return {
    subject: nl ? `Je lesuren raken op · ${v.school}` : `You are running low on lesson hours · ${v.school}`,
    text: nl
      ? `Beste ${v.studentName},\n\nje hebt nog ${v.hoursLeft} over in je lespakket. Wil je door blijven rijden? Bestel ${v.packageName} (${v.price}) en betaal direct met iDEAL:\n${v.payUrl}\n\n${v.school}`
      : `Dear ${v.studentName},\n\nyou have ${v.hoursLeft} left in your package. Want to keep going? Order ${v.packageName} (${v.price}) and pay directly with iDEAL:\n${v.payUrl}\n\n${v.school}`,
    sms: nl ? `${v.school}: nog ${v.hoursLeft} over. ${v.packageName} (${v.price}) betalen met iDEAL: ${v.payUrl}` : `${v.school}: ${v.hoursLeft} left. Pay for ${v.packageName} (${v.price}) with iDEAL: ${v.payUrl}`,
  };
}
