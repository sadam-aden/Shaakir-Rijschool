"use client";

import { Check, Save, Trash2, UserX, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { removeDraftLessonAction } from "@/app/actions/schedule";
import {
  cancelLessonAction, completeLessonAction, markNoShowAction, moveLessonAction, saveLessonNotesAction, setAttendanceAction,
} from "@/app/actions/lessons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea, TimeInput } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import type { AppLocale } from "@/i18n/config";
import type { Conflict } from "@/lib/domain/check-slot";
import { localDateKey, localParts, zonedToUtc } from "@/lib/domain/time";
import { formatDateLong, formatTime } from "@/lib/format";
import { useConflictText } from "@/lib/use-conflict-text";
import { useRunAction } from "@/lib/use-action";

export type LessonSheetData = {
  id: string;
  type: "PRACTICAL" | "THEORY" | "EXAM";
  status: "DRAFT" | "PLANNED" | "COMPLETED" | "NO_SHOW" | "CANCELLED_STUDENT" | "CANCELLED_SCHOOL";
  startsAt: string;
  endsAt: string;
  durationMin: number;
  studentId: string | null;
  studentName: string | null;
  instructorId: string;
  instructorName: string;
  vehicleId: string | null;
  gearbox: "MANUAL" | "AUTOMATIC" | null;
  pickupAddress: string | null;
  instructorNotes: string;
  studentNotes: string;
  title: string | null;
  enrollments: { id: string; name: string; attendance: "ENROLLED" | "ATTENDED" | "NO_SHOW" }[];
  skills: { id: string; name: string; value: number }[];
  paid: "PAID" | "PARTIAL" | "UNPAID" | "NONE" | null;
};
type Props = {
  lesson: LessonSheetData;
  vehicles: { id: string; name: string; gearbox: "MANUAL" | "AUTOMATIC" }[];
  instructors: { id: string; displayName: string }[];
  cancellationWindowHours: number;
  isAdmin: boolean;
};

const tone = { PLANNED: "blue", DRAFT: "grey", COMPLETED: "green", NO_SHOW: "amber", CANCELLED_STUDENT: "grey", CANCELLED_SCHOOL: "grey" } as const;

export function LessonSheet({ lesson, vehicles, instructors, cancellationWindowHours, isAdmin }: Props) {
  const t = useTranslations("lessons.sheet");
  const ts = useTranslations("lessonStatus");
  const tt = useTranslations("lessonType");
  const ta = useTranslations("lessons.attendance");
  const tc = useTranslations("common");
  const tdr = useTranslations("schedule.draft");
  const te = useTranslations("errors");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const toast = useToast();
  const conflictText = useConflictText();
  const { run, pending } = useRunAction();

  const startsAt = new Date(lesson.startsAt);
  const actionable = lesson.status === "PLANNED" || lesson.status === "DRAFT";
  const canComplete = lesson.status === "PLANNED";

  const close = () => {
    const p = new URLSearchParams(sp.toString());
    p.delete("lesson");
    router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
  };

  // edit form
  const parts = localParts(startsAt);
  const [date, setDate] = useState(localDateKey(startsAt));
  const [time, setTime] = useState(`${String(Math.floor(parts.minutes / 60)).padStart(2, "0")}:${String(parts.minutes % 60).padStart(2, "0")}`);
  const [duration, setDuration] = useState(lesson.durationMin);
  const [vehicleId, setVehicleId] = useState(lesson.vehicleId ?? "");
  const [instructorId, setInstructorId] = useState(lesson.instructorId);
  const [pickup, setPickup] = useState(lesson.pickupAddress ?? "");
  const [notifyChange, setNotifyChange] = useState(true);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  const [instructorNotes, setInstructorNotes] = useState(lesson.instructorNotes);
  const [studentNotes, setStudentNotes] = useState(lesson.studentNotes);

  const [panel, setPanel] = useState<null | "complete" | "cancel">(null);
  const [skillValues, setSkillValues] = useState<Record<string, number>>(() => Object.fromEntries(lesson.skills.map((s) => [s.id, s.value])));
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const [cancelBy, setCancelBy] = useState<"STUDENT" | "SCHOOL">("STUDENT");
  const [cancelReason, setCancelReason] = useState("");
  const [now] = useState(() => Date.now());
  const withinWindow = startsAt.getTime() - now < cancellationWindowHours * 3_600_000;
  const defaultCharge = cancelBy === "STUDENT" && withinWindow;
  const [chargeOverride, setChargeOverride] = useState<boolean | null>(null);
  const charge = cancelBy === "SCHOOL" ? false : (chargeOverride ?? defaultCharge);

  const [attendance, setAttendance] = useState(lesson.enrollments);
  const [noShowCharge, setNoShowCharge] = useState(true);

  async function save() {
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return;
    const r = await moveLessonAction({
      lessonId: lesson.id, startsAt: zonedToUtc(y, m, d, hh, mm).toISOString(), durationMin: duration,
      vehicleId: vehicleId || undefined, pickupAddress: pickup || undefined, instructorId: isAdmin ? instructorId : undefined, notify: notifyChange,
    });
    if (r.ok) {
      toast.show("success", t("moved"));
      setConflicts([]);
      router.refresh();
    } else if ("conflicts" in r && Array.isArray((r as { conflicts?: Conflict[] }).conflicts)) {
      setConflicts((r as { conflicts: Conflict[] }).conflicts);
    } else {
      toast.show("error", te.has(r.error) ? te(r.error) : te("generic"));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent side title={lesson.title ?? lesson.studentName ?? tt(lesson.type)} closeLabel={tc("close")} description={`${formatDateLong(startsAt, locale)} · ${formatTime(startsAt, locale)} – ${formatTime(new Date(lesson.endsAt), locale)}`}>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={lesson.type === "THEORY" ? "theory" : lesson.type === "EXAM" ? "navy" : "blue"}>{tt(lesson.type)}</Badge>
            <Badge tone={tone[lesson.status]}>{ts(lesson.status)}</Badge>
            {lesson.paid && lesson.paid !== "NONE" && <Badge tone={lesson.paid === "PAID" ? "green" : "amber"}>{lesson.paid === "PAID" ? t("paid") : t("unpaid")}</Badge>}
            {lesson.studentId && <Link href={`/leerlingen/${lesson.studentId}`} className="ml-auto text-sm font-semibold text-primary">{t("profile")}</Link>}
          </div>
          <p className="text-sm text-muted">{t("instructorLabel")}: <b className="text-ink">{lesson.instructorName}</b>{lesson.pickupAddress ? <> · {t("pickupLabel")}: <b className="text-ink">{lesson.pickupAddress}</b></> : null}</p>

          {actionable && lesson.type !== "THEORY" && (
            <section className="space-y-3 rounded-2xl border border-line p-4">
              <h3 className="text-sm font-bold">{t("edit")}</h3>
              <div className="grid grid-cols-3 gap-3">
                <Field label={t("date")} className="col-span-2"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
                <Field label={t("time")}><TimeInput value={time} onChange={setTime} /></Field>
                <Field label={t("duration")}>
                  <Select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                    {[30, 45, 60, 75, 90, 105, 120, 150, 180].map((d) => <option key={d} value={d}>{d}</option>)}
                  </Select>
                </Field>
                <Field label={t("car")} className="col-span-2">
                  <Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                    <option value="">{t("carAuto")}</option>
                    {vehicles.filter((v) => !lesson.gearbox || v.gearbox === lesson.gearbox).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </Select>
                </Field>
                {isAdmin && instructors.length > 1 && (
                  <Field label={t("instructor")} className="col-span-3">
                    <Select value={instructorId} onChange={(e) => setInstructorId(e.target.value)}>{instructors.map((i) => <option key={i.id} value={i.id}>{i.displayName}</option>)}</Select>
                  </Field>
                )}
                <Field label={t("pickup")} className="col-span-3"><Input value={pickup} onChange={(e) => setPickup(e.target.value)} /></Field>
              </div>
              {conflicts.length > 0 && (
                <ul role="alert" className="space-y-1 rounded-xl bg-danger-soft p-3 text-sm font-semibold text-danger-ink">
                  {conflicts.map((c, i) => <li key={i}>{conflictText(c)}</li>)}
                </ul>
              )}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notifyChange} onChange={(e) => setNotifyChange(e.target.checked)} /> {t("notifyChange")}</label>
              <Button disabled={pending} onClick={save}><Save className="h-4 w-4" aria-hidden />{t("save")}</Button>
            </section>
          )}
          {!actionable && <p className="text-sm text-muted">{t("noChanges")}</p>}

          {lesson.type !== "THEORY" && (
            <section className="space-y-3">
              <Field label={t("instructorNotes")}><Textarea value={instructorNotes} onChange={(e) => setInstructorNotes(e.target.value)} /></Field>
              <Field label={t("studentNotes")}><Textarea value={studentNotes} onChange={(e) => setStudentNotes(e.target.value)} /></Field>
              <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => saveLessonNotesAction({ lessonId: lesson.id, instructorNotes, studentNotes }), { success: tc("saved") })}>{tc("save")}</Button>
            </section>
          )}

          {lesson.type === "THEORY" && (
            <section className="space-y-3">
              <h3 className="text-sm font-bold">{t("attendance")}</h3>
              <ul className="space-y-2">
                {attendance.map((a, i) => (
                  <li key={a.id} className="flex items-center justify-between rounded-xl bg-page px-3 py-2 text-sm">
                    <span className="font-semibold">{a.name}</span>
                    <Select className="w-36 py-1.5" value={a.attendance} onChange={(e) => setAttendance((x) => x.map((r, idx) => (idx === i ? { ...r, attendance: e.target.value as typeof a.attendance } : r)))}>
                      {(["ENROLLED", "ATTENDED", "NO_SHOW"] as const).map((k) => <option key={k} value={k}>{ta(k)}</option>)}
                    </Select>
                  </li>
                ))}
              </ul>
              <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => setAttendanceAction(lesson.id, attendance.map((a) => ({ enrollmentId: a.id, attendance: a.attendance }))), { success: tc("saved") })}>{t("saveAttendance")}</Button>
            </section>
          )}

          {lesson.status === "DRAFT" && (
            <section className="space-y-3 border-t border-line pt-4">
              <p className="rounded-xl bg-primary-faint p-3 text-sm font-semibold text-primary">{tdr("draftNote")}</p>
              <Button variant="outline" disabled={pending} onClick={() => run(() => removeDraftLessonAction(lesson.id), { success: tdr("removed"), onOk: close })}>
                <Trash2 className="h-4 w-4" aria-hidden />{tdr("remove")}
              </Button>
            </section>
          )}

          {canComplete && (
            <section className="space-y-3 border-t border-line pt-4">
              {panel === null && (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setPanel("complete")}><Check className="h-4 w-4" aria-hidden />{t("complete")}</Button>
                  {lesson.studentId && lesson.type !== "THEORY" && <Button variant="outline" onClick={() => run(() => markNoShowAction(lesson.id, noShowCharge), { success: t("noShowDone"), onOk: close })}><UserX className="h-4 w-4" aria-hidden />{t("noShow")}</Button>}
                  <Button variant="ghost" onClick={() => setPanel("cancel")}><X className="h-4 w-4" aria-hidden />{t("cancel")}</Button>
                </div>
              )}
              {panel === null && lesson.studentId && lesson.type !== "THEORY" && (
                <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={noShowCharge} onChange={(e) => setNoShowCharge(e.target.checked)} /> {t("chargeable")} ({t("noShow").toLowerCase()})</label>
              )}

              {panel === "complete" && (
                <div className="space-y-4 rounded-2xl border border-primary/30 bg-primary-faint p-4">
                  <h3 className="text-sm font-bold">{t("completeTitle")}</h3>
                  {lesson.type === "PRACTICAL" && lesson.skills.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-muted">{t("skills")}</p>
                      {lesson.skills.map((s) => (
                        <label key={s.id} className="block text-sm">
                          <span className="mb-1 flex justify-between font-semibold"><span>{s.name}</span><span>{skillValues[s.id] ?? 0}%</span></span>
                          <input
                            type="range" min={0} max={100} step={5} className="w-full" value={skillValues[s.id] ?? 0}
                            onChange={(e) => { setSkillValues((v) => ({ ...v, [s.id]: Number(e.target.value) })); setTouched((x) => new Set(x).add(s.id)); }}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      disabled={pending}
                      onClick={() => run(() => completeLessonAction({
                        lessonId: lesson.id, instructorNotes, studentNotes,
                        skills: [...touched].map((id) => ({ skillId: id, value: skillValues[id] })),
                      }), { success: t("completed"), onOk: close })}
                    >
                      {t("completeConfirm")}
                    </Button>
                    <Button variant="ghost" onClick={() => setPanel(null)}>{tc("cancel")}</Button>
                  </div>
                </div>
              )}

              {panel === "cancel" && (
                <div className="space-y-3 rounded-2xl border border-line p-4">
                  <h3 className="text-sm font-bold">{t("cancelTitle")}</h3>
                  <Field label={t("cancelBy")}>
                    <Select value={cancelBy} onChange={(e) => { setCancelBy(e.target.value as "STUDENT" | "SCHOOL"); setChargeOverride(null); }}>
                      <option value="STUDENT">{t("byStudent")}</option>
                      <option value="SCHOOL">{t("bySchool")}</option>
                    </Select>
                  </Field>
                  <Field label={t("cancelReason")}><Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} /></Field>
                  {lesson.studentId && lesson.type === "PRACTICAL" && (
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" checked={charge} disabled={cancelBy === "SCHOOL" || !isAdmin} onChange={(e) => setChargeOverride(e.target.checked)} /> {t("chargeable")}
                      </label>
                      <p className="text-xs text-muted">{cancelBy === "STUDENT" && withinWindow ? t("chargeableHint", { hours: cancellationWindowHours }) : t("freeHint")}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button variant="danger" disabled={pending} onClick={() => run(() => cancelLessonAction({ lessonId: lesson.id, by: cancelBy, reason: cancelReason || undefined, chargeable: lesson.type === "PRACTICAL" ? charge : undefined, notify: true }), { success: t("cancelled"), onOk: close })}>{t("cancel")}</Button>
                    <Button variant="ghost" onClick={() => setPanel(null)}>{tc("cancel")}</Button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
