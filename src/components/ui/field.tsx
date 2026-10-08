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

/** 24-hour time entry ("HH:MM"). Native time inputs follow the OS locale (often 12 h), the app always uses 24 h. */
export function TimeInput({ value, onChange, className, ...p }: { value: string; onChange: (v: string) => void; className?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  return (
    <input
      {...p}
      type="text"
      inputMode="numeric"
      placeholder="HH:MM"
      maxLength={5}
      pattern="([01]\d|2[0-3]):[0-5]\d"
      value={value}
      onChange={(e) => {
        let v = e.target.value.replace(/[^\d:]/g, "");
        if (/^\d{2}$/.test(v) && value.length < v.length) v += ":";
        onChange(v);
      }}
      onBlur={(e) => {
        const m = /^(\d{1,2}):?(\d{2})?$/.exec(e.target.value);
        if (m) onChange(`${m[1].padStart(2, "0")}:${(m[2] ?? "00")}`);
      }}
      className={cn(inputClass, className)}
    />
  );
}
