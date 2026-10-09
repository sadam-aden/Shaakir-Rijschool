"use client";

import { useLocale } from "next-intl";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { AppLocale } from "@/i18n/config";
import { intlTag } from "@/i18n/config";
import { formatMoney } from "@/lib/format";

/** Revenue of the last months; the current month is solid blue, earlier months light blue (mockup 5). */
export function RevenueChart({ months }: { months: { month: string; cents: number }[] }) {
  const locale = useLocale() as AppLocale;
  const data = months.map((m) => {
    const [y, mo] = m.month.split("-").map(Number);
    const label = new Intl.DateTimeFormat(intlTag[locale], { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, mo - 1, 15))).replace(".", "");
    return { label: label.charAt(0).toUpperCase() + label.slice(1), euros: m.cents / 100, cents: m.cents };
  });
  return (
    <div className="h-44 w-full" role="img" aria-label={data.map((d) => `${d.label} ${formatMoney(d.cents, locale)}`).join(", ")}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: "var(--muted)" }} />
          <Tooltip
            cursor={{ fill: "transparent" }}
            formatter={(_v, _n, p) => [formatMoney((p.payload as { cents: number }).cents, locale), ""]}
            separator=""
            contentStyle={{ borderRadius: 12, border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)", fontWeight: 700 }}
          />
          <Bar dataKey="euros" radius={[8, 8, 0, 0]} minPointSize={4}>
            {data.map((_, i) => <Cell key={i} fill={i === data.length - 1 ? "var(--primary)" : "var(--primary-soft)"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
