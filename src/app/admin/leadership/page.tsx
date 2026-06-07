"use client";

import { useQuery } from "@tanstack/react-query";
import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { PERF_COLLECTIONS } from "@/app/lib/collections";
import { Query } from "appwrite";
import type { Employee, TimeEntry, LeaveRequest, CheckIn } from "@/types";
import { format, startOfMonth, endOfMonth, parseISO, differenceInDays } from "date-fns";
import { de } from "date-fns/locale";
import { AlertTriangle, TrendingUp, Users, Calendar, Clock, HeartPulse, Trophy, Lightbulb, ArrowRight } from "lucide-react";
import Link from "next/link";

const ENERGY_EMOJIS = ["", "😔", "😐", "🙂", "😊", "🌟"];
const ENERGY_LABELS = ["", "Erschöpft", "Müde", "Okay", "Gut", "Sehr gut"];

function StatCard({ label, value, sub, color = "text-gray-900", icon: Icon, href }: {
  label: string; value: string | number; sub?: string; color?: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  href?: string;
}) {
  const inner = (
    <div className={`rounded-xl border border-gray-200 bg-white p-5 ${href ? "hover:border-[#4F772D]/40 transition cursor-pointer" : ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className="rounded-lg bg-gray-50 p-2">
          <Icon className="h-5 w-5 text-gray-400" strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function LeadershipDashboard() {
  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["all-employees"],
    queryFn: async () => {
      const res = await databases.listDocuments(DB_ID, COLLECTIONS.EMPLOYEES, [
        Query.equal("status", "active"), Query.limit(100),
      ]);
      return res.documents as unknown as Employee[];
    },
  });

  const { data: timeEntries = [] } = useQuery<TimeEntry[]>({
    queryKey: ["all-time-month"],
    queryFn: async () => {
      const res = await databases.listDocuments(DB_ID, COLLECTIONS.TIME_ENTRIES, [
        Query.greaterThanEqual("date", monthStart),
        Query.lessThanEqual("date", monthEnd),
        Query.limit(500),
      ]);
      return res.documents as unknown as TimeEntry[];
    },
  });

  const { data: leaves = [] } = useQuery<LeaveRequest[]>({
    queryKey: ["all-leaves-approved"],
    queryFn: async () => {
      const res = await databases.listDocuments(DB_ID, COLLECTIONS.LEAVE_REQUESTS, [
        Query.equal("status", "approved"),
        Query.limit(200),
      ]);
      return res.documents as unknown as LeaveRequest[];
    },
  });

  const { data: checkins = [] } = useQuery<CheckIn[]>({
    queryKey: ["all-checkins"],
    queryFn: async () => {
      const res = await databases.listDocuments(DB_ID, PERF_COLLECTIONS.CHECK_INS, [
        Query.orderDesc("$createdAt"),
        Query.limit(200),
      ]);
      return res.documents as unknown as CheckIn[];
    },
  });

  const { data: pending = [] } = useQuery<Employee[]>({
    queryKey: ["pending-employees"],
    queryFn: async () => {
      const res = await databases.listDocuments(DB_ID, COLLECTIONS.EMPLOYEES, [
        Query.equal("status", "pending"), Query.limit(20),
      ]);
      return res.documents as unknown as Employee[];
    },
  });

  // ─── Derived metrics ─────────────────────────────────────────────────────

  function minutesForEmployee(empId: string) {
    return timeEntries
      .filter(e => e.employeeId === empId && e.endTime)
      .reduce((s, e) => {
        const [sh, sm] = e.startTime.split(":").map(Number);
        const [eh, em] = (e.endTime ?? "00:00").split(":").map(Number);
        return s + Math.max(0, (eh * 60 + em) - (sh * 60 + sm) - e.breakMinutes);
      }, 0);
  }

  const TARGET_MIN = 38 * 60; // 38h Vollzeit target/month (simplified)

  const overtimeAlerts = employees
    .map(e => ({ emp: e, minutes: minutesForEmployee(e.$id) }))
    .filter(x => x.minutes > TARGET_MIN + 10 * 60)
    .sort((a, b) => b.minutes - a.minutes);

  const noVacationAlerts = employees.filter(e => {
    const hasApprovedLeave = leaves.some(l =>
      l.employeeId === e.$id && l.type === "vacation" &&
      differenceInDays(now, parseISO(l.startDate)) < 90
    );
    return !hasApprovedLeave && e.vacationDaysUsed < e.vacationDaysTotal;
  });

  const totalVacationLeft = employees.reduce((s, e) => s + (e.vacationDaysTotal - e.vacationDaysUsed), 0);
  const avgVacationLeft = employees.length > 0 ? Math.round(totalVacationLeft / employees.length) : 0;

  // Team pulse this week
  const thisWeek = `${now.getFullYear()}-W${String(Math.ceil(((now.getTime() - new Date(now.getFullYear(),0,1).getTime()) / 86400000 + new Date(now.getFullYear(),0,1).getDay() + 1) / 7)).padStart(2,"0")}`;
  const weekCheckins = checkins.filter(c => c.weekLabel === thisWeek);
  const avgEnergy = weekCheckins.length > 0
    ? Math.round(weekCheckins.reduce((s, c) => s + c.energyLevel, 0) / weekCheckins.length * 10) / 10
    : null;
  const blockers = weekCheckins.filter(c => c.blocker && c.blocker.trim());

  // Who's absent today
  const todayStr = format(now, "yyyy-MM-dd");
  const absentToday = leaves.filter(l =>
    l.startDate <= todayStr && l.endDate >= todayStr && l.status === "approved"
  );

  const totalHoursThisMonth = Math.round(timeEntries.reduce((s, e) => {
    if (!e.endTime) return s;
    const [sh, sm] = e.startTime.split(":").map(Number);
    const [eh, em] = e.endTime.split(":").map(Number);
    return s + Math.max(0, (eh * 60 + em) - (sh * 60 + sm) - e.breakMinutes);
  }, 0) / 60);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Leadership Dashboard</h1>
        <p className="mt-0.5 text-sm text-gray-500">{format(now, "EEEE, d. MMMM yyyy", { locale: de })} · Team-Gesundheit auf einen Blick</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Aktive Mitarbeiter" value={employees.length} sub={`${pending.length} in Prüfung`} icon={Users} href="/admin/onboarding" />
        <StatCard label="Teamstunden (Monat)" value={`${totalHoursThisMonth}h`} sub={format(now, "MMMM yyyy", { locale: de })} icon={Clock} href="/admin/time" />
        <StatCard label="Ø Urlaubstage offen" value={avgVacationLeft} sub="pro Mitarbeiter" icon={Calendar} color={avgVacationLeft > 20 ? "text-amber-600" : "text-gray-900"} href="/admin/leave" />
        <StatCard label="Check-in Rate KW" value={`${weekCheckins.length}/${employees.length}`} sub="haben diese Woche eingecheckt" icon={HeartPulse} href="/admin/pulse" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Alerts */}
        <div className="space-y-3">
          {/* Überstunden-Alert */}
          {overtimeAlerts.length > 0 && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-5">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" strokeWidth={1.5} />
                <h2 className="text-sm font-semibold text-amber-800">Überstunden-Alert</h2>
              </div>
              <div className="space-y-2">
                {overtimeAlerts.slice(0, 5).map(({ emp, minutes }) => {
                  const h = Math.round(minutes / 60);
                  const over = Math.round((minutes - TARGET_MIN) / 60);
                  return (
                    <Link key={emp.$id} href={`/admin/employees/${emp.$id}`}
                      className="flex items-center justify-between rounded-lg bg-white px-3 py-2 hover:bg-amber-50 transition">
                      <span className="text-sm text-gray-900">{emp.firstName} {emp.lastName}</span>
                      <span className="text-xs font-medium text-amber-700">{h}h total · +{over}h Überstunden</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Kein Urlaub Alert */}
          {noVacationAlerts.length > 0 && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
              <div className="mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" strokeWidth={1.5} />
                <h2 className="text-sm font-semibold text-blue-800">Kein Urlaub in 90 Tagen</h2>
              </div>
              <div className="space-y-2">
                {noVacationAlerts.slice(0, 5).map(emp => (
                  <Link key={emp.$id} href={`/admin/employees/${emp.$id}`}
                    className="flex items-center justify-between rounded-lg bg-white px-3 py-2 hover:bg-blue-50 transition">
                    <span className="text-sm text-gray-900">{emp.firstName} {emp.lastName}</span>
                    <span className="text-xs text-blue-600">{emp.vacationDaysTotal - emp.vacationDaysUsed} Tage offen</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {overtimeAlerts.length === 0 && noVacationAlerts.length === 0 && (
            <div className="rounded-xl border border-green-100 bg-green-50 p-5">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="h-4 w-4 text-green-600" strokeWidth={1.5} />
                <p className="text-sm font-semibold text-green-800">Team-Gesundheit: Grün</p>
              </div>
              <p className="text-xs text-green-700">Keine kritischen Überstunden oder Urlaubs-Staus erkannt.</p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {/* Team Puls */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
                <h2 className="text-sm font-semibold text-gray-900">Team-Puls {thisWeek}</h2>
              </div>
              <Link href="/admin/pulse" className="flex items-center gap-1 text-xs text-[#4F772D] hover:underline">
                Details <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
              </Link>
            </div>
            {avgEnergy !== null ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{ENERGY_EMOJIS[Math.round(avgEnergy)]}</span>
                  <div>
                    <p className="text-lg font-bold text-gray-900">{avgEnergy}/5</p>
                    <p className="text-xs text-gray-400">{ENERGY_LABELS[Math.round(avgEnergy)]} im Schnitt · {weekCheckins.length} Check-ins</p>
                  </div>
                </div>
                {blockers.length > 0 && (
                  <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                    <p className="text-xs font-medium text-amber-700 mb-1.5">Blockers im Team ({blockers.length})</p>
                    <div className="space-y-1">
                      {blockers.slice(0, 3).map(c => (
                        <p key={c.$id} className="text-xs text-amber-600 truncate">· {c.blocker}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Noch keine Check-ins diese Woche</p>
            )}
          </div>

          {/* Abwesend heute */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
              <h2 className="text-sm font-semibold text-gray-900">Abwesend heute</h2>
            </div>
            {absentToday.length === 0 ? (
              <p className="text-xs text-gray-400">Alle anwesend</p>
            ) : (
              <div className="space-y-2">
                {absentToday.map(l => (
                  <div key={l.$id} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{l.employeeName}</span>
                    <span className={`text-xs rounded-full px-2 py-0.5 ${l.type === "vacation" ? "bg-[#4F772D]/10 text-[#4F772D]" : "bg-red-100 text-red-600"}`}>
                      {l.type === "vacation" ? "Urlaub" : l.type === "sick" ? "Krank" : "Abwesend"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: "/admin/pulse", label: "Team Puls", sub: "Check-in Trends", icon: HeartPulse },
          { href: "/admin/onboarding", label: "Onboarding", sub: `${pending.length} offen`, icon: Users },
          { href: "/admin/performance", label: "Performance", sub: "Reviews & OKRs", icon: TrendingUp },
          { href: "/admin/kaizen", label: "Kaizen-Board", sub: "Verbesserungen", icon: Lightbulb },
        ].map(({ href, label, sub, icon: Icon }) => (
          <Link key={href} href={href}
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3.5 hover:border-[#4F772D]/30 hover:bg-[#4F772D]/5 transition">
            <div className="rounded-lg bg-gray-50 p-2">
              <Icon className="h-4 w-4 text-[#4F772D]" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{label}</p>
              <p className="text-xs text-gray-400">{sub}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
