"use client";

import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

/**
 * Modern modal: large rounded corners, blurred backdrop, soft shadow, pop-in animation,
 * fixed header and footer with a scrolling body. `side` renders a right-hand sheet instead.
 */
export function DialogContent({
  title, description, children, footer, icon, side, className, closeLabel = "Close",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  /** Buttons that stay visible below the scrolling body */
  footer?: ReactNode;
  /** Small icon shown in a soft circle next to the title */
  icon?: ReactNode;
  side?: boolean;
  className?: string;
  closeLabel?: string;
}) {
  return (
    <D.Portal>
      <D.Overlay className="dialog-overlay fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm" />
      <D.Content
        className={cn(
          "fixed z-50 flex flex-col overflow-hidden bg-card text-ink shadow-2xl outline-none",
          side
            ? "sheet-slide right-3 top-3 bottom-3 w-[calc(100%-1.5rem)] max-w-md rounded-3xl border border-line"
            : "dialog-pop left-1/2 top-1/2 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-line",
          className,
        )}
      >
        <div className="flex items-start gap-4 px-7 pb-4 pt-7">
          {icon && (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">{icon}</span>
          )}
          <div className="min-w-0 flex-1">
            <D.Title className="text-xl font-bold leading-tight tracking-tight">{title}</D.Title>
            {description ? (
              <D.Description className="mt-1 text-sm text-muted">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{title}</D.Description>
            )}
          </div>
          <D.Close
            aria-label={closeLabel}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-page text-muted transition hover:bg-primary-soft hover:text-primary"
          >
            <X className="h-4 w-4" />
          </D.Close>
        </div>

        <div className={cn("min-h-0 flex-1 overflow-y-auto px-7", footer ? "pb-4" : "pb-7")}>{children}</div>

        {footer && <div className="flex items-center justify-end gap-3 border-t border-line bg-page/60 px-7 py-4">{footer}</div>}
      </D.Content>
    </D.Portal>
  );
}
