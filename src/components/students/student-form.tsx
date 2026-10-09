"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { createStudentAction, updateStudentAction } from "@/app/actions/students";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import provinceIndex from "@/data/places/index.json";
import { AddressField } from "./address-field";
import { latestBirthDate } from "@/lib/domain/age";
import { localDateKey } from "@/lib/domain/time";
import { studentSchema, type StudentData, type StudentInput } from "@/lib/schemas/student";
import { useRunAction } from "@/lib/use-action";

export const emptyStudent: StudentInput = {
  firstName: "", lastName: "", phone: "", email: "", birthDate: "", address: "", postcode: "", area: "",
  gearbox: "MANUAL", track: "PRACTICAL", status: "ACTIVE", primaryInstructorId: "", locale: "nl",
  smsConsent: false, emailConsent: false, cbrCandidateNumber: "", guardianName: "", guardianPhone: "", guardianEmail: "", notes: "",
};

type Props = {
  mode: "create" | "edit";
  studentId?: string;
  initial?: StudentInput;
  instructors?: { id: string; displayName: string }[];
  isAdmin: boolean;
  trigger?: ReactNode;
};

/** Add / edit student dialog. Validation schema is shared with the server action. */
export function StudentFormDialog({ mode, studentId, initial, instructors = [], isAdmin, trigger }: Props) {
  const t = useTranslations("students.form");
  const tc = useTranslations("common");
  const tg = useTranslations("gearbox");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { run, pending } = useRunAction();
  const form = useForm<StudentInput, unknown, StudentData>({
    resolver: zodResolver(studentSchema),
    defaultValues: initial ?? emptyStudent,
  });
  const { register, handleSubmit, reset, control, setValue, setError, formState: { errors } } = form;

  // province → city/village → wijk: suggestions come from the Dutch places list (per province, loaded on demand)
  const province = useWatch({ control, name: "province" }) ?? "";
  const city = useWatch({ control, name: "city" }) ?? "";
  const provinceSlug = provinceIndex.find((p) => p.name === province)?.slug;
  const qc = useQueryClient();
  const placesOptions = (slug: string | undefined) => ({
    queryKey: ["places", slug],
    staleTime: Infinity,
    queryFn: async () => {
      const r = await fetch(`/api/places?province=${slug}`);
      if (!r.ok) throw new Error("places");
      return (await r.json()) as { places: { name: string; municipality: string }[]; wijken: Record<string, string[]> };
    },
  });
  const placesQ = useQuery({ ...placesOptions(provinceSlug), enabled: !!provinceSlug && open });
  const placeOptions = placesQ.data?.places ?? [];
  const chosenPlace = placeOptions.find((p) => p.name === city);
  const wijkOptions = chosenPlace ? (placesQ.data?.wijken[chosenPlace.municipality] ?? []) : [];
  const err = (k: keyof StudentInput) => {
    if (!errors[k]) return undefined;
    if (k === "birthDate" || k === "city") {
      const code = String(errors[k]?.message ?? "");
      return t.has(code) ? t(code) : tc("required");
    }
    return k === "email" || k === "guardianEmail" ? t("invalidEmail") : tc("required");
  };

  const onSubmit = handleSubmit(async (values) => {
    // a chosen city must exist in the chosen province (typing is allowed, but only list values are accepted);
    // wait for the list if it is still loading so a fast typist cannot slip past the check
    if (values.province && values.city) {
      const list = (await qc.fetchQuery(placesOptions(provinceIndex.find((p) => p.name === values.province)?.slug))).places;
      if (!list.some((p) => p.name === values.city)) {
        setError("city", { message: "cityUnknown" });
        return;
      }
    }
    run(
      () => (mode === "create" ? createStudentAction(values) : updateStudentAction(studentId!, values)),
      {
        success: mode === "create" ? t("created") : t("updated"),
        // after creating, navigating to the new student already loads fresh data; a parallel refresh would undo it
        refresh: mode !== "create",
        onOk: (data) => {
          setOpen(false);
          if (mode === "create" && data && typeof data === "object" && "id" in data) router.push(`/leerlingen?id=${(data as { id: string }).id}`);
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) reset(initial ?? emptyStudent); setOpen(o); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="soft">
            <Plus className="h-4 w-4" aria-hidden /> {t("titleNew")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        title={mode === "create" ? t("titleNew") : t("titleEdit")}
        description={mode === "create" ? t("subtitleNew") : undefined}
        icon={mode === "create" ? <UserPlus className="h-5 w-5" aria-hidden /> : <Pencil className="h-5 w-5" aria-hidden />}
        className="max-w-2xl"
        closeLabel={tc("close")}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button type="submit" form="student-form" disabled={pending}>{pending ? tc("saving") : t("submit")}</Button>
          </>
        }
      >
        <form id="student-form" onSubmit={onSubmit} className="space-y-7 pb-2" noValidate>
          <Section title={t("sections.person")}>
            <Field label={t("firstName")} error={err("firstName")}><Input {...register("firstName")} autoComplete="off" /></Field>
            <Field label={t("lastName")} error={err("lastName")}><Input {...register("lastName")} autoComplete="off" /></Field>
            <Field label={t("birthDate")} error={err("birthDate")}><Input {...register("birthDate")} type="date" max={latestBirthDate(localDateKey(new Date()))} /></Field>
            <Field label={t("cbrNumber")}><Input {...register("cbrCandidateNumber")} /></Field>
            <Field label={t("phone")}><Input {...register("phone")} type="tel" /></Field>
            <Field label={t("email")} error={err("email")}><Input {...register("email")} type="email" /></Field>
          </Section>

          <Section title={t("sections.address")}>
            <Field label={t("address")} className="sm:col-span-2"><AddressField form={form} province={province} city={city} /></Field>
            <Field label={t("postcode")}><Input {...register("postcode")} /></Field>
            <Field label={t("province")}>
              <Select {...register("province", { onChange: () => { setValue("city", ""); setValue("area", ""); } })}>
                <option value="">{t("provincePlaceholder")}</option>
                {provinceIndex.map((p) => <option key={p.slug} value={p.name}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label={t("city")} error={err("city")}>
              <Input
                {...register("city", { onChange: () => setValue("area", "") })}
                list="student-city-options" autoComplete="off" disabled={!province}
                placeholder={province ? t("cityPlaceholder") : t("chooseProvinceFirst")}
              />
              <datalist id="student-city-options">
                {placeOptions.map((p) => <option key={`${p.name}-${p.municipality}`} value={p.name} label={p.municipality !== p.name ? p.municipality : undefined} />)}
              </datalist>
            </Field>
            <Field label={t("area")}>
              <Input {...register("area")} list="student-wijk-options" autoComplete="off" disabled={!city} placeholder={wijkOptions.length ? t("wijkPlaceholder") : undefined} />
              <datalist id="student-wijk-options">{wijkOptions.map((w) => <option key={w} value={w} />)}</datalist>
            </Field>
          </Section>

          <Section title={t("sections.lessons")}>
            <Field label={t("gearbox")}>
              <Select {...register("gearbox")}>
                <option value="MANUAL">{tg("MANUAL")}</option>
                <option value="AUTOMATIC">{tg("AUTOMATIC")}</option>
              </Select>
            </Field>
            <Field label={t("track")}>
              <Select {...register("track")}>
                {(["PRACTICAL", "THEORY_ONLY", "BOTH"] as const).map((x) => <option key={x} value={x}>{t(`tracks.${x}`)}</option>)}
              </Select>
            </Field>
            <Field label={t("status")}>
              <Select {...register("status")}>
                {(["ACTIVE", "WAITING_LIST", "PAUSED", "PASSED", "ARCHIVED"] as const).map((x) => <option key={x} value={x}>{t(`statuses.${x}`)}</option>)}
              </Select>
            </Field>
            <Field label={t("language")}>
              <Select {...register("locale")}>
                <option value="nl">Nederlands</option>
                <option value="en">English</option>
              </Select>
            </Field>
            {isAdmin && (
              <Field label={t("instructor")} className="sm:col-span-2">
                <Select {...register("primaryInstructorId")}>
                  <option value="">—</option>
                  {instructors.map((i) => <option key={i.id} value={i.id}>{i.displayName}</option>)}
                </Select>
              </Field>
            )}
          </Section>

          <Section title={t("sections.consent")}>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line px-4 py-3 text-sm font-semibold transition hover:bg-primary-faint has-[:checked]:border-primary has-[:checked]:bg-primary-faint">
              <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" {...register("smsConsent")} /> {t("smsConsent")}
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line px-4 py-3 text-sm font-semibold transition hover:bg-primary-faint has-[:checked]:border-primary has-[:checked]:bg-primary-faint">
              <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" {...register("emailConsent")} /> {t("emailConsent")}
            </label>
          </Section>

          <Section title={t("guardian")} cols="sm:grid-cols-3">
            <Field label={t("guardianName")}><Input {...register("guardianName")} /></Field>
            <Field label={t("guardianPhone")}><Input {...register("guardianPhone")} type="tel" /></Field>
            <Field label={t("guardianEmail")} error={err("guardianEmail")}><Input {...register("guardianEmail")} type="email" /></Field>
          </Section>

          <Section title={t("notes")} cols="">
            <Textarea {...register("notes")} aria-label={t("notes")} />
          </Section>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A titled block of fields inside the dialog. */
function Section({ title, children, cols = "sm:grid-cols-2" }: { title: string; children: ReactNode; cols?: string }) {
  return (
    <section>
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted">{title}</h3>
      <div className={cols ? `grid gap-3 ${cols}` : ""}>{children}</div>
    </section>
  );
}
