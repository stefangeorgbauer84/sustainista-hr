"use client";

import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { getRunningEntry, getTimeEntriesForEmployee, calcWorkedMinutes, formatDuration } from "@/lib/time";
import { getLeaveRequestsForEmployee } from "@/lib/leave";
import { Clock, Calendar, FileText, TrendingUp, AlertCircle, Activity } from "lucide-react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import Link from "next/link";
import { toast } from "sonner";
import { Suspense, useEffect } from "react";

const typeLabels: Record<string, string> = {
  vacation: "Urlaub", sick: "Krankenstand", unpaid: "Unbezahlt", special: "Sonder",
};
const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
};

function GCalNotice() {
  const params = useSearchParams();
  useEffect(() => {
    if (params.get("gcal") === "connected") toast.success("Google Calendar verbunden!");
    if (params.get("gcal") === "error") toast.error("Google Calendar Verbindung fehlgeschlagen.");
  }, [params]);
  return null;
}

export default function DashboardPage() {
  const { employee } = useAuth();
  const now = new Date();

  const { data: running } = useQuery({
    queryKey: ["running", employee?.$id],
    queryFn: () => getRunningEntry(employee!.$id),
    enabled: !!employee,
    refetchInterval: 30_000,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["time-entries", employee?.$id, now.getFullYear(), now.getMonth() + 1],
    queryFn: () => getTimeEntriesForEmployee(employee!.$id, now.getFullYear(), now.getMonth() + 1),
    enabled: !!employee,
  });

  const { data: leaves = [] } = useQuery({
    queryKey: ["leaves", employee?.$id],
    queryFn: () => getLeaveRequestsForEmployee(employee!.$id),
    enabled: !!employee,
  });

  const totalMinutesThisMonth = entries
    .filter(e => e.status !== "running")
    .reduce((sum, e) => sum + calcWorkedMinutes(e), 0);

  const vacationLeft = (employee?.vacationDaysTotal ?? 25) - (employee?.vacationDaysUsed ?? 0);
  const pendingLeaves = leaves.filter(l => l.status === "pending").length;
  const overtimeThisMonth = totalMinutesThisMonth - 160 * 60;

  const greeting = () => {
    const h = now.getHours();
    if (h < 12) return "Guten Morgen";
    if (h < 18) return "Guten Tag";
    return "Guten Abend";
  };

  // Activity Feed: letzte 5 Urlaubsanträge als Events
  const recentActivity = [...leaves]
    .sort((a, b) => b.$createdAt.localeCompare(a.$createdAt))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <Suspense fallback={null}><GCalNotice /></Suspense>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          {greeting()}, {employee?.firstName ?? "—"}
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {format(now, "EEEE, d. MMMM yyyy", { locale: de })}
        </p>
      </div>

      {running && (
        <div className="flex items-center gap-3 rounded-xl border border-[#4F772D]/30 bg-[#4F772D]/5 px-4 py-3">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#4F772D]" />
          <p className="text-sm text-[#4F772D] font-medium">
            Zeiterfassung läuft seit {running.startTime} Uhr
          </p>
          <Link href="/dashboard/time" className="ml-auto text-xs text-[#4F772D] underline underline-offset-2">
            Stoppen →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<Clock className="h-5 w-5" strokeWidth={1.5} />} label="Diesen Monat" value={formatDuration(totalMinutesThisMonth)} sub="Arbeitszeit" color="blue" />
        <StatCard icon={<Calendar className="h-5 w-5" strokeWidth={1.5} />} label="Urlaubstage" value={`${vacationLeft} / ${employee?.vacationDaysTotal ?? 25}`} sub="verbleibend" color="green" />
        <StatCard icon={<AlertCircle className="h-5 w-5" strokeWidth={1.5} />} label="Offene Anträge" value={String(pendingLeaves)} sub="in Bearbeitung" color="yellow" />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" strokeWidth={1.5} />}
          label="Überstunden"
          value={`${overtimeThisMonth >= 0 ? "+" : ""}${formatDuration(Math.abs(overtimeThisMonth))}`}
          sub="diesen Monat"
          color={overtimeThisMonth > 0 ? "green" : overtimeThisMonth < -60 * 60 ? "red" : "gray"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Schnellzugriff */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-gray-500">Schnellzugriff</h2>
          <div className="grid gap-3">
            <QuickLink href="/dashboard/time" icon={<Clock className="h-5 w-5" strokeWidth={1.5} />} title="Zeiterfassung" desc="Arbeitszeit starten, stoppen oder manuell eintragen" />
            <QuickLink href="/dashboard/leave" icon={<Calendar className="h-5 w-5" strokeWidth={1.5} />} title="Urlaubsantrag stellen" desc="Urlaub oder Krankenstand eintragen" />
            <QuickLink href="/dashboard/zeitkonto" icon={<TrendingUp className="h-5 w-5" strokeWidth={1.5} />} title="Zeitkonto" desc="Überstunden-Saldo der letzten 6 Monate" />
            <QuickLink href="/dashboard/documents" icon={<FileText className="h-5 w-5" strokeWidth={1.5} />} title="Meine Dokumente" desc="Lohnzettel und Verträge abrufen" />
          </div>
        </div>

        {/* Activity Feed */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
            <h2 className="text-sm font-medium text-gray-900">Letzte Aktivitäten</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {recentActivity.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">Noch keine Aktivitäten</p>
            ) : recentActivity.map(leave => (
              <div key={leave.$id} className="flex items-start gap-3 px-5 py-3">
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${statusColors[leave.status]}`}>
                  {leave.status === "approved" ? "✓" : leave.status === "rejected" ? "✗" : "…"}
                </div>
                <div>
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">{typeLabels[leave.type]}</span>-Antrag{" "}
                    <span className={`font-medium ${leave.status === "approved" ? "text-green-600" : leave.status === "rejected" ? "text-red-500" : "text-amber-600"}`}>
                      {leave.status === "approved" ? "genehmigt" : leave.status === "rejected" ? "abgelehnt" : "gestellt"}
                    </span>
                  </p>
                  <p className="text-xs text-gray-400">
                    {format(parseISO(leave.startDate), "d. MMM", { locale: de })} –{" "}
                    {format(parseISO(leave.endDate), "d. MMM yyyy", { locale: de })} · {leave.days} Tage
                  </p>
                  <p className="text-[10px] text-gray-300 mt-0.5">
                    {format(parseISO(leave.$createdAt), "d. MMM yyyy, HH:mm", { locale: de })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string;
  color: "blue" | "green" | "yellow" | "gray" | "red";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-[#4F772D]/10 text-[#4F772D]",
    yellow: "bg-amber-50 text-amber-600",
    gray: "bg-gray-100 text-gray-600",
    red: "bg-red-50 text-red-500",
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className={`mb-3 inline-flex rounded-lg p-2 ${colors[color]}`}>{icon}</div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </div>
  );
}

function QuickLink({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 transition hover:border-[#4F772D]/40 hover:shadow-sm">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#4F772D]/10 text-[#4F772D]">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="mt-0.5 text-xs text-gray-500">{desc}</p>
      </div>
    </Link>
  );
}
