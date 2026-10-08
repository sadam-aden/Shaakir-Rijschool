"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { THEME_COOKIE, themes, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

function applyTheme(next: Theme) {
  document.documentElement.dataset.theme = next; // instant, no reload
  document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
}

const icons = { light: Sun, dark: Moon, system: Monitor } as const;

export function ThemeSwitcher({ initial, className, labels = false }: { initial: Theme; className?: string; labels?: boolean }) {
  const t = useTranslations("theme");
  const [theme, setTheme] = useState<Theme>(initial);

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div role="group" aria-label={t("label")} className={cn("inline-flex rounded-lg bg-page p-0.5", className)}>
      {themes.map((id) => {
        const Icon = icons[id];
        return (
          <button
            key={id}
            type="button"
            aria-pressed={theme === id}
            title={t(id)}
            onClick={() => choose(id)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition",
              theme === id ? "bg-card text-primary shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            <span className={labels ? undefined : "sr-only"}>{t(id)}</span>
          </button>
        );
      })}
    </div>
  );
}
