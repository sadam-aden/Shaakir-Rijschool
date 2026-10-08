"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { createStudentAction, updateStudentAction } from "@/app/actions/students";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
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
  const { register, handleSubmit, formState: { errors } } = form;
  const err = (k: keyof StudentInput) =>
    errors[k] ? (k === "email" || k === "guardianEmail" ? t("invalidEmail") : tc("required")) : undefined;

  const onSubmit = handleSubmit((values) => {
    run(
      () => (mode === "create" ? createStudentAction(values) : updateStudentAction(studentId!, values)),
      {
        success: mode === "create" ? t("created") : t("updated"),
        onOk: (data) => {
          setOpen(false);
          if (mode === "create" && data && typeof data === "object" && "id" in data) router.push(`/leerlingen?id=${(data as { id: string }).id}`);
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="soft">
            <Plus className="h-4 w-4" aria-hidden /> {t("titleNew")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={mode === "create" ? t("titleNew") : t("titleEdit")} className="max-w-2xl" closeLabel={tc("close")}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("firstName")} error={err("firstName")}><Input {...register("firstName")} autoComplete="off" /></Field>
            <Field label={t("lastName")} error={err("lastName")}><Input {...register("lastName")} autoComplete="off" /></Field>
            <Field label={t("phone")}><Input {...register("phone")} type="tel" /></Field>
            <Field label={t("email")} error={err("email")}><Input {...register("email")} type="email" /></Field>
            <Field label={t("birthDate")}><Input {...register("birthDate")} type="date" /></Field>
            <Field label={t("cbrNumber")}><Input {...register("cbrCandidateNumber")} /></Field>
            <Field label={t("address")} className="sm:col-span-2"><Input {...register("address")} /></Field>
            <Field label={t("postcode")}><Input {...register("postcode")} /></Field>
            <Field label={t("area")}><Input {...register("area")} /></Field>
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
          </div>

          <div className="flex flex-wrap gap-5 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" {...register("smsConsent")} /> {t("smsConsent")}</label>
            <label className="flex items-center gap-2"><input type="checkbox" {...register("emailConsent")} /> {t("emailConsent")}</label>
          </div>

          <fieldset className="rounded-xl border border-line p-3">
            <legend className="px-1 text-xs font-bold text-muted">{t("guardian")}</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t("guardianName")}><Input {...register("guardianName")} /></Field>
              <Field label={t("guardianPhone")}><Input {...register("guardianPhone")} type="tel" /></Field>
              <Field label={t("guardianEmail")} error={err("guardianEmail")}><Input {...register("guardianEmail")} type="email" /></Field>
            </div>
          </fieldset>

          <Field label={t("notes")}><Textarea {...register("notes")} /></Field>

          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={pending}>{pending ? tc("saving") : t("submit")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
