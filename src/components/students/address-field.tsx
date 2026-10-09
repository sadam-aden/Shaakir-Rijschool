"use client";

import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/field";
import type { AddressSuggestion } from "@/lib/address";
import type { StudentData, StudentInput } from "@/lib/schemas/student";
import { cn } from "@/lib/utils";

/**
 * Address box with suggestions from the Dutch address register (PDOK), limited to the chosen province and city.
 * Picking a suggestion fills street + number, postcode, city, neighbourhood and exact coordinates.
 * Typing by hand always works (the suggestions are a convenience).
 */
export function AddressField({ form, province, city }: { form: UseFormReturn<StudentInput, unknown, StudentData>; province: string; city: string }) {
  const t = useTranslations("students.form");
  const { register, setValue, control } = form;
  const listId = useId();
  const address = useWatch({ control, name: "address" }) ?? "";
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(address.trim()), 250);
    return () => clearTimeout(id);
  }, [address]);

  const enabled = focused && !!province && debounced.length >= 3;
  const q = useQuery({
    queryKey: ["address", debounced, province, city],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const p = new URLSearchParams({ q: debounced, province });
      if (city) p.set("city", city);
      const r = await fetch(`/api/address?${p}`);
      if (!r.ok) return { suggestions: [] as AddressSuggestion[], unavailable: true };
      return (await r.json()) as { suggestions: AddressSuggestion[]; unavailable?: boolean };
    },
  });
  const options = enabled ? (q.data?.suggestions ?? []) : [];
  const open = focused && options.length > 0;

  function pick(s: AddressSuggestion) {
    setValue("address", s.address, { shouldDirty: true });
    setValue("postcode", s.postcode, { shouldDirty: true });
    setValue("city", s.city, { shouldDirty: true });
    if (s.wijk) setValue("area", s.wijk, { shouldDirty: true });
    setValue("lat", s.lat);
    setValue("lng", s.lng);
    setActive(-1);
    setFocused(false);
  }

  const field = register("address", {
    // hand-typed text no longer matches the stored coordinates
    onChange: () => { setValue("lat", undefined); setValue("lng", undefined); setActive(-1); },
    onBlur: () => setTimeout(() => setFocused(false), 120),
  });

  return (
    <div className="relative">
      <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <Input
        {...field}
        className="pl-10"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        placeholder={province ? t("addressPlaceholder") : t("addressNeedsProvince")}
        onFocus={() => setFocused(true)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % options.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i <= 0 ? options.length - 1 : i - 1)); }
          else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(options[active]); }
          else if (e.key === "Escape") { e.stopPropagation(); setFocused(false); }
        }}
      />
      {open && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-64 overflow-y-auto rounded-2xl border border-line bg-card p-1.5 shadow-xl">
          {options.map((s, i) => (
            <li
              key={`${s.address}-${s.postcode}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}
              // mousedown (not click) so the input does not lose focus before the choice registers
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
              onMouseEnter={() => setActive(i)}
              className={cn("cursor-pointer rounded-xl px-3 py-2 text-sm", i === active ? "bg-primary-soft text-primary" : "hover:bg-page")}
            >
              <span className="font-semibold">{s.address}</span>
              <span className="block text-xs text-muted">{s.postcode} {s.city}{s.wijk ? ` · ${s.wijk}` : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
