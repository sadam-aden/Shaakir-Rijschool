"use client";

import { useTranslations } from "next-intl";
import type { Conflict } from "@/lib/domain/check-slot";
import type { Factor } from "@/lib/domain/best-fit";

/** Translates a checkSlot conflict into a short reason ("Botst met Daan", "Geen automaat vrij"). */
export function useConflictText() {
  const t = useTranslations("conflicts");
  const tg = useTranslations("gearbox");
  return (c: Conflict) => {
    const p: Record<string, string | number> = { ...(c.params ?? {}) };
    if (typeof p.gearbox === "string") p.gearbox = tg(p.gearbox as "MANUAL" | "AUTOMATIC").toLowerCase();
    return t.has(c.key) ? t(c.key, p) : t("generic");
  };
}

/** One-sentence "why this slot" explanation built from the top scoring factors. */
export function useBestFitText() {
  const t = useTranslations("bestFit");
  const tp = useTranslations("dayPartSingular");
  return (time: string, factors: Factor[]) => {
    const parts = factors.map((f) => {
      const p: Record<string, string | number> = { ...(f.params ?? {}) };
      if (f.key === "onlyInPart" && typeof p.part === "string") p.part = tp(p.part as "MORNING" | "AFTERNOON" | "EVENING");
      return t(f.key, p);
    });
    return [t("intro", { time }), ...parts].join(" ");
  };
}
