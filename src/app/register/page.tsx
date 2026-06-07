"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { account, databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID } from "appwrite";
import { toast } from "sonner";
import Link from "next/link";
import { Leaf, ArrowRight } from "lucide-react";

const schema = z.object({
  firstName: z.string().min(1, "Vorname erforderlich"),
  lastName: z.string().min(1, "Nachname erforderlich"),
  email: z.string().email("Ungültige E-Mail"),
  password: z.string().min(8, "Mindestens 8 Zeichen"),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, {
  message: "Passwörter stimmen nicht überein",
  path: ["confirm"],
});

type FormData = z.infer<typeof schema>;

const inp = "w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-[#4F772D] focus:outline-none focus:ring-2 focus:ring-[#4F772D]/20";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      // 1. Appwrite Account anlegen
      const user = await account.create(
        ID.unique(),
        data.email,
        data.password,
        `${data.firstName} ${data.lastName}`
      );

      // 2. Session starten
      await account.createEmailPasswordSession(data.email, data.password);

      // 3. Employee-Profil als "pending" anlegen
      await databases.createDocument(DB_ID, COLLECTIONS.EMPLOYEES, ID.unique(), {
        userId: user.$id,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        role: "employee",
        status: "pending",
        department: "",
        position: "",
        startDate: new Date().toISOString().split("T")[0],
        vacationDaysTotal: 25,
        vacationDaysUsed: 0,
        onboardingStep: "personal",
      });

      router.replace("/onboarding");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("already exists") || msg.includes("conflict")) {
        toast.error("Diese E-Mail ist bereits registriert.");
      } else {
        toast.error("Fehler bei der Registrierung. Bitte erneut versuchen.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#4F772D]">
            <Leaf className="h-7 w-7 text-white" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-gray-900">Konto erstellen</h1>
            <p className="mt-1 text-sm text-gray-500">Sustainista HR — Mitarbeiterportal</p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Vorname</label>
                <input {...register("firstName")} className={inp} placeholder="Maria" />
                {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Nachname</label>
                <input {...register("lastName")} className={inp} placeholder="Muster" />
                {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName.message}</p>}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">E-Mail</label>
              <input {...register("email")} type="email" className={inp} placeholder="m.muster@sustainista.net" />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Passwort</label>
              <input {...register("password")} type="password" className={inp} placeholder="Mindestens 8 Zeichen" />
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Passwort bestätigen</label>
              <input {...register("confirm")} type="password" className={inp} placeholder="••••••••" />
              {errors.confirm && <p className="mt-1 text-xs text-red-500">{errors.confirm.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#4F772D] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#31572C] disabled:opacity-60"
            >
              {loading ? "Wird registriert…" : (
                <>Weiter zum Onboarding <ArrowRight className="h-4 w-4" strokeWidth={1.5} /></>
              )}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-gray-500">
          Bereits ein Konto?{" "}
          <Link href="/login" className="font-medium text-[#4F772D] hover:underline">
            Anmelden
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-gray-400">
          Dein Konto wird nach der Registrierung von der HR-Abteilung freigeschaltet.
        </p>
      </div>
    </div>
  );
}
