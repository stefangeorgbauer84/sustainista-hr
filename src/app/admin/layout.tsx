"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/layout/Sidebar";
import MobileSidebar from "@/components/layout/MobileSidebar";
import GuidedTour from "@/components/layout/GuidedTour";
import BrandStyle from "@/components/layout/BrandStyle";
import AdminBottomNav from "@/components/layout/AdminBottomNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdminUser, company, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (!isAdminUser) { router.replace("/dashboard"); return; }
    if (company && company.settings?.enabledModules === undefined && pathname !== "/admin/settings") {
      router.replace("/admin/settings");
    }
  }, [user, isAdminUser, company, loading, pathname, router]);

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-600" />
    </div>
  );
  if (!user || !isAdminUser) return null;

  return (
    <>
      <BrandStyle />
      <div className="flex h-screen overflow-hidden">
        <div className="hidden md:flex">
          <Sidebar />
        </div>
        <MobileSidebar />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 pb-24 pt-14 md:p-6 md:pb-6">
          {children}
        </main>
        <GuidedTour />
        <AdminBottomNav />
      </div>
    </>
  );
}
