"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { logout } from "@/lib/auth";
import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { Query } from "appwrite";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  Clock, Calendar, FileText, Home, Users,
  BarChart2, LogOut, Leaf, User, TrendingUp, UserCheck,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

const employeeNav: NavItem[] = [
  { href: "/dashboard", label: "Übersicht", icon: <Home strokeWidth={1.5} className="h-4 w-4" /> },
  { href: "/dashboard/time", label: "Zeiterfassung", icon: <Clock strokeWidth={1.5} className="h-4 w-4" /> },
  { href: "/dashboard/leave", label: "Urlaub & Abwesenheit", icon: <Calendar strokeWidth={1.5} className="h-4 w-4" /> },
  { href: "/dashboard/calendar", label: "Teamkalender", icon: <Users strokeWidth={1.5} className="h-4 w-4" /> },
  { href: "/dashboard/documents", label: "Meine Dokumente", icon: <FileText strokeWidth={1.5} className="h-4 w-4" /> },
  { href: "/dashboard/zeitkonto", label: "Zeitkonto", icon: <TrendingUp strokeWidth={1.5} className="h-4 w-4" /> },
  { href: "/dashboard/profile", label: "Mein Profil", icon: <User strokeWidth={1.5} className="h-4 w-4" /> },
];

function buildAdminNav(pendingCount: number): NavItem[] {
  return [
    { href: "/admin", label: "Übersicht", icon: <Home strokeWidth={1.5} className="h-4 w-4" /> },
    { href: "/admin/employees", label: "Mitarbeiter", icon: <Users strokeWidth={1.5} className="h-4 w-4" /> },
    {
      href: "/admin/onboarding", label: "Onboarding",
      icon: <UserCheck strokeWidth={1.5} className="h-4 w-4" />,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    { href: "/admin/time", label: "Zeiterfassung", icon: <Clock strokeWidth={1.5} className="h-4 w-4" /> },
    { href: "/admin/leave", label: "Urlaubsanträge", icon: <Calendar strokeWidth={1.5} className="h-4 w-4" /> },
    { href: "/admin/reports", label: "Reports", icon: <BarChart2 strokeWidth={1.5} className="h-4 w-4" /> },
    { href: "/admin/documents", label: "Dokumente", icon: <FileText strokeWidth={1.5} className="h-4 w-4" /> },
  ];
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, employee, isAdminUser } = useAuth();

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["pending-count"],
    queryFn: async () => {
      const res = await databases.listDocuments(DB_ID, COLLECTIONS.EMPLOYEES, [
        Query.equal("status", "pending"), Query.limit(1),
      ]);
      return res.total;
    },
    enabled: isAdminUser,
    refetchInterval: 60_000,
  });

  const nav = isAdminUser ? buildAdminNav(pendingCount) : employeeNav;

  async function handleLogout() {
    try {
      await logout();
      router.replace("/login");
    } catch {
      toast.error("Abmelden fehlgeschlagen");
    }
  }

  return (
    <aside className="flex h-full w-60 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2.5 border-b border-gray-200 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#4F772D]">
          <Leaf className="h-4 w-4 text-white" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Sustainista HR</p>
          <p className="text-[10px] text-gray-400">{isAdminUser ? "Administration" : "Mitarbeiter"}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-[#4F772D]/10 font-medium text-[#4F772D]"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.badge !== undefined && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 px-3 py-3">
        <div className="mb-2 rounded-lg px-3 py-2">
          <p className="text-xs font-medium text-gray-900 truncate">
            {employee ? `${employee.firstName} ${employee.lastName}` : user?.name ?? "—"}
          </p>
          <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-500 transition hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.5} />
          Abmelden
        </button>
      </div>
    </aside>
  );
}
