"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { setGearboxAction } from "@/app/actions/students";
import { useRunAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";

export function GearboxToggle({ studentId, initial }: { studentId: string; initial: "MANUAL" | "AUTOMATIC" }) {
  const t = useTranslations("gearbox");
  const [value, setValue] = useState(initial);
  const { run } = useRunAction();
  return (
    <div role="group" className="inline-flex rounded-xl bg-page p-1">
      {(["MANUAL", "AUTOMATIC"] as const).map((g) => (
        <button
          key={g}
          type="button"
          aria-pressed={value === g}
          onClick={() => {
            setValue(g);
            run(() => setGearboxAction(studentId, g));
          }}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-bold transition",
            value === g ? "bg-exam text-white shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {t(g)}
        </button>
      ))}
    </div>
  );
}
