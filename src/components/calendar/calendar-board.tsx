"use client";

import {
  DndContext, DragOverlay, PointerSensor, useDraggable, useSensor, useSensors,
  type DragEndEvent, type DragMoveEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { Check, CheckCircle2, GripVertical, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { bookLessonAction, moveLessonAction } from "@/app/actions/lessons";
import { AutBadge, Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import type { AppLocale } from "@/i18n/config";
import { AvailabilityText } from "@/components/students/bits";
import { fitsAvailability, windowsFor } from "@/lib/domain/availability";
import { layoutOverlaps, snapMinutes } from "@/lib/domain/calendar-layout";
import type { Conflict } from "@/lib/domain/check-slot";
import { zonedToUtc } from "@/lib/domain/time";
import { formatHours } from "@/lib/format";
import { dayNumber, isoWeekdayOfKey, keyParts, type DateKey } from "@/lib/date-key";
import { weekdayShort } from "@/lib/i18n-format";
import { useConflictText } from "@/lib/use-conflict-text";
import { cn } from "@/lib/utils";
import type { CalendarData, CalItem, ToScheduleCard } from "@/lib/queries/calendar";

const GRID_START = 8 * 60;
const GRID_END = 20 * 60;
const PX_PER_HOUR = 52;
const PPM = PX_PER_HOUR / 60;
const HEIGHT = (GRID_END - GRID_START) * PPM;

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const toUtc = (dayKey: DateKey, min: number) => {
  const { year, month, day } = keyParts(dayKey);
  return zonedToUtc(year, month, day, Math.floor(min / 60), min % 60);
};

type Drag =
  | { kind: "student"; card: ToScheduleCard }
  | { kind: "lesson"; item: CalItem };
type Preview = { dayKey: DateKey; startMin: number; endMin: number; fits: boolean; reason: Conflict | null };

export function CalendarBoard({ data, todayKey, nowMin }: { data: CalendarData; todayKey: DateKey; nowMin: number }) {
  const t = useTranslations("calendar");
  const tt = useTranslations("lessonType");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const toast = useToast();
  const conflictText = useConflictText();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const colRefs = useRef(new Map<string, HTMLDivElement>());
  const [drag, setDrag] = useState<Drag | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  const instructorId = data.instructorId === "all" ? (data.instructors[0]?.id ?? "") : data.instructorId;
  const itemsByDay = new Map<string, CalItem[]>();
  for (const i of data.items) itemsByDay.set(i.dayKey, [...(itemsByDay.get(i.dayKey) ?? []), i]);

  const openLesson = (id: string) => {
    const p = new URLSearchParams(sp.toString());
    p.set("lesson", id);
    router.push(`${pathname}?${p}`, { scroll: false });
  };

  /** Which column and which snapped minute is the pointer / dragged block at? */
  function locate(clientX: number, clientY: number, durationMin: number, offsetMin = 0) {
    for (const [dayKey, el] of colRefs.current) {
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top - 40 && clientY <= r.bottom + 40) {
        const raw = GRID_START + (clientY - r.top) / PPM - offsetMin;
        return { dayKey, startMin: snapMinutes(raw, durationMin, GRID_START, GRID_END) };
      }
    }
    return null;
  }

  function evaluate(d: Drag, dayKey: DateKey, startMin: number): Preview {
    const dur = d.kind === "student" ? d.card.defaultDuration : d.item.durationMin;
    const endMin = startMin + dur;
    const startsAt = toUtc(dayKey, startMin);
    const endsAt = toUtc(dayKey, endMin);
    const avail = d.kind === "student" ? d.card.availability : d.item.availability;
    const selfId = d.kind === "lesson" ? d.item.id : null;
    const clash = (itemsByDay.get(dayKey) ?? []).find((i) => i.id !== selfId && i.instructorId === (d.kind === "lesson" ? d.item.instructorId : instructorId) && i.status !== "DRAFT" && startMin < i.endMin && i.startMin < endMin);
    if (clash) return { dayKey, startMin, endMin, fits: false, reason: { key: "instructorBusy", params: { with: clash.title } } };
    if (!fitsAvailability(avail, startsAt, endsAt)) return { dayKey, startMin, endMin, fits: false, reason: { key: "outsideStudentAvailability" } };
    return { dayKey, startMin, endMin, fits: true, reason: null };
  }

  const pointer = (e: { activatorEvent: Event; delta: { x: number; y: number } }) => {
    const a = e.activatorEvent as PointerEvent;
    return { x: a.clientX + e.delta.x, y: a.clientY + e.delta.y };
  };

  function onDragStart(e: DragStartEvent) {
    setDrag(e.active.data.current as Drag);
  }
  function onDragMove(e: DragMoveEvent) {
    const d = e.active.data.current as Drag;
    const p = pointer(e);
    const dur = d.kind === "student" ? d.card.defaultDuration : d.item.durationMin;
    // lessons keep the grab offset (top of the block follows the cursor); cards use the cursor as start time
    const offset = d.kind === "lesson" ? ((e.activatorEvent as PointerEvent).clientY - (e.active.rect.current.initial?.top ?? 0)) / PPM : 0;
    const loc = locate(p.x, p.y, dur, offset);
    setPreview(loc ? evaluate(d, loc.dayKey, loc.startMin) : null);
  }
  async function onDragEnd(e: DragEndEvent) {
    const d = e.active.data.current as Drag;
    const pv = preview;
    setDrag(null);
    setPreview(null);
    if (!pv) return;
    // dropped back on its own place: nothing to do
    if (d.kind === "lesson" && pv.dayKey === d.item.dayKey && pv.startMin === d.item.startMin) return;
    const startsAt = toUtc(pv.dayKey, pv.startMin).toISOString();
    const r =
      d.kind === "student"
        ? await bookLessonAction({
            studentId: d.card.id, type: "PRACTICAL", instructorId, startsAt, durationMin: d.card.defaultDuration,
            occurrences: 1, notify: { sms: true, email: true, reminder: true },
          })
        : await moveLessonAction({ lessonId: d.item.id, startsAt, notify: true });
    if (r.ok) {
      toast.show("success", d.kind === "student" ? t("booked") : t("moved"));
    } else if ("conflicts" in r && Array.isArray((r as { conflicts?: Conflict[] }).conflicts)) {
      toast.show("error", (r as { conflicts: Conflict[] }).conflicts.map(conflictText).join(" · "));
    } else {
      toast.show("error", String(r.error));
    }
    router.refresh();
  }

  const draggedStudent = drag?.kind === "student" ? drag.card : null;
  const hours = Array.from({ length: (GRID_END - GRID_START) / 60 + 1 }, (_, i) => GRID_START + i * 60);

  return (
    <DndContext id="calendar-dnd" sensors={sensors} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd} onDragCancel={() => { setDrag(null); setPreview(null); }}>
      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        {/* ── left panel ── */}
        <aside className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{t("toSchedule")}</h2>
            <span className="text-xs font-bold text-muted">{t("studentsCount", { n: data.toSchedule.length })}</span>
          </div>
          {data.toSchedule.length === 0 && <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">{t("toScheduleEmpty")}</p>}
          {data.toSchedule.map((c) => <StudentCard key={c.id} card={c} dragging={draggedStudent?.id === c.id} />)}

          <div className="rounded-2xl bg-primary-soft p-4">
            <h3 className="mb-3 text-sm font-bold">{t("rules.title")}</h3>
            <ul className="space-y-1.5 text-sm text-primary">
              {[t("rules.availability"), t("rules.hours"), t("rules.car"), t("rulesMaxDay", { hours: data.rules.maxHours }), t("rulesDrives", { min: data.rules.maxTravelMinutes }), ...(data.rules.examFirst ? [t("rules.exam")] : [])].map((x) => (
                <li key={x} className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />{x}</li>
              ))}
            </ul>
          </div>
        </aside>

        {/* ── grid ── */}
        <div className="overflow-x-auto rounded-2xl border border-line bg-card">
          <div className="grid min-w-[760px]" style={{ gridTemplateColumns: `56px repeat(${data.days.length}, minmax(0, 1fr))` }}>
            <div />
            {data.days.map((k) => {
              const isToday = k === todayKey;
              const total = data.dayTotals[k] ?? 0;
              return (
                <div key={k} className="border-b border-l border-line px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("flex h-8 min-w-8 items-center justify-center rounded-full text-sm font-bold", isToday ? "bg-primary text-white" : "")}>{dayNumber(k)}</span>
                    <div>
                      <div className="text-[11px] font-bold uppercase text-primary">{weekdayShort(isoWeekdayOfKey(k), locale)}</div>
                      <div className="text-xs text-muted">
                        {data.draftTotals[k] ? <span className="font-bold text-primary">{t("draftLabel", { h: formatHours(data.draftTotals[k], locale).replace(/ [uh]$/, "") })}</span> : t("hours", { h: formatHours(total, locale).replace(/ [uh]$/, "") })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* hour labels */}
            <div className="relative" style={{ height: HEIGHT }}>
              {hours.map((m) => (
                <div key={m} className="absolute right-2 -translate-y-1/2 text-[11px] font-semibold text-muted" style={{ top: (m - GRID_START) * PPM }}>{hhmm(m)}</div>
              ))}
            </div>

            {data.days.map((k) => {
              const items = itemsByDay.get(k) ?? [];
              const lay = layoutOverlaps(items.map((i) => ({ id: i.id, startMin: i.startMin, endMin: i.endMin })));
              const wd = isoWeekdayOfKey(k);
              const windows = draggedStudent ? windowsFor(draggedStudent.availability, wd) : [];
              const offs = data.offBlocks.filter((o) => o.dayKey === k);
              return (
                <div
                  key={k}
                  ref={(el) => { if (el) colRefs.current.set(k, el); else colRefs.current.delete(k); }}
                  className="relative border-l border-line"
                  style={{ height: HEIGHT }}
                >
                  {hours.map((m) => <div key={m} className="absolute inset-x-0 border-t border-line/70" style={{ top: (m - GRID_START) * PPM }} />)}
                  {windows.map(([a, b], i) => (
                    <div key={i} className="pointer-events-none absolute inset-x-0 bg-primary/10" style={{ top: (Math.max(a, GRID_START) - GRID_START) * PPM, height: (Math.min(b, GRID_END) - Math.max(a, GRID_START)) * PPM }} />
                  ))}
                  {offs.map((o, i) => (
                    <div
                      key={i}
                      className="pointer-events-none absolute inset-x-1 flex items-center justify-center rounded-lg text-center text-[11px] font-bold text-muted"
                      style={{
                        top: (o.fromMin - GRID_START) * PPM, height: (o.toMin - o.fromMin) * PPM,
                        backgroundImage: "repeating-linear-gradient(135deg, var(--line) 0 2px, transparent 2px 9px)",
                      }}
                    >
                      {o.toMin - o.fromMin >= 90 && (o.label === "timeOff" ? t("timeOff") : o.toMin >= GRID_END && o.fromMin > GRID_START ? t("off", { time: hhmm(o.fromMin) }) : "")}
                    </div>
                  ))}
                  {k === todayKey && nowMin >= GRID_START && nowMin <= GRID_END && (
                    <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-danger" style={{ top: (nowMin - GRID_START) * PPM }} />
                  )}

                  {items.map((i) => {
                    const l = lay.get(i.id) ?? { col: 0, cols: 1 };
                    return <LessonBlock key={i.id} item={i} col={l.col} cols={l.cols} dragging={drag?.kind === "lesson" && drag.item.id === i.id} onOpen={() => openLesson(i.id)} showInstructor={data.instructorId === "all"} tt={tt} />;
                  })}

                  {preview && preview.dayKey === k && (
                    <div
                      className={cn("pointer-events-none absolute inset-x-1 z-20 rounded-xl border-2 border-dashed px-2 py-1 text-xs font-bold", preview.fits ? "border-primary bg-primary-soft/80 text-primary" : "border-danger bg-danger-soft/80 text-danger-ink")}
                      style={{ top: (preview.startMin - GRID_START) * PPM, height: Math.max((preview.endMin - preview.startMin) * PPM, 28) }}
                    >
                      {hhmm(preview.startMin)} – {hhmm(preview.endMin)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {drag && (
          <div className="w-56 rounded-xl bg-primary px-3 py-2 text-white shadow-xl">
            <div className="flex items-center gap-2 text-sm font-bold">
              {drag.kind === "student" ? drag.card.name : drag.item.title}
              {(drag.kind === "student" ? drag.card.gearbox : drag.item.gearbox) === "AUTOMATIC" && <AutBadge />}
            </div>
            <div className="text-xs text-white/80">
              {preview ? `${hhmm(preview.startMin)} – ${hhmm(preview.endMin)}` : t("dragHint")}
              {" · "}{drag.kind === "student" ? tt("PRACTICAL") : tt(drag.item.type)}
            </div>
            {preview && (
              <span className={cn("mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold", preview.fits ? "bg-white text-primary" : "bg-danger text-white")}>
                {preview.fits ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : <X className="h-3 w-3" aria-hidden />}
                {preview.fits ? t("fits") : preview.reason ? conflictText(preview.reason) : ""}
              </span>
            )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function StudentCard({ card, dragging }: { card: ToScheduleCard; dragging: boolean }) {
  const t = useTranslations("calendar");
  const tg = useTranslations("gearbox");
  const locale = useLocale() as AppLocale;
  const { attributes, listeners, setNodeRef } = useDraggable({ id: `student:${card.id}`, data: { kind: "student", card } satisfies Drag, disabled: card.kind === "theory" });

  if (card.kind === "theory") {
    return (
      <Link href={`/les-inplannen?student=${card.id}&type=THEORY`} className="block rounded-2xl border border-line bg-card p-4 hover:border-primary">
        <div className="flex items-center justify-between"><span className="font-bold">{card.name}</span><Badge tone="theory">{t("legend.theory")}</Badge></div>
        <p className="mt-1 text-xs text-muted">{t("nextTheory")}</p>
        <p className="mt-2 text-xs font-bold">{t("theoryProgress", { done: card.theory?.done ?? 0, total: card.theory?.total ?? 6 })}</p>
      </Link>
    );
  }
  const low = card.minutesAvailable < 180;
  return (
    <div
      ref={setNodeRef} {...attributes} {...listeners}
      className={cn("cursor-grab touch-none rounded-2xl border bg-card p-4 transition active:cursor-grabbing", dragging ? "border-dashed border-primary opacity-50" : "border-line hover:border-primary")}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-bold">{card.name}</span>
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary">{card.defaultDuration} min</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span className={cn("rounded-md px-1.5 py-0.5 font-bold", card.gearbox === "AUTOMATIC" ? "bg-success-soft text-success-ink" : "bg-page")}>{tg(card.gearbox)}</span>
            <span><AvailabilityText availability={card.availability} /></span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <ProgressBar value={card.minutesAvailable} max={card.minutesPurchased || card.minutesAvailable} tone={low ? "amber" : "blue"} className="flex-1" />
            <span className={cn("text-xs font-bold", low ? "text-warn-ink" : "")}>{t("hoursLeft", { h: formatHours(card.minutesAvailable, locale) })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LessonBlock({
  item, col, cols, dragging, onOpen, showInstructor, tt,
}: { item: CalItem; col: number; cols: number; dragging: boolean; onOpen: () => void; showInstructor: boolean; tt: (k: string) => string }) {
  const t = useTranslations("calendar");
  const { attributes, listeners, setNodeRef } = useDraggable({ id: item.id, data: { kind: "lesson", item } satisfies Drag, disabled: !item.canMove });
  const top = (item.startMin - GRID_START) * PPM;
  const height = Math.max((item.endMin - item.startMin) * PPM - 3, 24);
  const draft = item.status === "DRAFT";
  const style =
    draft ? "border-2 border-dashed border-primary bg-primary-faint text-primary"
    : item.type === "THEORY" ? "bg-theory-soft text-theory-ink"
    : item.type === "EXAM" ? "bg-exam text-white"
    : item.status === "NO_SHOW" ? "bg-warn-soft text-warn-ink"
    : "bg-primary text-white";
  const compact = height < 48;
  return (
    <div
      ref={setNodeRef} {...attributes} {...(item.canMove ? listeners : {})}
      role="button" tabIndex={0} aria-label={`${item.title} ${hhmm(item.startMin)}`}
      onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      className={cn("absolute z-[5] overflow-hidden rounded-xl px-2.5 py-1 text-left text-xs leading-tight shadow-sm transition", style, item.canMove ? "cursor-grab active:cursor-grabbing" : "cursor-pointer", dragging && "opacity-40", item.status === "COMPLETED" && "opacity-80")}
      style={{ top, height, left: `calc(${(col / cols) * 100}% + 4px)`, width: `calc(${100 / cols}% - 8px)`, touchAction: item.canMove ? "none" : undefined }}
    >
      <div className="flex items-center gap-1.5 font-bold">
        <span className="truncate">{item.title}</span>
        {item.gearbox === "AUTOMATIC" && item.type !== "THEORY" && <AutBadge />}
        {item.status === "COMPLETED" && <Check className="ml-auto h-3 w-3 shrink-0" aria-hidden />}
      </div>
      {!compact && (
        <div className="mt-0.5 opacity-90">
          {item.type === "THEORY" ? <div>{hhmm(item.startMin)} – {hhmm(item.endMin)}</div> : <div>{hhmm(item.startMin)} – {hhmm(item.endMin)}</div>}
          {item.type === "THEORY" && item.subtitle ? <div>{t("students", { n: Number(item.subtitle) })}</div> : item.type === "EXAM" ? <div>{tt("EXAM")}</div> : item.subtitle ? <div className="truncate">{item.subtitle}</div> : null}
          {showInstructor && <div className="truncate opacity-80">{item.instructorName}</div>}
        </div>
      )}
    </div>
  );
}

