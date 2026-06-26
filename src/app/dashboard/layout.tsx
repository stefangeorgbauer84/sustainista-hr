"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/layout/Sidebar";
import MobileSidebar from "@/components/layout/MobileSidebar";
import BrandStyle from "@/components/layout/BrandStyle";
import { Eye, X } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, employee, realEmployee, isImpersonating, viewAs, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (!isImpersonating && employee && !employee.is_active) {
      router.replace("/pending");
    }
  }, [user, employee, isImpersonating, loading, router]);

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-600" />
    </div>
  );
  if (!user) return null;

  return (
    <>
      <BrandStyle />
      {isImpersonating && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-md">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4" strokeWidth={1.5} />
            <span>
              Ansicht als <strong>{employee?.first_name} {employee?.last_name}</strong>
              {realEmployee && <span className="ml-2 opacity-70">(du: {realEmployee.first_name} {realEmployee.last_name})</span>}
            </span>
          </div>
          <button
            onClick={() => { viewAs(null); router.push("/admin/employees"); }}
            className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1 text-xs hover:bg-white/30 transition"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
            Ansicht beenden
          </button>
        </div>
      )}
      <div className={`flex h-screen overflow-hidden ${isImpersonating ? "pt-10" : ""}`}>
        <div className="hidden md:flex">
          <Sidebar />
        </div>
        <MobileSidebar />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 pt-14 md:p-6">
          {children}
        </main>
      </div>
    </>
  );
}
