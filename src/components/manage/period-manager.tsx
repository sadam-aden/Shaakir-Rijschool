"use client";

import { Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import type { ActionResult } from "@/lib/action-result";
import type { AppLocale } from "@/i18n/config";
import { useRunAction } from "@/lib/use-action";

type Item = { id: string; startsAt: string; endsAt: string; reason: string | null };

/** List + add form for blocked periods (instructor time off, vehicle unavailability). */
export function PeriodManager({
  items, addLabel, emptyLabel, add, remove,
}: {
  items: Item[];
  addLabel: string;
  emptyLabel: string;
  add: (input: { startsAt: string; endsAt: string; reason?: string }) => Promise<ActionResult>;
  remove: (id: string) => Promise<ActionResult>;
}) {
  const tc = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const { run, pending } = useRunAction();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Amsterdam", hourCycle: "h23" }).format(new Date(iso));

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between rounded-xl bg-page px-3 py-2">
              <span>{fmt(i.startsAt)} → {fmt(i.endsAt)}{i.reason ? ` · ${i.reason}` : ""}</span>
              <Button variant="ghost" size="icon" aria-label={tc("delete")} onClick={() => run(() => remove(i.id))}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <Field label={tc("from")}><Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label={tc("to")}><Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label={tc("reason")}><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <Button
          disabled={pending || !from || !to}
          onClick={() =>
            run(() => add({ startsAt: new Date(from).toISOString(), endsAt: new Date(to).toISOString(), reason: reason || undefined }), {
              success: tc("saved"),
              onOk: () => { setFrom(""); setTo(""); setReason(""); },
            })
          }
        >
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
