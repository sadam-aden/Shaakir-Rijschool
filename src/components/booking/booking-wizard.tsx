"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Flag, MapPin, Search, Sparkles, SquareLibrary, CarFront } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { bookLessonAction, enrollTheoryAction } from "@/app/actions/lessons";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import type { AppLocale } from "@/i18n/config";
import { groupByPart, type Avail } from "@/lib/domain/availability";
import type { Conflict } from "@/lib/domain/check-slot";
import type { Factor } from "@/lib/domain/best-fit";
import { addDays, dayNumber, formatKey, isoWeekdayOfKey, mondayOfKey, type DateKey } from "@/lib/date-key";
import { formatHours, formatTime } from "@/lib/format";
import { hoursNumber, weekdayShort } from "@/lib/i18n-format";
import { useBestFitText, useConflictText } from "@/lib/use-conflict-text";
import { cn } from "@/lib/utils";

export type StudentOption = {
  id: string; name: string; initials: string; gearbox: "MANUAL" | "AUTOMATIC"; minutesAvailable: number; minutesPurchased: number;
  lessonCount: number; availability: Avail[]; address: string | null; area: string | null;
};
export type InstructorOption = { id: string; displayName: string; workdays: number[] };
export type TheoryOption = { id: string; title: string; startsAt: string; endsAt: string; seats: number; capacity: number; enrolledStudentIds: string[] };

type Slot = {
  startsAt: string; endsAt: string; minutes: number; ok: boolean; best: boolean; conflicts: Conflict[];
  vehicleId: string | null; vehicleName: string | null; factors: Factor[];
};
type SlotResponse = {
  slots: Slot[]; dayItems: { id: string; kind: "LESSON" | "THEORY" | "EXAM"; label: string; startsAt: string; endsAt: string }[];
  dayMinutes: number; maxMinutes: number; studentAvailable: number;
};

type Type = "PRACTICAL" | "THEORY" | "EXAM";
const DURATIONS = [60, 90, 120];

type Props = {
  todayKey: DateKey; isAdmin: boolean; students: StudentOption[]; instructors: InstructorOption[];
  defaultInstructorId: string; theoryGroups: TheoryOption[];
};

export function BookingWizard({ todayKey, isAdmin, students, instructors, defaultInstructorId, theoryGroups }: Props) {
  const t = useTranslations("booking");
  const ts = useTranslations("booking.summary");
  const tt = useTranslations("lessonType");
  const tg = useTranslations("gearbox");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const toast = useToast();
  const qc = useQueryClient();
  const tErrs = useTranslations("errors");
  const tErr = (k: string) => (tErrs.has(k) ? tErrs(k) : tErrs("generic"));
  const conflictText = useConflictText();
  const bestFitText = useBestFitText();

  // ── state in the URL ──
  const studentId = sp.get("student") ?? "";
  const type = (sp.get("type") as Type) || "PRACTICAL";
  const duration = Number(sp.get("duration")) || 60;
  const date = (sp.get("date") as DateKey) || todayKey;
  const at = sp.get("at") ?? "";
  const instructorId = sp.get("instructor") ?? defaultInstructorId;
  const setParams = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const student = students.find((s) => s.id === studentId);
  const instructor = instructors.find((i) => i.id === instructorId) ?? instructors[0];

  // ── local (non-URL) state ──
  const [pickup, setPickup] = useState<string | null>(null);
  const [repeat, setRepeat] = useState(false);
  const [occurrences, setOccurrences] = useState(4);
  const [sms, setSms] = useState(true);
  const [reminder, setReminder] = useState(true);
  const [overrideAvail, setOverrideAvail] = useState(false);
  const [overrideHours, setOverrideHours] = useState(false);
  const [overridePayment, setOverridePayment] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [busy, setBusy] = useState(false);

  const pickupValue = pickup ?? student?.address ?? "";

  // ── slots ──
  const needsSlots = !!student && type !== "THEORY";
  const slotsQ = useQuery<SlotResponse>({
    queryKey: ["slots", studentId, instructorId, date, duration, type, locale, isAdmin && overrideAvail, isAdmin && overrideHours, isAdmin && overridePayment],
    enabled: needsSlots,
    queryFn: async () => {
      const q = new URLSearchParams({ studentId, instructorId, date, duration: String(duration), type, locale });
      if (isAdmin) {
        q.set("oa", overrideAvail ? "1" : "0");
        q.set("oh", overrideHours ? "1" : "0");
        q.set("op", overridePayment ? "1" : "0");
      }
      const r = await fetch(`/api/slots?${q}`);
      if (!r.ok) throw new Error("slots");
      return r.json();
    },
  });
  const slots = slotsQ.data?.slots;
  const selected = slots?.find((s) => s.startsAt === at && s.ok);

  // auto-select the best fit when nothing valid is selected
  useEffect(() => {
    if (!slots) return;
    if (!slots.some((s) => s.ok && s.startsAt === at)) {
      const best = slots.find((s) => s.best);
      setParams({ at: best?.startsAt ?? null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  // keep durations within the remaining hours
  useEffect(() => {
    if (student && type === "PRACTICAL" && !overrideHours && duration > student.minutesAvailable && student.minutesAvailable >= 30) {
      const fit = [...DURATIONS].reverse().find((d) => d <= student.minutesAvailable);
      if (fit) setParams({ duration: String(fit) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id, type]);

  // ── date strip ──
  const weekStart = mondayOfKey(date);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const studentDays = new Set(student?.availability.map((a) => a.weekday) ?? []);
  const workdays = new Set(instructor?.workdays ?? [1, 2, 3, 4, 5, 6]);

  const endTime = selected ? formatTime(new Date(selected.endsAt), locale) : "";
  const startTime = selected ? formatTime(new Date(selected.startsAt), locale) : "";
  const dayLabel = formatKey(date, locale, { weekday: "long", day: "numeric", month: "long" });

  // hours bar
  const purchased = student?.minutesPurchased || (student?.minutesAvailable ?? 0);
  const left = (student?.minutesAvailable ?? 0) - (type === "PRACTICAL" ? duration : 0);
  const used = Math.max(0, purchased - (student?.minutesAvailable ?? 0));

  async function confirm() {
    if (!student || !selected) return;
    setBusy(true);
    try {
      const r = await bookLessonAction({
        studentId: student.id, type: type === "EXAM" ? "EXAM" : "PRACTICAL", instructorId: instructorId, startsAt: selected.startsAt,
        durationMin: duration, pickupAddress: pickupValue || undefined, occurrences: repeat ? occurrences : 1,
        notify: { sms, email: sms, reminder },
        override: isAdmin && (overrideAvail || overrideHours || overridePayment) ? { availability: overrideAvail, hours: overrideHours, payment: overridePayment, reason: overrideReason } : undefined,
      });
      if (r.ok) {
        const d = r.data;
        toast.show("success", d.lessonIds.length > 1 ? ts("bookedMany", { n: d.lessonIds.length }) : ts("booked"));
        if (d.skipped.length) toast.show("error", ts("skipped", { n: d.skipped.length }));
        router.push(`/agenda?date=${date}`);
        router.refresh();
      } else {
        const msg = "conflicts" in r && Array.isArray((r as { conflicts?: Conflict[] }).conflicts)
          ? (r as { conflicts: Conflict[] }).conflicts.map(conflictText).join(" · ")
          : null;
        toast.show("error", msg ?? tErr(r.error));
        qc.invalidateQueries({ queryKey: ["slots"] });
      }
    } finally {
      setBusy(false);
    }
  }
  // ── day overview (right column) ──
  const dayList = (() => {
    const items = (slotsQ.data?.dayItems ?? []).map((d) => ({ key: d.id, kind: d.kind, label: d.label, at: new Date(d.startsAt), isNew: false }));
    if (selected && student) items.push({ key: "new", kind: "LESSON", label: t("glance.newLabel", { name: student.name.split(" ")[0] }), at: new Date(selected.startsAt), isNew: true });
    return items.sort((a, b) => +a.at - +b.at);
  })();
  const dayMinutes = (slotsQ.data?.dayMinutes ?? 0) + (selected ? duration : 0);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-8 rounded-2xl border border-line bg-card p-6">
        {/* 1 · student */}
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">{t("step1")}</h2>
          {student ? (
            <div className="flex items-center gap-4 rounded-2xl border border-primary bg-primary-faint p-4">
              <Avatar initials={student.initials} solid size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{student.name}</span>
                  <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-bold", student.gearbox === "AUTOMATIC" ? "bg-success-soft text-success-ink" : "bg-page text-muted")}>{tg(student.gearbox)}</span>
                </div>
                <div className="text-sm text-muted">
                  {student.lessonCount > 0 && <>{t("packageLine", { n: student.lessonCount })} · </>}
                  <b className="text-ink">{t("remainingLine", { h: formatHours(student.minutesAvailable, locale) })}</b>
                  {student.availability.length > 0 && <> · <AvailabilitySummary availability={student.availability} locale={locale} /></>}
                </div>
              </div>
              <StudentPicker students={students} onPick={(id) => setParams({ student: id, at: null })} label={t("change")} />
            </div>
          ) : (
            <StudentPicker students={students} onPick={(id) => setParams({ student: id, at: null })} label={t("chooseStudent")} primary />
          )}
        </section>

        {/* 2 · type + duration */}
        <section className="grid gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">{t("step2")}</h2>
            <div className="grid grid-cols-3 gap-3">
              {([
                ["PRACTICAL", CarFront, "bg-primary-soft text-primary"],
                ["THEORY", SquareLibrary, "bg-theory-soft text-theory-ink"],
                ["EXAM", Flag, "bg-exam text-white"],
              ] as const).map(([k, Icon, cls]) => (
                <button
                  key={k} type="button" aria-pressed={type === k}
                  onClick={() => setParams({ type: k === "PRACTICAL" ? null : k, at: null })}
                  className={cn("flex items-center gap-2.5 rounded-2xl border p-3 text-left text-sm font-bold transition", type === k ? "border-primary bg-primary-faint text-primary" : "border-line hover:bg-page")}
                >
                  <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", cls)}><Icon className="h-4 w-4" aria-hidden /></span>
                  {tt(k)}
                </button>
              ))}
            </div>
          </div>
          {type !== "THEORY" && (
            <div>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">{t("duration")}</h2>
              <div role="group" className="inline-flex rounded-2xl bg-page p-1.5">
                {DURATIONS.map((d) => {
                  const tooLong = type === "PRACTICAL" && !!student && !overrideHours && d > student.minutesAvailable;
                  return (
                    <button
                      key={d} type="button" disabled={tooLong} aria-pressed={duration === d} title={tooLong ? t("durationTooLong") : undefined}
                      onClick={() => setParams({ duration: d === 60 ? null : String(d), at: null })}
                      className={cn("rounded-xl px-5 py-2 text-sm font-bold transition disabled:opacity-40", duration === d ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink")}
                    >
                      {d === 60 || d === 120 ? d : t("durationOption", { n: d })}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {type === "THEORY" ? (
          <TheoryList groups={theoryGroups} student={student} />
        ) : (
          <>
            {/* 3 · date */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted">{t("step3")}</h2>
                <div className="flex items-center gap-3 text-xs font-semibold text-primary">
                  {student && <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-primary" />{t("isAvailable", { name: student.name.split(" ")[0] })}</span>}
                  <button type="button" aria-label={t("prevWeek")} className="rounded-lg p-1 text-muted hover:bg-page" onClick={() => setParams({ date: addDays(date, -7), at: null })}><ChevronLeft className="h-4 w-4" /></button>
                  <button type="button" aria-label={t("nextWeek")} className="rounded-lg p-1 text-muted hover:bg-page" onClick={() => setParams({ date: addDays(date, 7), at: null })}><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {week.map((k) => {
                  const wd = isoWeekdayOfKey(k);
                  const disabled = k < todayKey || !workdays.has(wd);
                  const active = k === date;
                  return (
                    <button
                      key={k} type="button" disabled={disabled} aria-pressed={active}
                      onClick={() => setParams({ date: k, at: null })}
                      className={cn("rounded-2xl border px-2 py-2.5 text-center transition", active ? "border-primary bg-primary text-white" : "border-line hover:bg-page", disabled && "opacity-40")}
                    >
                      <div className={cn("text-[11px] font-bold uppercase", active ? "text-white/80" : "text-muted")}>{weekdayShort(wd, locale)}</div>
                      <div className="text-xl font-bold">{dayNumber(k)}</div>
                      <div className="mt-0.5 flex h-1.5 justify-center">{studentDays.has(wd) && <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-white" : "bg-primary")} />}</div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 4 · time */}
            <section>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">{t("step4", { day: dayLabel })}</h2>
              {!student ? (
                <p className="text-sm text-muted">{t("chooseStudent")}</p>
              ) : slotsQ.isLoading ? (
                <p className="text-sm text-muted">{t("loadingSlots")}</p>
              ) : !slots || slots.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">{t("noSlots")}</p>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {slots.map((s) => {
                      const range = `${formatTime(new Date(s.startsAt), locale)} – ${formatTime(new Date(s.endsAt), locale)}`;
                      const isSel = s.ok && s.startsAt === at;
                      if (!s.ok) {
                        return (
                          <div key={s.startsAt} className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-page/50 px-4 py-3 text-sm text-muted">
                            <span className="font-semibold line-through">{range}</span>
                            <span className="text-right text-xs">{s.conflicts[0] ? conflictText(s.conflicts[0]) : ""}</span>
                          </div>
                        );
                      }
                      return (
                        <button
                          key={s.startsAt} type="button" aria-pressed={isSel} onClick={() => setParams({ at: s.startsAt })}
                          className={cn("flex items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition", isSel ? "border-primary bg-primary text-white" : "border-line hover:border-primary")}
                        >
                          <span>{range}</span>
                          {s.best && <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]", isSel ? "bg-white text-primary" : "bg-primary-soft text-primary")}><Sparkles className="h-3 w-3" aria-hidden />{t("bestFit")}</span>}
                        </button>
                      );
                    })}
                  </div>
                  {slots.find((s) => s.best) && (
                    <p className="mt-4 flex gap-3 rounded-2xl bg-primary-faint p-4 text-sm text-ink">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                      {(() => { const b = slots.find((x) => x.best)!; return bestFitText(formatTime(new Date(b.startsAt), locale), b.factors); })()}
                    </p>
                  )}
                </>
              )}
              {type === "EXAM" && <p className="mt-3 text-sm text-muted">{t("examNote")}</p>}
            </section>

            {/* pickup + repeat */}
            <section className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">{t("pickup")}</span>
                <span className="relative block">
                  <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                  <Input className="pl-10 font-semibold" value={pickupValue} placeholder={t("pickupPlaceholder")} onChange={(e) => setPickup(e.target.value)} />
                </span>
              </label>
              <div className="flex items-end gap-2">
                <label className="flex h-[42px] items-center gap-2 rounded-xl border border-line px-4 text-sm font-bold">
                  <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} /> {t("repeatWeekly")}
                </label>
                {repeat && (
                  <Select className="h-[42px] w-28" value={occurrences} onChange={(e) => setOccurrences(Number(e.target.value))} aria-label={t("repeatWeekly")}>
                    {[2, 4, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{t("repeatCount", { n })}</option>)}
                  </Select>
                )}
              </div>
            </section>
          </>
        )}

        {isAdmin && type !== "THEORY" && (
          <details className="rounded-2xl border border-line p-4 text-sm">
            <summary className="cursor-pointer font-bold">{t("override.title")}</summary>
            <div className="mt-3 space-y-2">
              <label className="flex items-center gap-2"><input type="checkbox" checked={overrideAvail} onChange={(e) => setOverrideAvail(e.target.checked)} /> {t("override.availability")}</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={overrideHours} onChange={(e) => setOverrideHours(e.target.checked)} /> {t("override.hours")}</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={overridePayment} onChange={(e) => setOverridePayment(e.target.checked)} /> {t("override.payment")}</label>
              {(overrideAvail || overrideHours || overridePayment) && <Field label={t("override.reason")}><Input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} /></Field>}
            </div>
          </details>
        )}
      </div>

      {/* right column */}
      <div className="space-y-6">
        <div className="rounded-2xl border border-line bg-card p-6">
          <h2 className="mb-4 text-lg font-bold">{ts("title")}</h2>
          <dl className="space-y-2.5 text-sm">
            <Row label={ts("student")}>{student?.name ?? "—"}</Row>
            <Row label={ts("lesson")}>{tt(type)}{type !== "THEORY" ? ` · ${duration} min` : ""}</Row>
            {type !== "THEORY" && <Row label={ts("when")}>{selected ? `${formatKey(date, locale, { weekday: "short", day: "numeric", month: "short" })} · ${startTime} – ${endTime}` : "—"}</Row>}
            {type !== "THEORY" && <Row label={ts("car")}><span className={student?.gearbox === "AUTOMATIC" ? "text-success-ink" : ""}>{selected?.vehicleName ?? (student ? tg(student.gearbox) : "—")}</span></Row>}
            {type !== "THEORY" && <Row label={ts("pickup")}>{pickupValue ? (pickupValue === student?.address && student?.area ? student.area : pickupValue.split(",")[0]) : "—"}</Row>}
          </dl>

          {type === "PRACTICAL" && student && (
            <div className="mt-5 rounded-2xl bg-primary-faint p-4">
              <div className="mb-2 flex justify-between text-sm font-bold">
                <span>{ts("hoursAfter")}</span>
                <span>{hoursNumber(student.minutesAvailable, locale)} → {formatHours(Math.max(0, left), locale)}</span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-primary-soft" aria-hidden>
                <span className="bg-muted/50" style={{ width: `${purchased ? (used / purchased) * 100 : 0}%` }} />
                <span className="bg-theory" style={{ width: `${purchased ? (Math.min(duration, student.minutesAvailable) / purchased) * 100 : 0}%` }} />
                <span className="bg-primary" style={{ width: `${purchased ? (Math.max(0, left) / purchased) * 100 : 0}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-[11px] font-bold">
                <span className="text-muted">{ts("used", { h: formatHours(used, locale) })}</span>
                <span className="text-warn-ink">{ts("thisLesson", { h: formatHours(duration, locale) })}</span>
                <span className="text-primary">{ts("left", { h: formatHours(Math.max(0, left), locale) })}</span>
              </div>
            </div>
          )}

          {type !== "THEORY" && (
            <>
              <div className="mt-5 space-y-3 text-sm font-semibold">
                <label className="flex items-center gap-3"><input type="checkbox" className="h-4 w-4" checked={sms} onChange={(e) => setSms(e.target.checked)} /> {ts("sms")}</label>
                <label className="flex items-center gap-3"><input type="checkbox" className="h-4 w-4" checked={reminder} onChange={(e) => setReminder(e.target.checked)} /> {ts("reminder")}</label>
              </div>
              {isAdmin && instructors.length > 1 && (
                <Field label={t("instructor")} className="mt-4">
                  <Select value={instructorId} onChange={(e) => setParams({ instructor: e.target.value, at: null })}>
                    {instructors.map((i) => <option key={i.id} value={i.id}>{i.displayName}</option>)}
                  </Select>
                </Field>
              )}
              <Button className="mt-5 w-full py-3" disabled={!student || !selected || busy || (isAdmin && (overrideAvail || overrideHours || overridePayment) && !overrideReason.trim())} onClick={confirm}>
                <Check className="h-4 w-4" aria-hidden /> {student && selected ? ts("confirm") : ts("selectFirst")}
              </Button>
            </>
          )}
        </div>

        {type !== "THEORY" && student && (
          <div className="rounded-2xl border border-line bg-card p-6">
            <h2 className="mb-4 text-lg font-bold">{t("glance.title", { day: formatKey(date, locale, { weekday: "long" }).replace(/^./, (c) => c.toUpperCase()) })}</h2>
            {dayList.length === 0 ? (
              <p className="text-sm text-muted">{t("glance.empty")}</p>
            ) : (
              <ul className="space-y-2">
                {dayList.map((d) => (
                  <li key={d.key} className="flex items-center gap-3 text-sm">
                    <span className={cn("w-12 text-xs font-bold", d.isNew ? "text-primary" : "text-muted")}>{formatTime(d.at, locale)}</span>
                    <span className={cn("flex-1 rounded-xl px-3 py-2 text-xs font-bold", d.isNew ? "border border-dashed border-primary bg-primary-faint text-primary" : d.kind === "THEORY" ? "bg-theory-soft text-theory-ink" : d.kind === "EXAM" ? "bg-exam text-white" : "bg-primary text-white")}>{d.label}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs font-bold text-muted">
              {t("glance.total", { hours: hoursNumber(dayMinutes, locale), max: hoursNumber(slotsQ.data?.maxMinutes ?? 480, locale) })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-bold">{children}</dd>
    </div>
  );
}

function AvailabilitySummary({ availability, locale }: { availability: Avail[]; locale: AppLocale }) {
  const tp = useTranslations("dayPartPlural");
  const t = useTranslations("booking");
  const text = groupByPart(availability).map((g) => `${g.days.map((d) => weekdayShort(d, locale)).join(" & ")} ${tp(g.part)}`).join(" · ");
  return <>{t("availableOn", { when: text })}</>;
}

function StudentPicker({ students, onPick, label, primary }: { students: StudentOption[]; onPick: (id: string) => void; label: string; primary?: boolean }) {
  const t = useTranslations("booking");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const list = students.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant={primary ? "primary" : "outline"}>{label}</Button></DialogTrigger>
      <DialogContent title={t("chooseStudent")} closeLabel={tc("close")}>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input autoFocus className="pl-10" placeholder={t("searchStudent")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {list.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => { onPick(s.id); setOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-primary-faint">
                <Avatar initials={s.initials} size="sm" />
                <span className="flex-1 text-sm font-bold">{s.name}</span>
                <span className="text-xs text-muted">{formatHoursShort(s.minutesAvailable)}</span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
const formatHoursShort = (m: number) => `${Math.round((m / 60) * 10) / 10} h`;

function TheoryList({ groups, student }: { groups: TheoryOption[]; student?: StudentOption }) {
  const t = useTranslations("booking.theory");
  const locale = useLocale() as AppLocale;
  const toast = useToast();
  const router = useRouter();
  const te = useTranslations("errors");
  const [busyId, setBusyId] = useState<string | null>(null);
  return (
    <section>
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">{t("title")}</h2>
      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">{t("none")}</p>
      ) : (
        <ul className="space-y-2">
          {groups.map((g) => {
            const enrolled = !!student && g.enrolledStudentIds.includes(student.id);
            const full = g.seats >= g.capacity;
            return (
              <li key={g.id} className="flex items-center gap-4 rounded-2xl bg-theory-soft/60 px-4 py-3">
                <div className="flex-1">
                  <div className="text-sm font-bold text-theory-ink">{g.title}</div>
                  <div className="text-xs text-muted">
                    {new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Amsterdam" }).format(new Date(g.startsAt))} · {formatTime(new Date(g.startsAt), locale)} – {formatTime(new Date(g.endsAt), locale)} · {t("seats", { n: g.seats, cap: g.capacity })}
                  </div>
                </div>
                <Button
                  size="sm" variant={enrolled ? "outline" : "primary"} disabled={!student || enrolled || full || busyId === g.id}
                  onClick={async () => {
                    setBusyId(g.id);
                    const r = await enrollTheoryAction(student!.id, g.id);
                    setBusyId(null);
                    if (r.ok) { toast.show("success", t("enrolled")); router.refresh(); } else toast.show("error", te.has(r.error) ? te(r.error) : te("generic"));
                  }}
                >
                  {enrolled ? t("enrolled") : full ? t("full") : t("enroll")}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
