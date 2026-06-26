"use client";

import { useAuth } from "@/context/AuthContext";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useEffect } from "react";
import { User, Lock, Building, Calendar } from "lucide-react";

const profileSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
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
        contact_phone: employee.contact_phone ?? "",
        bank_iban: employee.bank_iban ?? "",
      });
    }
  }, [employee, resetP]);

  const profileMutation = useMutation({
    mutationFn: async (data: ProfileForm) => {
      const { error } = await supabase
        .from("employees")
        .update({ first_name: data.first_name, last_name: data.last_name, contact_phone: data.contact_phone || null, bank_iban: data.bank_iban || null })
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

  if (!employee) return null;

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
            <Field label="Telefon">
              <input {...regP("contact_phone")} placeholder="+43 664 123 456" className={inp} />
            </Field>
            <Field label="IBAN / Bankverbindung">
              <input {...regP("bank_iban")} placeholder="AT12 3456 7890 1234 5678" className={inp} />
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
          <div><p className="text-xs text-gray-400 mb-0.5">Eintrittsdatum</p><p className="font-medium text-gray-900">{employee.entry_date}</p></div>
          <div><p className="text-xs text-gray-400 mb-0.5">E-Mail</p><p className="font-medium text-gray-900">{employee.contact_email ?? "—"}</p></div>
          <div><p className="text-xs text-gray-400 mb-0.5">Beschäftigungsart</p><p className="font-medium text-gray-900">{employee.employment_type}</p></div>
          <div><p className="text-xs text-gray-400 mb-0.5">Stunden/Woche</p><p className="font-medium text-gray-900">{employee.hours_per_week}h</p></div>
        </div>
        <p className="mt-3 text-xs text-gray-400">Änderungen an Dienstdaten bitte an die HR-Abteilung wenden.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold text-gray-900">Google Calendar</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Verbinde deinen Google Calendar um genehmigte Urlaubstage automatisch einzutragen.
        </p>
        <a href={`/api/google-calendar/auth?state=${employee.id}`}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google Calendar verbinden
        </a>
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
