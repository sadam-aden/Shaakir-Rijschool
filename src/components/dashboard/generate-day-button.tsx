"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { generateScheduleAction } from "@/app/actions/schedule";
import { useToast } from "@/components/ui/toast";

/** One click: drafts the day for this instructor and opens it in the calendar for review. */
export function GenerateDayButton({ instructorId, dateKey, when }: { instructorId: string; dateKey: string; when: string }) {
  const t = useTranslations("schedule.banner");
  const td = useTranslations("schedule.dialog");
  const te = useTranslations("errors");
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      const r = await generateScheduleAction({ instructorId, from: dateKey });
      if (!r.ok) {
        toast.show("error", te.has(r.error) ? te(r.error) : te("generic"));
        return;
      }
      const day = r.data.days[0];
      if (day?.outcome && day.outcome.lessons > 0) {
        toast.show("success", t("created", { when }));
        router.push(`/agenda?date=${dateKey}`);
        router.refresh();
      } else {
        toast.show("error", day?.error && te.has(day.error) ? te(day.error) : td("nothing"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={go} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-primary shadow-sm transition hover:bg-primary-faint disabled:opacity-60">
      <Sparkles className="h-4 w-4" aria-hidden />{busy ? td("generating") : t("generate", { when })}
    </button>
  );
}
