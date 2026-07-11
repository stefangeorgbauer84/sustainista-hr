"use client";

import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getRunningEntry, getTimeRecordsForEmployee, calcWorkedMinutes, formatDuration } from "@/lib/time";
import { getAbsencesForEmployee, getLeaveBalance } from "@/lib/leave";
import { supabase } from "@/lib/supabase";
import type { TimeRecord } from "@/types";
import { Clock, Calendar, FileText, TrendingUp, AlertCircle, Activity } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { de } from "date-fns/locale";
import Link from "next/link";
import { useEffect, useState } from "react";

const statusColors: Record<string, string> = {
  requested: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
};

function getElapsedLabel(startTime: string): string {
  const [h, m] = startTime.split(":").map(Number);
  const now = new Date();
  const elapsed = Math.max(0, now.getHours() * 60 + now.getMinutes() - (h * 60 + m));
  const hh = Math.floor(elapsed / 60);
  const mm = elapsed % 60;
  return hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
}

export default function DashboardPage() {
  const { employee } = useAuth();
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const { data: running } = useQuery({
    queryKey: ["running", employee?.id],
    queryFn: () => getRunningEntry(),
    enabled: !!employee,
    refetchInterval: 30_000,
  });

  const { data: records = [] } = useQuery({
    queryKey: ["time-records", employee?.id, now.getFullYear(), now.getMonth() + 1],
    queryFn: () => getTimeRecordsForEmployee(employee!.id, now.getFullYear(), now.getMonth() + 1),
    enabled: !!employee,
  });

  const { data: absences = [] } = useQuery({
    queryKey: ["absences", employee?.id],
    queryFn: () => getAbsencesForEmployee(employee!.id),
    enabled: !!employee,
  });

  const { data: leaveBalance } = useQuery({
    queryKey: ["leave-balance", employee?.id, now.getFullYear()],
    queryFn: () => getLeaveBalance(employee!.id, now.getFullYear()),
    enabled: !!employee,
  });

  const { data: nextAbsence } = useQuery({
    queryKey: ["next-absence", employee?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("absences")
        .select("start_date, end_date, working_days")
        .eq("employee_id", employee!.id)
        .eq("status", "approved")
        .gte("start_date", todayStr)
        .order("start_date", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!employee,
  });

  const { data: recentRecords = [] } = useQuery<TimeRecord[]>({
    queryKey: ["time-records-recent", employee?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("time_records")
        .select("*")
        .eq("employee_id", employee!.id)
        .not("end_time", "is", null)
        .order("created_at", { ascending: false })
        .limit(5);
      return (data ?? []) as TimeRecord[];
    },
    enabled: !!employee,
  });

  const totalMinutesThisMonth = records
    .filter(e => e.end_time !== null)
    .reduce((sum, e) => sum + calcWorkedMinutes(e), 0);

  const totalDays = leaveBalance
    ? leaveBalance.entitlement_days + (leaveBalance.carry_over_days ?? 0)
    : 25;
  const vacationLeft = leaveBalance
    ? totalDays - (leaveBalance.taken_days ?? 0) - (leaveBalance.approved_pending_days ?? 0)
    : 25;
  const pendingAbsences = absences.filter(a => a.status === "requested").length;
  const monthlyTargetMinutes = Math.round((employee?.hours_per_week ?? 40) * 52 / 12) * 60;
  const overtimeThisMonth = totalMinutesThisMonth - monthlyTargetMinutes;

  const greeting = () => {
    const h = now.getHours();
    if (h < 12) return "Guten Morgen";
    if (h < 18) return "Guten Tag";
    return "Guten Abend";
  };

  const recentActivity = [
    ...absences.map(a => ({ kind: "absence" as const, date: a.created_at, id: a.id, data: a })),
    ...recentRecords.map(r => ({ kind: "time" as const, date: r.created_at, id: r.id, data: r })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          {greeting()}, {employee?.first_name ?? "—"}
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {format(now, "EEEE, d. MMMM yyyy", { locale: de })}
        </p>
      </div>

      {/* Live-Timer */}
      {running && (
        <div className="flex items-center gap-3 rounded-xl border border-[#4F772D]/30 bg-[#4F772D]/5 px-4 py-3">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#4F772D]" />
          <div>
            <p className="text-sm text-[#4F772D] font-medium">
              Zeiterfassung läuft · {getElapsedLabel(running.start_time)}
            </p>
            <p className="text-[11px] text-[#4F772D]/60">Gestartet um {running.start_time.slice(0, 5)} Uhr</p>
          </div>
          <Link href="/dashboard/time" className="ml-auto text-xs text-[#4F772D] underline underline-offset-2">
            Stoppen →
          </Link>
        </div>
      )}

      {nextAbsence && (
        <div className="flex items-center gap-3 rounded-xl border border-purple-100 bg-purple-50 px-4 py-3">
          <Calendar className="h-4 w-4 shrink-0 text-purple-400" strokeWidth={1.5} />
          <div>
            <p className="text-sm font-medium text-purple-800">
              Nächster Urlaub — {format(parseISO(nextAbsence.start_date), "d. MMM", { locale: de })}
              {nextAbsence.start_date !== nextAbsence.end_date && ` bis ${format(parseISO(nextAbsence.end_date), "d. MMM yyyy", { locale: de })}`}
              {nextAbsence.working_days && ` · ${nextAbsence.working_days} Tage`}
            </p>
            <p className="mt-0.5 text-xs text-purple-500">
              in {differenceInDays(parseISO(nextAbsence.start_date), now)} Tagen
            </p>
          </div>
          <a href="/dashboard/leave" className="ml-auto text-xs text-purple-500 underline underline-offset-2">Details →</a>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<Clock className="h-5 w-5" strokeWidth={1.5} />} label="Diesen Monat" value={formatDuration(totalMinutesThisMonth)} sub="Arbeitszeit" color="blue" />
        <StatCard icon={<Calendar className="h-5 w-5" strokeWidth={1.5} />} label="Urlaubstage" value={`${vacationLeft} / ${totalDays}`} sub="verbleibend" color="green" />
        <StatCard icon={<AlertCircle className="h-5 w-5" strokeWidth={1.5} />} label="Offene Anträge" value={String(pendingAbsences)} sub="in Bearbeitung" color="yellow" />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" strokeWidth={1.5} />}
          label="Überstunden"
          value={`${overtimeThisMonth >= 0 ? "+" : ""}${formatDuration(Math.abs(overtimeThisMonth))}`}
          sub="diesen Monat"
          color={overtimeThisMonth > 0 ? "green" : overtimeThisMonth < -60 * 60 ? "red" : "gray"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-gray-500">Schnellzugriff</h2>
          <div className="grid gap-3">
            <QuickLink href="/dashboard/time" icon={<Clock className="h-5 w-5" strokeWidth={1.5} />} title="Zeiterfassung" desc="Arbeitszeit starten, stoppen oder manuell eintragen" />
            <QuickLink href="/dashboard/leave" icon={<Calendar className="h-5 w-5" strokeWidth={1.5} />} title="Urlaubsantrag stellen" desc="Urlaub oder Krankenstand eintragen" />
            <QuickLink href="/dashboard/zeitkonto" icon={<TrendingUp className="h-5 w-5" strokeWidth={1.5} />} title="Zeitkonto" desc="Überstunden-Saldo der letzten 6 Monate" />
            <QuickLink href="/dashboard/documents" icon={<FileText className="h-5 w-5" strokeWidth={1.5} />} title="Meine Dokumente" desc="Lohnzettel und Verträge abrufen" />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
            <h2 className="text-sm font-medium text-gray-900">Letzte Aktivitäten</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {recentActivity.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">Noch keine Aktivitäten</p>
            ) : recentActivity.map(item => {
              if (item.kind === "absence") {
                const absence = item.data as typeof absences[0];
                return (
                  <div key={`a-${item.id}`} className="flex items-start gap-3 px-5 py-3">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${statusColors[absence.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {absence.status === "approved" ? "✓" : absence.status === "rejected" ? "✗" : "…"}
                    </div>
                    <div>
                      <p className="text-sm text-gray-900">
                        Abwesenheitsantrag{" "}
                        <span className={`font-medium ${absence.status === "approved" ? "text-green-600" : absence.status === "rejected" ? "text-red-500" : "text-amber-600"}`}>
                          {absence.status === "approved" ? "genehmigt" : absence.status === "rejected" ? "abgelehnt" : "gestellt"}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400">
                        {format(parseISO(absence.start_date), "d. MMM", { locale: de })} –{" "}
                        {format(parseISO(absence.end_date), "d. MMM yyyy", { locale: de })}
                        {absence.working_days != null && ` · ${absence.working_days} Tage`}
                      </p>
                    </div>
                  </div>
                );
              }
              const record = item.data as TimeRecord;
              const mins = calcWorkedMinutes(record);
              return (
                <div key={`t-${item.id}`} className="flex items-start gap-3 px-5 py-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-500">
                    <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-900">
                      Zeiteintrag · <span className="font-medium text-blue-600">{formatDuration(mins)}</span>
                    </p>
                    <p className="text-xs text-gray-400">
                      {format(parseISO(record.work_date), "d. MMM", { locale: de })}
                      {" · "}{record.start_time.slice(0, 5)} – {record.end_time!.slice(0, 5)}
                    </p>
                  </div>
                </div>
              );
            })}
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
