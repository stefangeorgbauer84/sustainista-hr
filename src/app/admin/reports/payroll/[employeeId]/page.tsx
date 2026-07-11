"use client";

import { use, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { canSeeBrutto } from "@/lib/rbac";
import type { Employee, TimeRecord, Absence, LeaveBalance } from "@/types";
import { getTimeRecordsForEmployee, calcWorkedMinutes, formatDuration, monthRange, selectableYears } from "@/lib/time";
import { isHoliday } from "@/lib/holidays";
import { format, parseISO, getDaysInMonth, isWeekend } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";

const MONTH_NAMES = [
  "Jänner", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "Vollzeit", part_time: "Teilzeit", marginal: "Geringfügig",
  apprentice: "Lehrling", freelance: "Freier Dienstnehmer", intern: "Praktikum",
};

const ABSENCE_LABELS: Record<string, string> = {
  urlaub: "Urlaub", krankenstand: "Krankenstand", zeitausgleich: "Zeitausgleich",
  sonderurlaub: "Sonderurlaub", pflegefreistellung: "Pflegefreistellung",
  unbezahlt: "Unbezahlter Urlaub", homeoffice: "Homeoffice", dienstreise: "Dienstreise",
};

type AbsenceWithType = Absence & { absence_types: { code: string; name: string } | null };

function getTargetMinutes(year: number, month: number, hoursPerWeek = 40): number {
  let workdays = 0;
  const days = getDaysInMonth(new Date(year, month - 1));
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month - 1, d);
    if (!isWeekend(date) && !isHoliday(format(date, "yyyy-MM-dd"))) workdays++;
  }
  return Math.round(workdays * (hoursPerWeek / 5) * 60);
}

function euro(v: number): string {
  return `€ ${v.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function EmployeeStatementPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = use(params);
  const { company, profile } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const showBrutto = canSeeBrutto(profile?.role);

  const { data: employee } = useQuery<Employee | null>({
    queryKey: ["statement-employee", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("id", employeeId).single();
      if (error) throw error;
      return data as unknown as Employee;
    },
  });

  const { data: records = [] } = useQuery<TimeRecord[]>({
    queryKey: ["statement-time", employeeId, year, month],
    queryFn: () => getTimeRecordsForEmployee(employeeId, year, month),
  });

  const { data: absences = [] } = useQuery<AbsenceWithType[]>({
    queryKey: ["statement-absences", employeeId, year, month],
    queryFn: async () => {
      const { start, end } = monthRange(year, month);
      const { data, error } = await supabase
        .from("absences")
        .select("*, absence_types(code, name)")
        .eq("employee_id", employeeId)
        .eq("status", "approved")
        .lte("start_date", end)
        .gte("end_date", start)
        .order("start_date");
      if (error) throw error;
      return (data ?? []) as unknown as AbsenceWithType[];
    },
  });

  const { data: leaveBalance } = useQuery<LeaveBalance | null>({
    queryKey: ["statement-leave", employeeId, year],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("year", year)
        .maybeSingle();
      return (data ?? null) as LeaveBalance | null;
    },
  });

  const done = useMemo(
    () => records
      .filter(r => r.end_time != null && r.status !== "rejected")
      .sort((a, b) => a.work_date.localeCompare(b.work_date)),
    [records]
  );
  const totalMinutes = done.reduce((s, r) => s + calcWorkedMinutes(r), 0);
  const targetMinutes = getTargetMinutes(year, month, employee?.hours_per_week ?? 40);
  const diff = totalMinutes - targetMinutes;
  const gross = parseFloat((employee?.custom_fields as Record<string, string>)?.brutto ?? "") || 0;

  const vacationTotal = leaveBalance ? leaveBalance.entitlement_days + (leaveBalance.carry_over_days ?? 0) : null;
  const vacationLeft = leaveBalance && vacationTotal != null
    ? vacationTotal - (leaveBalance.taken_days ?? 0) - (leaveBalance.approved_pending_days ?? 0)
    : null;

  return (
    <div className="space-y-5">
      {/* Print-Regeln: nur das Blatt drucken, App-Chrome ausblenden */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #lohnzettel, #lohnzettel * { visibility: visible; }
          #lohnzettel { position: absolute; left: 0; top: 0; width: 100%; border: none !important; box-shadow: none !important; }
          @page { size: A4; margin: 15mm; }
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-3" data-print-hide>
        <Link href="/admin/reports/payroll" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Lohnexport
        </Link>
        <div className="flex items-center gap-2">
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-[#4F772D] focus:outline-none">
            {MONTH_NAMES.map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-[#4F772D] focus:outline-none">
            {selectableYears().map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] transition"
          >
            <Printer className="h-4 w-4" strokeWidth={1.5} />
            PDF herunterladen
          </button>
        </div>
      </div>

      {/* Das druckbare Blatt */}
      <div id="lohnzettel" className="mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white p-8 text-[13px] text-gray-900">
        <div className="mb-6 flex items-start justify-between border-b border-gray-900 pb-4">
          <div>
            <p className="text-lg font-bold">{company?.name ?? "—"}</p>
            <p className="text-xs text-gray-500">Monatsabrechnung &amp; Arbeitszeitaufzeichnung (§ 26 AZG)</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">{MONTH_NAMES[month - 1]} {year}</p>
            <p className="text-xs text-gray-500">Erstellt am {format(now, "d. MMMM yyyy", { locale: de })}</p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-x-8 gap-y-2">
          <div><span className="text-xs text-gray-500">Mitarbeiter</span><p className="font-medium">{employee ? `${employee.first_name} ${employee.last_name}` : "—"}</p></div>
          <div><span className="text-xs text-gray-500">Dienstnummer</span><p className="font-medium">{employee?.employee_number ?? "—"}</p></div>
          <div><span className="text-xs text-gray-500">Beschäftigungsart</span><p className="font-medium">{employee ? (EMPLOYMENT_LABELS[employee.employment_type] ?? employee.employment_type) : "—"}</p></div>
          <div><span className="text-xs text-gray-500">Wochenstunden</span><p className="font-medium">{employee?.hours_per_week ?? "—"}h</p></div>
          {showBrutto && gross > 0 && (
            <div><span className="text-xs text-gray-500">Bruttobezug (Monat)</span><p className="font-medium">{euro(gross)}</p></div>
          )}
          {vacationLeft != null && (
            <div><span className="text-xs text-gray-500">Resturlaub {year}</span><p className="font-medium">{vacationLeft} von {vacationTotal} Tagen</p></div>
          )}
        </div>

        <h2 className="mb-2 text-sm font-semibold">Arbeitszeiten</h2>
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-gray-300 text-left text-[11px] uppercase tracking-wide text-gray-500">
              <th className="py-1.5 pr-2">Datum</th>
              <th className="py-1.5 pr-2">Beginn</th>
              <th className="py-1.5 pr-2">Ende</th>
              <th className="py-1.5 pr-2">Pause</th>
              <th className="py-1.5 pr-2 text-right">Netto</th>
              <th className="py-1.5 pl-3">Notiz</th>
            </tr>
          </thead>
          <tbody>
            {done.length === 0 ? (
              <tr><td colSpan={6} className="py-4 text-center text-gray-400">Keine Zeiteinträge in diesem Monat</td></tr>
            ) : done.map(r => (
              <tr key={r.id} className="border-b border-gray-100">
                <td className="py-1.5 pr-2">{format(parseISO(r.work_date), "EEE, dd.MM.", { locale: de })}</td>
                <td className="py-1.5 pr-2">{r.start_time.slice(0, 5)}</td>
                <td className="py-1.5 pr-2">{r.end_time!.slice(0, 5)}</td>
                <td className="py-1.5 pr-2">{r.break_minutes > 0 ? `${r.break_minutes} Min` : "—"}</td>
                <td className="py-1.5 pr-2 text-right font-medium">{formatDuration(calcWorkedMinutes(r))}</td>
                <td className="py-1.5 pl-3 text-gray-500">{r.notes ?? ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-900 font-semibold">
              <td colSpan={4} className="py-2">Summe Ist / Soll</td>
              <td className="py-2 text-right">{formatDuration(totalMinutes)} / {formatDuration(targetMinutes)}</td>
              <td className={`py-2 pl-3 ${diff > 0 ? "text-amber-700" : diff < 0 ? "text-red-600" : ""}`}>
                {diff === 0 ? "±0" : `${diff > 0 ? "+" : "−"}${formatDuration(Math.abs(diff))}`}
              </td>
            </tr>
          </tfoot>
        </table>

        {absences.length > 0 && (
          <>
            <h2 className="mb-2 mt-6 text-sm font-semibold">Abwesenheiten im Monat</h2>
            <table className="w-full border-collapse text-[12px]">
              <tbody>
                {absences.map(a => (
                  <tr key={a.id} className="border-b border-gray-100">
                    <td className="py-1.5 pr-2">
                      {format(parseISO(a.start_date), "dd.MM.", { locale: de })}
                      {a.start_date !== a.end_date && ` – ${format(parseISO(a.end_date), "dd.MM.yyyy", { locale: de })}`}
                    </td>
                    <td className="py-1.5 pr-2">{a.absence_types ? (ABSENCE_LABELS[a.absence_types.code] ?? a.absence_types.name) : "—"}</td>
                    <td className="py-1.5 text-right">{a.working_days != null ? `${a.working_days} Tage` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="mt-12 grid grid-cols-2 gap-12">
          <div className="border-t border-gray-400 pt-1 text-center text-[11px] text-gray-500">Datum, Unterschrift Arbeitgeber</div>
          <div className="border-t border-gray-400 pt-1 text-center text-[11px] text-gray-500">Datum, Unterschrift Arbeitnehmer</div>
        </div>
      </div>
    </div>
  );
}
