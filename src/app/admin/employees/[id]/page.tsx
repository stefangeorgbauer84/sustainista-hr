"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Employee, TimeRecord, Absence, Document, LeaveBalance } from "@/types";
import { calcWorkedMinutes, formatDuration } from "@/lib/time";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft, Clock, Calendar, FileText,
  Mail, Phone, Building, CreditCard, Download,
} from "lucide-react";

const statusColors: Record<string, string> = {
  requested: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
};

type AbsenceWithType = Absence & { absence_types: { code: string; name: string } | null };

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const now = new Date();

  const { data: employee } = useQuery<Employee>({
    queryKey: ["employee", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("id", id).single();
      if (error) throw error;
      return data as unknown as Employee;
    },
  });

  const { data: leaveBalance } = useQuery<LeaveBalance | null>({
    queryKey: ["leave-balance-detail", id, now.getFullYear()],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_balances").select("*").eq("employee_id", id).eq("year", now.getFullYear()).single();
      return data as LeaveBalance | null;
    },
    enabled: !!id,
  });

  const { data: timeEntries = [] } = useQuery<TimeRecord[]>({
    queryKey: ["time-entries-detail", id, now.getFullYear(), now.getMonth() + 1],
    queryFn: async () => {
      const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-31`;
      const { data, error } = await supabase
        .from("time_records").select("*").eq("employee_id", id)
        .gte("work_date", start).lte("work_date", end)
        .order("work_date", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as TimeRecord[];
    },
    enabled: !!id,
  });

  const { data: leaves = [] } = useQuery<AbsenceWithType[]>({
    queryKey: ["leaves-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("absences").select("*, absence_types(code, name)").eq("employee_id", id)
        .order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as AbsenceWithType[];
    },
    enabled: !!id,
  });

  const { data: docs = [] } = useQuery<Document[]>({
    queryKey: ["docs-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents").select("*").eq("employee_id", id)
        .order("uploaded_at", { ascending: false }).limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as Document[];
    },
    enabled: !!id,
  });

  const totalMins = timeEntries.filter(e => e.end_time !== null).reduce((s, e) => s + calcWorkedMinutes(e), 0);
  const overtime = totalMins - 160 * 60;
  const sickDaysThisYear = leaves
    .filter(l => l.absence_types?.code === "krankenstand" && l.status === "approved" && l.start_date.startsWith(String(now.getFullYear())))
    .reduce((s, l) => s + (l.working_days ?? 0), 0);

  const efzgWeeks = sickDaysThisYear <= 30 ? "Volle Entgeltfortzahlung" :
    sickDaysThisYear <= 50 ? "Halbe Entgeltfortzahlung (§ 8 EFZG)" : "Keine Entgeltfortzahlung";

  const vacationLeft = leaveBalance
    ? (leaveBalance.entitlement_days + (leaveBalance.carry_over_days ?? 0)) - (leaveBalance.taken_days ?? 0)
    : null;

  if (!employee) return (
    <div className="flex h-full items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-4 border-[#4F772D] border-t-transparent" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/employees" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          Zurück
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#4F772D]/10 text-2xl font-bold text-[#4F772D]">
              {employee.first_name[0]}{employee.last_name[0]}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {employee.first_name} {employee.last_name}
              </h1>
              <p className="text-sm text-gray-500">{employee.employment_type}</p>
              <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-gray-400">
                {employee.contact_email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" strokeWidth={1.5} />{employee.contact_email}</span>}
                {employee.contact_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" strokeWidth={1.5} />{employee.contact_phone}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Eintrittsdatum" value={format(parseISO(employee.entry_date), "d. MMM yyyy", { locale: de })} icon={<Building className="h-4 w-4" strokeWidth={1.5} />} />
          <Stat label="Urlaubstage" value={vacationLeft !== null ? `${vacationLeft}/${leaveBalance!.entitlement_days + (leaveBalance!.carry_over_days ?? 0)}` : "—"} icon={<Calendar className="h-4 w-4" strokeWidth={1.5} />} />
          <Stat label="Diesen Monat" value={formatDuration(totalMins)} icon={<Clock className="h-4 w-4" strokeWidth={1.5} />} />
          <Stat
            label="Überstunden"
            value={overtime >= 0 ? `+${formatDuration(overtime)}` : `-${formatDuration(Math.abs(overtime))}`}
            icon={<Clock className="h-4 w-4" strokeWidth={1.5} />}
            warn={overtime > 10 * 60}
          />
        </div>

        {employee.bank_iban && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            <CreditCard className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
            IBAN: <span className="font-mono font-medium text-gray-700">{employee.bank_iban}</span>
          </div>
        )}
      </div>

      {sickDaysThisYear > 0 && (
        <div className={`rounded-xl border px-5 py-4 ${sickDaysThisYear > 30 ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"}`}>
          <p className="text-sm font-medium text-gray-900">Krankenstand {now.getFullYear()}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {sickDaysThisYear} Kranktage · <strong>{efzgWeeks}</strong>
          </p>
          <div className="mt-2 h-2 rounded-full bg-gray-200">
            <div className="h-2 rounded-full bg-red-400 transition-all" style={{ width: `${Math.min(100, (sickDaysThisYear / 30) * 100)}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-gray-400">30 Arbeitstage = Ende der vollen Entgeltfortzahlung (§ 8 EFZG)</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
            <h2 className="text-sm font-medium text-gray-900">Zeiterfassung — {format(now, "MMMM", { locale: de })}</h2>
          </div>
          <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {timeEntries.length === 0 ? (
              <p className="px-5 py-6 text-center text-xs text-gray-400">Keine Einträge</p>
            ) : timeEntries.slice(0, 10).map(e => (
              <div key={e.id} className="flex items-center justify-between px-5 py-2.5">
                <div>
                  <p className="text-xs font-medium text-gray-900">{format(parseISO(e.work_date), "EEE d. MMM", { locale: de })}</p>
                  <p className="text-[10px] text-gray-400">{e.start_time} – {e.end_time ?? "läuft"}</p>
                </div>
                <p className="text-xs font-medium text-gray-700">{e.end_time ? formatDuration(calcWorkedMinutes(e)) : "—"}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
            <h2 className="text-sm font-medium text-gray-900">Abwesenheiten</h2>
          </div>
          <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {leaves.length === 0 ? (
              <p className="px-5 py-6 text-center text-xs text-gray-400">Keine Anträge</p>
            ) : leaves.map(l => (
              <div key={l.id} className="flex items-center justify-between px-5 py-2.5">
                <div>
                  <p className="text-xs font-medium text-gray-900">
                    {l.absence_types?.name ?? l.absence_type_id}
                    {l.working_days != null && ` · ${l.working_days} Tage`}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {format(parseISO(l.start_date), "d. MMM", { locale: de })} – {format(parseISO(l.end_date), "d. MMM yyyy", { locale: de })}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[l.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {l.status === "approved" ? "Genehmigt" : l.status === "requested" ? "Offen" : "Abgelehnt"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
            <h2 className="text-sm font-medium text-gray-900">Dokumente ({docs.length})</h2>
          </div>
          <Link href="/admin/documents" className="text-xs text-[#4F772D] hover:underline">
            Dokument hochladen →
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {docs.length === 0 ? (
            <p className="px-5 py-6 text-center text-xs text-gray-400">Noch keine Dokumente</p>
          ) : docs.map(doc => {
            const { data: urlData } = supabase.storage.from("documents").getPublicUrl(doc.storage_path);
            return (
              <div key={doc.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm text-gray-900">{doc.title}</p>
                  <p className="text-xs text-gray-400">{doc.file_name}</p>
                </div>
                <a
                  href={urlData.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-lg bg-[#4F772D]/10 px-3 py-1.5 text-xs font-medium text-[#4F772D] hover:bg-[#4F772D]/20 transition"
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Download
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon, warn }: { label: string; value: string; icon: React.ReactNode; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2.5">
      <div className={`mb-1 ${warn ? "text-amber-500" : "text-gray-400"}`}>{icon}</div>
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className={`text-sm font-semibold ${warn ? "text-amber-600" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}
