"use client";

import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { AppLocale } from "@/i18n/config";
import { intlTag } from "@/i18n/config";
import { formatHours } from "@/lib/format";

const tooltipStyle = { borderRadius: 12, border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)", fontWeight: 700 } as const;
const tick = { fontSize: 12, fontWeight: 700, fill: "var(--muted)" } as const;

type Day = { key: string; practicalMin: number; theoryMin: number; today: boolean };

/** Planned hours per weekday, practical (blue) and theory (amber) stacked. */
export function WeekChart({ days }: { days: Day[] }) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("dashboard");
  const data = days.map((d) => {
    const label = new Intl.DateTimeFormat(intlTag[locale], { weekday: "short", timeZone: "UTC" }).format(new Date(`${d.key}T12:00:00Z`)).replace(".", "");
    return { label: label.charAt(0).toUpperCase() + label.slice(1), practical: d.practicalMin / 60, theory: d.theoryMin / 60, practicalMin: d.practicalMin, theoryMin: d.theoryMin };
  });
  const summary = data.map((d) => `${d.label} ${formatHours(d.practicalMin + d.theoryMin, locale)}`).join(", ");
  return (
    <div className="h-52 w-full" role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={tick} />
          <Tooltip
            cursor={{ fill: "transparent" }}
            contentStyle={tooltipStyle}
            formatter={(_v, name, p) => [formatHours((p.payload as Record<string, number>)[name === "practical" ? "practicalMin" : "theoryMin"], locale), name === "practical" ? t("legendPractical") : t("legendTheory")]}
          />
          <Bar dataKey="practical" stackId="a" fill="var(--primary)" minPointSize={0} />
          <Bar dataKey="theory" stackId="a" fill="var(--theory)" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut of what happened to lessons in the last 30 days. */
export function OutcomeChart({ completed, noShow, cancelled }: { completed: number; noShow: number; cancelled: number }) {
  const t = useTranslations("dashboard.charts");
  const total = completed + noShow + cancelled;
  const data = [
    { name: t("completed"), value: completed, color: "var(--primary)" },
    { name: t("noShow"), value: noShow, color: "var(--danger-ink, #b91c1c)" },
    { name: t("cancelled"), value: cancelled, color: "var(--theory)" },
  ];
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-40 w-40 shrink-0" role="img" aria-label={data.map((d) => `${d.name} ${d.value}`).join(", ")}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data.filter((d) => d.value > 0)} dataKey="value" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none">
              {data.filter((d) => d.value > 0).map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{total}</span>
          <span className="text-[10px] font-bold uppercase text-muted">{t("lessons")}</span>
        </div>
      </div>
      <ul className="space-y-2 text-sm font-semibold">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />{d.name} <span className="text-muted">· {d.value}</span></li>
        ))}
      </ul>
    </div>
  );
}
