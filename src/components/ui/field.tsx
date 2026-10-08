import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const inputClass =
  "w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...p} />;
}
export function Select({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClass, "pr-8", className)} {...p} />;
}
export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, "min-h-20", className)} {...p} />;
}

export function Field({ label, error, children, className }: { label: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block text-sm font-medium", className)}>
      <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
      {children}
      {error && <span role="alert" className="mt-1 block text-xs text-danger-ink">{error}</span>}
    </label>
  );
}
