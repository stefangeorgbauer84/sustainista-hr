"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { logout } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  Clock, Calendar, CalendarDays, FileText, Home, Users,
  BarChart2, LogOut, Leaf, User, TrendingUp, UserCheck,
  Trophy, HeartPulse, Target, Lightbulb, ClipboardList, Globe,
  Building2, LayoutGrid, MapPin, Settings,
} from "lucide-react";
import { TourStartButton } from "@/components/layout/GuidedTour";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  moduleKey?: string;
}

const employeeNav: NavItem[] = [
  { href: "/dashboard", label: "Übersicht", icon: <Home strokeWidth={1.5} className="h-4 w-4" /> },
  { href: "/dashboard/time", label: "Zeiterfassung", icon: <Clock strokeWidth={1.5} className="h-4 w-4" />, moduleKey: "time" },
  { href: "/dashboard/leave", label: "Urlaub & Abwesenheit", icon: <Calendar strokeWidth={1.5} className="h-4 w-4" />, moduleKey: "leave" },
  { href: "/dashboard/calendar", label: "Teamkalender", icon: <Users strokeWidth={1.5} className="h-4 w-4" />, moduleKey: "calendar" },
  { href: "/dashboard/documents", label: "Meine Dokumente", icon: <FileText strokeWidth={1.5} className="h-4 w-4" />, moduleKey: "documents" },
  { href: "/dashboard/zeitkonto", label: "Zeitkonto", icon: <TrendingUp strokeWidth={1.5} className="h-4 w-4" />, moduleKey: "zeitkonto" },
  { href: "/dashboard/wins", label: "Meine Wins", icon: <Trophy strokeWidth={1.5} className="h-4 w-4" />, moduleKey: "wins" },
  { href: "/dashboard/schedule", label: "Dienstplan", icon: <CalendarDays strokeWidth={1.5} className="h-4 w-4" />, moduleKey: "schedule" },
  { href: "/dashboard/checkin", label: "Check-in", icon: <HeartPulse strokeWidth={1.5} className="h-4 w-4" />, moduleKey: "checkin" },
  { href: "/dashboard/okrs", label: "Meine OKRs", icon: <Target strokeWidth={1.5} className="h-4 w-4" />, moduleKey: "okrs" },
  { href: "/dashboard/kaizen", label: "Kaizen-Board", icon: <Lightbulb strokeWidth={1.5} className="h-4 w-4" />, moduleKey: "kaizen" },
  { href: "/dashboard/review", label: "Performance Review", icon: <ClipboardList strokeWidth={1.5} className="h-4 w-4" />, moduleKey: "review" },
  { href: "/dashboard/culture", label: "Kultur & Werte", icon: <Globe strokeWidth={1.5} className="h-4 w-4" />, moduleKey: "culture" },
  { href: "/dashboard/profile", label: "Mein Profil", icon: <User strokeWidth={1.5} className="h-4 w-4" /> },
];

function buildAdminNav(pendingCount: number, changeRequestCount: number): NavItem[] {
  return [
    { href: "/admin/leadership", label: "Leadership", icon: <TrendingUp strokeWidth={1.5} className="h-4 w-4" />, moduleKey: "leadership" },
    { href: "/admin", label: "Übersicht", icon: <Home strokeWidth={1.5} className="h-4 w-4" /> },
    { href: "/admin/employees", label: "Mitarbeiter", icon: <Users strokeWidth={1.5} className="h-4 w-4" /> },
    {
      href: "/admin/onboarding", label: "Onboarding",
      icon: <UserCheck strokeWidth={1.5} className="h-4 w-4" />,
      badge: pendingCount > 0 ? pendingCount : undefined,
      moduleKey: "onboarding",
    },
    { href: "/admin/schedule", label: "Dienstplan", icon: <CalendarDays strokeWidth={1.5} className="h-4 w-4" />, badge: changeRequestCount > 0 ? changeRequestCount : undefined, moduleKey: "schedule" },
    { href: "/admin/time", label: "Zeiterfassung", icon: <Clock strokeWidth={1.5} className="h-4 w-4" />, moduleKey: "time" },
    { href: "/admin/leave", label: "Urlaubsanträge", icon: <Calendar strokeWidth={1.5} className="h-4 w-4" />, moduleKey: "leave" },
    { href: "/admin/pulse", label: "Team-Puls", icon: <HeartPulse strokeWidth={1.5} className="h-4 w-4" />, moduleKey: "pulse" },
    { href: "/admin/performance", label: "Performance", icon: <ClipboardList strokeWidth={1.5} className="h-4 w-4" />, moduleKey: "performance" },
    { href: "/admin/kaizen", label: "Kaizen-Board", icon: <Lightbulb strokeWidth={1.5} className="h-4 w-4" />, moduleKey: "kaizen" },
    { href: "/admin/reports", label: "Reports", icon: <BarChart2 strokeWidth={1.5} className="h-4 w-4" />, moduleKey: "reports" },
    { href: "/admin/documents", label: "Dokumente", icon: <FileText strokeWidth={1.5} className="h-4 w-4" />, moduleKey: "documents" },
    { href: "/admin/locations", label: "Filialen", icon: <MapPin strokeWidth={1.5} className="h-4 w-4" />, moduleKey: "locations" },
  ];
}

function getCompanyInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function CompanyIcon({ company }: { company: { name: string; brand_config?: { icon?: string } } | null }) {
  const icon = company?.brand_config?.icon;
  if (icon === "building") return <Building2 className="h-4 w-4 text-white" strokeWidth={1.5} />;
  if (icon === "globe") return <Globe className="h-4 w-4 text-white" strokeWidth={1.5} />;
  if (icon === "leaf") return <Leaf className="h-4 w-4 text-white" strokeWidth={1.5} />;
  if (company) return <span className="text-[11px] font-bold text-white">{getCompanyInitials(company.name)}</span>;
  return <Leaf className="h-4 w-4 text-white" strokeWidth={1.5} />;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, employee, isAdminUser, isSuperAdmin, company } = useAuth();
  const primaryColor = company?.brand_config?.primaryColor ?? "#4F772D";

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["pending-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("is_active", false)
        .filter("custom_fields->>status", "eq", "pending");
      return count ?? 0;
    },
    enabled: isAdminUser,
    refetchInterval: 60_000,
  });

  const { data: changeRequestCount = 0 } = useQuery({
    queryKey: ["pending-change-requests-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("schedule_change_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      return count ?? 0;
    },
    enabled: isAdminUser,
    refetchInterval: 60_000,
  });

  const enabledModules = company?.settings?.enabledModules;
  const rawNav = isAdminUser ? buildAdminNav(pendingCount, changeRequestCount) : employeeNav;
  const nav = enabledModules
    ? rawNav.filter(item => !item.moduleKey || enabledModules.includes(item.moduleKey))
    : rawNav;

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
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0"
          style={{ backgroundColor: primaryColor }}
        >
          <CompanyIcon company={company} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{company?.name ?? "HR Tool"}</p>
          <p className="text-[10px] text-gray-400">{isAdminUser ? "Administration" : "Mitarbeiter"}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {isSuperAdmin && (
          <Link
            href="/super-admin"
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition mb-1 ${
              pathname.startsWith("/super-admin")
                ? "font-medium"
                : "text-gray-500 hover:bg-gray-100"
            }`}
            style={pathname.startsWith("/super-admin") ? { backgroundColor: `${primaryColor}1A`, color: primaryColor } : {}}
          >
            <LayoutGrid strokeWidth={1.5} className="h-4 w-4" />
            <span className="flex-1">Alle Unternehmen</span>
          </Link>
        )}
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                active ? "font-medium" : "text-gray-600 hover:bg-gray-100"
              }`}
              style={active ? { backgroundColor: `${primaryColor}1A`, color: primaryColor } : {}}
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
            {employee ? `${employee.first_name} ${employee.last_name}` : user?.email ?? "—"}
          </p>
          <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
        </div>
        {isAdminUser && (
          <Link
            href="/admin/settings"
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition mb-0.5 ${
              pathname.startsWith("/admin/settings") ? "font-medium" : "text-gray-500 hover:bg-gray-100"
            }`}
            style={pathname.startsWith("/admin/settings") ? { backgroundColor: `${primaryColor}1A`, color: primaryColor } : {}}
          >
            <Settings strokeWidth={1.5} className="h-4 w-4" />
            Einstellungen
          </Link>
        )}
        <TourStartButton />
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
