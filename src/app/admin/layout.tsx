"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/layout/Sidebar";
import MobileSidebar from "@/components/layout/MobileSidebar";
import GuidedTour from "@/components/layout/GuidedTour";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdminUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (!isAdminUser) router.replace("/dashboard");
  }, [user, isAdminUser, loading, router]);

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#4F772D] border-t-transparent" />
    </div>
  );
  if (!user || !isAdminUser) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      <MobileSidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-4 pt-14 md:p-6">
        {children}
      </main>
      <GuidedTour />
    </div>
  );
}
