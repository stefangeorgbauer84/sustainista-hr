"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { account, databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { Query, ID } from "appwrite";
import type { Employee } from "@/types";
import { Leaf } from "lucide-react";
import { Suspense } from "react";

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState("Anmeldung wird abgeschlossen…");
  const error = params.get("error");

  useEffect(() => {
    if (error) {
      setStatus("Anmeldung fehlgeschlagen. Weiterleitung…");
      setTimeout(() => router.replace(`/login?error=${error}`), 1500);
      return;
    }

    async function handleCallback() {
      try {
        // Appwrite hat die Session bereits gesetzt — einfach User laden
        const user = await account.get();

        setStatus("Profil wird geprüft…");

        // Employee-Profil suchen
        const res = await databases.listDocuments(DB_ID, COLLECTIONS.EMPLOYEES, [
          Query.equal("userId", user.$id),
          Query.limit(1),
        ]);

        const emp = res.documents[0] as unknown as Employee | undefined;

        // Admin-Check
        const isAdmin = (user as { labels?: string[] }).labels?.includes("admin") ?? false;
        if (isAdmin) {
          setStatus("Admin erkannt. Weiterleitung…");
          router.replace("/admin");
          return;
        }

        if (!emp) {
          // Erstmaliger OAuth-Login → Profil als pending anlegen
          setStatus("Konto wird eingerichtet…");
          const nameParts = user.name?.trim().split(" ") ?? [""];
          const firstName = nameParts[0] ?? "";
          const lastName = nameParts.slice(1).join(" ") ?? "";

          await databases.createDocument(DB_ID, COLLECTIONS.EMPLOYEES, ID.unique(), {
            userId: user.$id,
            firstName,
            lastName,
            email: user.email,
            role: "employee",
            status: "pending",
            department: "",
            position: "",
            startDate: new Date().toISOString().split("T")[0],
            vacationDaysTotal: 25,
            vacationDaysUsed: 0,
            onboardingStep: "personal",
          });

          setStatus("Fast fertig…");
          router.replace("/onboarding");
          return;
        }

        // Bestehendes Profil — Status prüfen
        if (emp.status === "active") {
          setStatus("Willkommen! Weiterleitung…");
          router.replace("/dashboard");
        } else if (emp.status === "pending") {
          setStatus("Konto wird geprüft…");
          const step = emp.onboardingStep;
          if (!step || step === "personal") {
            router.replace("/onboarding");
          } else {
            router.replace("/pending");
          }
        } else if (emp.status === "rejected") {
          router.replace("/pending");
        } else {
          router.replace("/login");
        }
      } catch (e) {
        console.error("OAuth callback error:", e);
        setStatus("Ein Fehler ist aufgetreten. Weiterleitung…");
        setTimeout(() => router.replace("/login?error=callback"), 1500);
      }
    }

    handleCallback();
  }, [router, error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#4F772D]">
          <Leaf className="h-7 w-7 text-white" strokeWidth={1.5} />
        </div>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#4F772D] border-t-transparent" />
        <p className="text-sm text-gray-500">{status}</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#4F772D] border-t-transparent" />
      </div>
    }>
      <CallbackInner />
    </Suspense>
  );
}
