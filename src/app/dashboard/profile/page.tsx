"use client";

import { useAuth } from "@/context/AuthContext";
import { useMutation } from "@tanstack/react-query";
import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { account } from "@/lib/appwrite";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useEffect } from "react";
import { User, Lock, Building } from "lucide-react";

const profileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
  bankAccount: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8, "Mindestens 8 Zeichen"),
  confirm: z.string(),
}).refine(d => d.newPassword === d.confirm, {
  message: "Passwörter stimmen nicht überein",
  path: ["confirm"],
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { employee, refresh } = useAuth();

  const { register: regP, handleSubmit: hsP, reset: resetP, formState: { errors: eP } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  });

  const { register: regPw, handleSubmit: hsPw, reset: resetPw, formState: { errors: ePw } } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  useEffect(() => {
    if (employee) {
      resetP({
        firstName: employee.firstName,
        lastName: employee.lastName,
        phone: employee.phone ?? "",
        address: employee.address ?? "",
        bankAccount: employee.bankAccount ?? "",
      });
    }
  }, [employee, resetP]);

  const profileMutation = useMutation({
    mutationFn: async (data: ProfileForm) => {
      await databases.updateDocument(DB_ID, COLLECTIONS.EMPLOYEES, employee!.$id, data);
      await account.updateName(`${data.firstName} ${data.lastName}`);
    },
    onSuccess: () => { refresh(); toast.success("Profil gespeichert"); },
    onError: () => toast.error("Fehler beim Speichern"),
  });

  const passwordMutation = useMutation({
    mutationFn: async (data: PasswordForm) => {
      await account.updatePassword(data.newPassword, data.currentPassword);
    },
    onSuccess: () => { toast.success("Passwort geändert"); resetPw({ currentPassword: "", newPassword: "", confirm: "" }); },
    onError: () => toast.error("Aktuelles Passwort falsch"),
  });

  if (!employee) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Mein Profil</h1>
        <p className="mt-0.5 text-sm text-gray-500">Persönliche Daten und Einstellungen</p>
      </div>

      {/* Übersicht-Karte */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#4F772D]/10 text-2xl font-bold text-[#4F772D]">
          {employee.firstName[0]}{employee.lastName[0]}
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">{employee.firstName} {employee.lastName}</p>
          <p className="text-sm text-gray-500">{employee.position} · {employee.department}</p>
          <span className={`mt-1 inline-block text-[10px] rounded-full px-2 py-0.5 ${employee.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
            {employee.role === "admin" ? "Administrator" : "Mitarbeiter"}
          </span>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-gray-400">Urlaubstage</p>
          <p className="text-2xl font-bold text-[#4F772D]">{employee.vacationDaysTotal - employee.vacationDaysUsed}</p>
          <p className="text-xs text-gray-400">von {employee.vacationDaysTotal} verbleibend</p>
        </div>
      </div>

      {/* Persönliche Daten */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <User className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold text-gray-900">Persönliche Daten</h2>
        </div>
        <form onSubmit={hsP(d => profileMutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vorname" error={eP.firstName?.message}>
              <input {...regP("firstName")} className={inp} />
            </Field>
            <Field label="Nachname" error={eP.lastName?.message}>
              <input {...regP("lastName")} className={inp} />
            </Field>
            <Field label="Telefon">
              <input {...regP("phone")} placeholder="+43 664 123 456" className={inp} />
            </Field>
            <Field label="IBAN / Bankverbindung">
              <input {...regP("bankAccount")} placeholder="AT12 3456 7890 1234 5678" className={inp} />
            </Field>
          </div>
          <Field label="Adresse">
            <input {...regP("address")} placeholder="Musterstraße 1, 1010 Wien" className={inp} />
          </Field>
          <div className="flex justify-end">
            <button type="submit" disabled={profileMutation.isPending}
              className="rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60">
              {profileMutation.isPending ? "Speichert…" : "Profil speichern"}
            </button>
          </div>
        </form>
      </div>

      {/* Dienstdaten (readonly) */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <Building className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold text-gray-900">Dienstdaten</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-xs text-gray-400 mb-0.5">Eintrittsdatum</p><p className="font-medium text-gray-900">{employee.startDate}</p></div>
          <div><p className="text-xs text-gray-400 mb-0.5">E-Mail</p><p className="font-medium text-gray-900">{employee.email}</p></div>
          <div><p className="text-xs text-gray-400 mb-0.5">Abteilung</p><p className="font-medium text-gray-900">{employee.department}</p></div>
          <div><p className="text-xs text-gray-400 mb-0.5">Position</p><p className="font-medium text-gray-900">{employee.position}</p></div>
        </div>
        <p className="mt-3 text-xs text-gray-400">Änderungen an Dienstdaten bitte an die HR-Abteilung wenden.</p>
      </div>

      {/* Passwort ändern */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold text-gray-900">Passwort ändern</h2>
        </div>
        <form onSubmit={hsPw(d => passwordMutation.mutate(d))} className="space-y-3">
          <Field label="Aktuelles Passwort" error={ePw.currentPassword?.message}>
            <input {...regPw("currentPassword")} type="password" className={inp} />
          </Field>
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
