"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/action-result";

/**
 * Runs a server action with a pending state, a success toast, a translated error toast
 * and a router refresh so server components re-read fresh data.
 */
export function useRunAction() {
  const t = useTranslations("errors");
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();

  function run<T>(
    fn: () => Promise<ActionResult<T>>,
    opts: { success?: string; refresh?: boolean; onOk?: (data: T) => void } = {},
  ) {
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) {
          if (opts.success) toast.show("success", opts.success);
          opts.onOk?.(r.data);
          if (opts.refresh !== false) router.refresh();
        } else {
          toast.show("error", t.has(r.error) ? t(r.error, r.params) : t("generic"));
        }
      } catch {
        toast.show("error", t("generic"));
      }
    });
  }
  return { run, pending };
}
