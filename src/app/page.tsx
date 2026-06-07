"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const { user, employee, isAdminUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (isAdminUser) { router.replace("/admin"); return; }
    if (!employee) { router.replace("/login"); return; }
    if (employee.status === "pending") {
      if (!employee.onboardingStep || employee.onboardingStep === "personal") {
        router.replace("/onboarding");
      } else {
        router.replace("/pending");
      }
      return;
    }
    if (employee.status === "rejected") { router.replace("/pending"); return; }
    router.replace("/dashboard");
  }, [user, employee, isAdminUser, loading, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#4F772D] border-t-transparent" />
    </div>
  );
}
