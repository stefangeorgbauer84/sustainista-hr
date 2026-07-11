"use client";

import { useAuth } from "@/context/AuthContext";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { User, Lock, Building, Calendar, Eye, EyeOff } from "lucide-react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

const EMPLOYMENT_LABELS: Record<string, string> = {
  vollzeit: "Vollzeit",
  teilzeit: "Teilzeit",
  geringfuegig: "Geringfügig",
  lehrling: "Lehrling",
  freier_dienstnehmer: "Freier Dienstnehmer",
  praktikant: "Praktikant",
  werkvertrag: "Werkvertrag",
};

const profileSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  contact_email: z.string().email("Ungültige E-Mail").optional().or(z.literal("")),
  contact_phone: z.string().optional(),
  bank_iban: z.string().optional(),
});

const passwordSchema = z.object({
  newPassword: z.string().min(8, "Mindestens 8 Zeichen"),
  confirm: z.string(),
}).refine(d => d.newPassword === d.confirm, {
  message: "Passwörter stimmen nicht überein",
  path: ["confirm"],
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { employee, profile, refresh } = useAuth();

  const { data: leaveBalance } = useQuery({
    queryKey: ["leave-balance-profile", employee?.id],
    queryFn: async () => {
      const year = new Date().getFullYear();
      const { data } = await supabase
        .from("leave_balances")
        .select("entitlement_days, carry_over_days, taken_days")
        .eq("employee_id", employee!.id)
        .eq("year", year)
        .single();
      return data;
    },
    enabled: !!employee,
  });

  const [showIban, setShowIban] = useState(false);

  const { register: regP, handleSubmit: hsP, reset: resetP, formState: { errors: eP } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  });

  const { register: regPw, handleSubmit: hsPw, reset: resetPw, formState: { errors: ePw } } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  useEffect(() => {
    if (employee) {
      resetP({
        first_name: employee.first_name,
        last_name: employee.last_name,
        contact_email: employee.contact_email ?? "",
        contact_phone: employee.contact_phone ?? "",
        bank_iban: employee.bank_iban ?? "",
      });
    }
  }, [employee, resetP]);

  const profileMutation = useMutation({
    mutationFn: async (data: ProfileForm) => {
      const { error } = await supabase
        .from("employees")
        .update({ first_name: data.first_name, last_name: data.last_name, contact_email: data.contact_email || null, contact_phone: data.contact_phone || null, bank_iban: data.bank_iban || null })
        .eq("id", employee!.id);
      if (error) throw error;
      await supabase.auth.updateUser({ data: { full_name: `${data.first_name} ${data.last_name}` } });
    },
    onSuccess: () => { refresh(); toast.success("Profil gespeichert"); },
    onError: () => toast.error("Fehler beim Speichern"),
  });

  const passwordMutation = useMutation({
    mutationFn: async (data: PasswordForm) => {
      const { error } = await supabase.auth.updateUser({ password: data.newPassword });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Passwort geändert"); resetPw({ newPassword: "", confirm: "" }); },
    onError: () => toast.error("Fehler beim Ändern des Passworts"),
  });

  if (!employee) return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Mein Profil</h1>
        <p className="mt-0.5 text-sm text-gray-500">Persönliche Daten und Einstellungen</p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm font-medium text-gray-700">Kein Mitarbeiterprofil verknüpft</p>
        <p className="mt-1 text-xs text-gray-400">
          Dieses Konto hat kein Mitarbeiterprofil. Passwortänderung ist trotzdem möglich.
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Passwort ändern</h2>
        <form onSubmit={hsPw(d => passwordMutation.mutate(d))} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Neues Passwort</label>
            <input type="password" {...regPw("newPassword")} className={inp} />
            {ePw.newPassword && <p className="mt-1 text-xs text-red-500">{ePw.newPassword.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Bestätigen</label>
            <input type="password" {...regPw("confirm")} className={inp} />
            {ePw.confirm && <p className="mt-1 text-xs text-red-500">{ePw.confirm.message}</p>}
          </div>
          <button type="submit" disabled={passwordMutation.isPending}
            className="rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60">
            Passwort ändern
          </button>
        </form>
      </div>
    </div>
  );

  const totalDays = leaveBalance ? (leaveBalance.entitlement_days + (leaveBalance.carry_over_days ?? 0)) : null;
  const remainingDays = totalDays !== null ? totalDays - (leaveBalance?.taken_days ?? 0) : null;
  const roleName = profile?.role === "company_admin" || profile?.role === "super_admin" ? "Administrator" :
    profile?.role === "hr_manager" ? "HR Manager" : "Mitarbeiter";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Mein Profil</h1>
        <p className="mt-0.5 text-sm text-gray-500">Persönliche Daten und Einstellungen</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#4F772D]/10 text-2xl font-bold text-[#4F772D]">
          {employee.first_name[0]}{employee.last_name[0]}
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">{employee.first_name} {employee.last_name}</p>
          <p className="text-sm text-gray-500">{employee.employment_type}</p>
          <span className={`mt-1 inline-block text-[10px] rounded-full px-2 py-0.5 ${
            profile?.role === "company_admin" || profile?.role === "super_admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"
          }`}>{roleName}</span>
        </div>
        {remainingDays !== null && (
          <div className="ml-auto text-right">
            <p className="text-xs text-gray-400">Urlaubstage</p>
            <p className="text-2xl font-bold text-[#4F772D]">{remainingDays}</p>
            <p className="text-xs text-gray-400">von {totalDays} verbleibend</p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <User className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold text-gray-900">Persönliche Daten</h2>
        </div>
        <form onSubmit={hsP(d => profileMutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vorname" error={eP.first_name?.message}>
              <input {...regP("first_name")} className={inp} />
            </Field>
            <Field label="Nachname" error={eP.last_name?.message}>
              <input {...regP("last_name")} className={inp} />
            </Field>
            <Field label="E-Mail" error={eP.contact_email?.message}>
              <input {...regP("contact_email")} type="email" placeholder="name@beispiel.at" className={inp} />
            </Field>
            <Field label="Telefon">
              <input {...regP("contact_phone")} placeholder="+43 664 123 456" className={inp} />
            </Field>
            <Field label="IBAN / Bankverbindung">
              <div className="relative">
                <input {...regP("bank_iban")} type={showIban ? "text" : "password"} placeholder="AT12 3456 7890 1234 5678" className={`${inp} pr-10`} />
                <button type="button" onClick={() => setShowIban(!showIban)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showIban ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
                </button>
              </div>
            </Field>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={profileMutation.isPending}
              className="rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60">
              {profileMutation.isPending ? "Speichert…" : "Profil speichern"}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <Building className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold text-gray-900">Dienstdaten</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-xs text-gray-400 mb-0.5">Eintrittsdatum</p><p className="font-medium text-gray-900">{format(parseISO(employee.entry_date), "d. MMMM yyyy", { locale: de })}</p></div>
          <div><p className="text-xs text-gray-400 mb-0.5">Mitarbeiternummer</p><p className="font-medium text-gray-900">{employee.employee_number ?? "—"}</p></div>
          <div><p className="text-xs text-gray-400 mb-0.5">Beschäftigungsart</p><p className="font-medium text-gray-900">{EMPLOYMENT_LABELS[employee.employment_type] ?? employee.employment_type}</p></div>
          <div><p className="text-xs text-gray-400 mb-0.5">Stunden/Woche</p><p className="font-medium text-gray-900">{employee.hours_per_week}h</p></div>
        </div>
        <p className="mt-3 text-xs text-gray-400">Änderungen an Dienstdaten bitte an die HR-Abteilung wenden.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold text-gray-900">Passwort ändern</h2>
        </div>
        <form onSubmit={hsPw(d => passwordMutation.mutate(d))} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Neues Passwort" error={ePw.newPassword?.message}>
              <input {...regPw("newPassword")} type="password" className={inp} />
            </Field>
            <Field label="Bestätigen" error={ePw.confirm?.message}>
              <input {...regPw("confirm")} type="password" className={inp} />
            </Field>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={passwordMutation.isPending}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-60">
              {passwordMutation.isPending ? "Wird geändert…" : "Passwort ändern"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inp = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none focus:ring-2 focus:ring-[#4F772D]/20";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
