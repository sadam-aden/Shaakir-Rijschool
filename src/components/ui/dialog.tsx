"use client";

import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

/** Centered modal (`side` false) or right-hand sheet (`side` true). */
export function DialogContent({
  title, description, children, side, className, closeLabel = "Close",
}: { title: string; description?: string; children: ReactNode; side?: boolean; className?: string; closeLabel?: string }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-40 bg-black/40" />
      <D.Content
        className={cn(
          "fixed z-50 overflow-y-auto bg-card p-6 shadow-xl outline-none",
          side
            ? "right-0 top-0 h-full w-full max-w-md border-l border-line"
            : "left-1/2 top-1/2 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line",
          className,
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <D.Title className="text-lg font-bold">{title}</D.Title>
            {description ? (
              <D.Description className="mt-1 text-sm text-muted">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{title}</D.Description>
            )}
          </div>
          <D.Close aria-label={closeLabel} className="rounded-lg p-1.5 text-muted hover:bg-page hover:text-ink">
            <X className="h-4 w-4" />
          </D.Close>
        </div>
        {children}
      </D.Content>
    </D.Portal>
  );
}
