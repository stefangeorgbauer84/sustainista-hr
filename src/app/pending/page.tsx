"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Employee } from "@/types";
import { logout } from "@/lib/auth";
import { Leaf, Clock, CheckCircle, XCircle, LogOut } from "lucide-react";

export default function PendingPage() {
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/login"); return; }

        const { data: profile } = await supabase
          .from("profiles")
          .select("employee_id")
          .eq("id", user.id)
          .single();

        if (!profile?.employee_id) { router.replace("/login"); return; }

        const { data: emp } = await supabase
          .from("employees")
          .select("*")
          .eq("id", profile.employee_id)
          .single() as { data: Employee | null };

        if (!emp) { router.replace("/login"); return; }
        if (emp.is_active) { router.replace("/dashboard"); return; }
        setEmployee(emp);
      } catch {
        router.replace("/login");
      } finally {
        setChecking(false);
      }
    }
    load();
    // Poll every 30s to catch admin approval
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [router]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#4F772D] border-t-transparent" />
      </div>
    );
  }

  const empStatus = (employee?.custom_fields as Record<string, unknown>)?.status as string | undefined;
  const isRejected = empStatus === "rejected";
  const rejectionReason = (employee?.custom_fields as Record<string, unknown>)?.rejection_reason as string | undefined;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4F772D]">
            <Leaf className="h-6 w-6 text-white" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-semibold text-gray-700">Sustainista HR</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-10 shadow-sm">
          {isRejected ? (
            <>
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                <XCircle className="h-8 w-8 text-red-500" strokeWidth={1.5} />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Konto abgelehnt</h1>
              <p className="mt-3 text-sm text-gray-500">
                Dein Onboarding-Antrag wurde leider nicht genehmigt.
              </p>
              {rejectionReason && (
                <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700 text-left">
                  <p className="font-medium mb-1">Begründung:</p>
                  <p>{rejectionReason}</p>
                </div>
              )}
              <p className="mt-4 text-xs text-gray-400">
                Wende dich bei Fragen an die HR-Abteilung: hr@sustainista.net
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
                <Clock className="h-8 w-8 text-amber-500" strokeWidth={1.5} />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Konto wird geprüft</h1>
              <p className="mt-3 text-sm text-gray-500">
                Dein Account wird gerade überprüft. Ein Admin wird dich in Kürze freischalten.
                Du wirst automatisch weitergeleitet, sobald dein Konto aktiviert wurde.
              </p>
              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-[#4F772D]">
                <div className="h-2 w-2 animate-pulse rounded-full bg-[#4F772D]" />
                Warte auf Freischaltung…
              </div>

              <div className="mt-6 rounded-lg bg-gray-50 p-4 text-left">
                <p className="mb-2 text-xs font-medium text-gray-500">Eingereichte Daten</p>
                <div className="space-y-1 text-sm text-gray-700">
                  <p><span className="text-gray-400">Name:</span> {employee?.first_name} {employee?.last_name}</p>
                  <p><span className="text-gray-400">E-Mail:</span> {employee?.contact_email}</p>
                  {employee?.contact_phone && <p><span className="text-gray-400">Telefon:</span> {employee.contact_phone}</p>}
                </div>
              </div>
            </>
          )}

          {!isRejected && (
            <div className="mt-6 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3">
              <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" strokeWidth={1.5} />
              <p className="text-xs text-green-700">
                Diese Seite prüft automatisch alle 30 Sekunden auf eine Statusänderung.
              </p>
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="mt-6 flex items-center gap-2 mx-auto text-sm text-gray-400 hover:text-gray-600 transition"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.5} />
          Abmelden
        </button>
      </div>
    </div>
  );
}
