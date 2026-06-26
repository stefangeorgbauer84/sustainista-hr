"use client";

import { useQuery } from "@tanstack/react-query";
import { getApprovedAbsencesForCalendar, getAllPendingAbsences } from "@/lib/leave";
import { supabase } from "@/lib/supabase";
import type { Employee, Absence, TimeRecord } from "@/types";
import { exportTimeEntriesCSV, exportLeaveCSV } from "@/lib/export";
import { calcWorkedMinutes, formatDuration } from "@/lib/time";
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format, parseISO,
  isWithinInterval, addMonths, subMonths,
} from "date-fns";
import { de } from "date-fns/locale";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";

const typeColors: Record<string, string> = {
  urlaub: "bg-[#4F772D]/20 text-[#4F772D]",
  krankenstand: "bg-red-100 text-red-600",
  zeitausgleich: "bg-blue-100 text-blue-600",
  homeoffice: "bg-violet-100 text-violet-600",
  sonderurlaub: "bg-purple-100 text-purple-600",
  pflegefreistellung: "bg-orange-100 text-orange-600",
  unbezahlt: "bg-gray-200 text-gray-600",
  dienstreise: "bg-sky-100 text-sky-600",
};

const typeShort: Record<string, string> = {
  urlaub: "U", krankenstand: "K", zeitausgleich: "ZA",
  homeoffice: "HO", sonderurlaub: "S", pflegefreistellung: "PF",
  unbezahlt: "UB", dienstreise: "DR",
};

type AbsenceWithCalendar = {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  absence_types: { name: string; code: string; color_hex: string } | null;
};

export default function ReportsPage() {
  const [current, setCurrent] = useState(new Date());
  const month = current.getMonth() + 1;
  const year = current.getFullYear();

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["all-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .limit(100);
      if (error) throw error;
      return data as unknown as Employee[];
    },
  });

  const { data: leaves = [] } = useQuery<AbsenceWithCalendar[]>({
    queryKey: ["approved-leaves"],
    queryFn: getApprovedAbsencesForCalendar as unknown as () => Promise<AbsenceWithCalendar[]>,
  });

  const { data: allLeaves = [] } = useQuery<Absence[]>({
    queryKey: ["all-leaves-year", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("absences")
        .select("*")
        .gte("start_date", `${year}-01-01`)
        .lte("end_date", `${year}-12-31`)
        .limit(500);
      if (error) throw error;
      return data as unknown as Absence[];
    },
  });

  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = `${year}-${String(month).padStart(2, "0")}-31`;

  const { data: timeEntries = [] } = useQuery<TimeRecord[]>({
    queryKey: ["all-time-entries-report", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_records")
        .select("*")
        .gte("work_date", start)
        .lte("work_date", end)
        .limit(500);
      if (error) throw error;
      return data as unknown as TimeRecord[];
    },
  });

  const days = eachDayOfInterval({ start: startOfMonth(current), end: endOfMonth(current) });
  const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
  const isToday = (d: Date) => format(d, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  function leaveForDay(empId: string, day: Date): AbsenceWithCalendar | undefined {
    return leaves.find(l =>
      l.employee_id === empId &&
      isWithinInterval(day, { start: parseISO(l.start_date), end: parseISO(l.end_date) })
    );
  }

  // Überstunden
  const overtimeByEmp: Record<string, number> = {};
  timeEntries.filter(e => e.end_time !== null).forEach(e => {
    overtimeByEmp[e.employee_id] = (overtimeByEmp[e.employee_id] ?? 0) + calcWorkedMinutes(e);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reports & Kalender</h1>
          <p className="mt-0.5 text-sm text-gray-500">Urlaubskalender und Monatsexporte</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrent(subMonths(current, 1))}
            className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 transition">
            <ChevronLeft className="h-4 w-4 text-gray-500" strokeWidth={1.5} />
          </button>
          <span className="min-w-36 text-center text-sm font-medium text-gray-900">
            {format(current, "MMMM yyyy", { locale: de })}
          </span>
          <button onClick={() => setCurrent(addMonths(current, 1))}
            className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 transition">
            <ChevronRight className="h-4 w-4 text-gray-500" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* CSV Export Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => exportTimeEntriesCSV(timeEntries, employees, month, year)}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
        >
          <Download className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
          Zeitbericht {format(current, "MMM yyyy", { locale: de })} (.csv)
        </button>
        <button
          onClick={() => exportLeaveCSV(allLeaves, year)}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
        >
          <Download className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
          Urlaubsliste {year} (.csv)
        </button>
      </div>

      {/* Überstunden-Karten */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {employees.map(emp => {
          const mins = overtimeByEmp[emp.id] ?? 0;
          const target = Math.round((emp.hours_per_week ?? 40) * 52 / 12) * 60;
          const overtime = mins - target;
          return (
            <div key={emp.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#4F772D]/10 text-xs font-bold text-[#4F772D]">
                  {emp.first_name[0]}{emp.last_name[0]}
                </div>
                <p className="text-sm font-medium text-gray-900">{emp.first_name} {emp.last_name}</p>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Ist: <strong>{formatDuration(mins)}</strong></span>
                <span className={`font-semibold ${overtime > 0 ? "text-amber-600" : overtime < -60*60 ? "text-red-500" : "text-gray-400"}`}>
                  {overtime > 0 ? `+${formatDuration(overtime)}` : overtime < 0 ? `-${formatDuration(Math.abs(overtime))}` : "Im Soll"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Kalender */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 w-36 z-10">
                Mitarbeiter
              </th>
              {days.map(day => (
                <th key={day.toISOString()}
                  className={`px-0.5 py-2 text-center min-w-[28px] ${
                    isToday(day) ? "bg-[#4F772D]/10 text-[#4F772D]" :
                    isWeekend(day) ? "text-gray-300" : "text-gray-500"
                  }`}>
                  <div className={`mx-auto flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${isToday(day) ? "bg-[#4F772D] text-white font-bold" : ""}`}>
                    {format(day, "d")}
                  </div>
                  <div className="text-[8px] font-normal">{format(day, "EE", { locale: de })}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {employees.map(emp => (
              <tr key={emp.id} className="hover:bg-gray-50/50">
                <td className="sticky left-0 bg-white px-4 py-2 z-10 border-r border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#4F772D]/10 text-[9px] font-bold text-[#4F772D]">
                      {emp.first_name[0]}{emp.last_name[0]}
                    </div>
                    <span className="font-medium text-gray-900 whitespace-nowrap">
                      {emp.first_name} {emp.last_name[0]}.
                    </span>
                  </div>
                </td>
                {days.map(day => {
                  const leave = leaveForDay(emp.id, day);
                  const weekend = isWeekend(day);
                  return (
                    <td key={day.toISOString()}
                      className={`px-0.5 py-1.5 text-center ${weekend ? "bg-gray-50/50" : isToday(day) ? "bg-[#4F772D]/5" : ""}`}>
                      {leave && !weekend && (
                        <div
                          title={leave.absence_types?.name ?? leave.absence_types?.code ?? ""}
                          className={`mx-auto flex h-5 w-5 items-center justify-center rounded text-[8px] font-bold ${typeColors[leave.absence_types?.code ?? ""] ?? "bg-gray-100 text-gray-500"}`}
                        >
                          {typeShort[leave.absence_types?.code ?? ""] ?? "?"}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-gray-100 px-4 py-3 flex items-center gap-4">
          {[["urlaub","Urlaub"],["krankenstand","Krankenstand"],["zeitausgleich","Zeitausgleich"],["homeoffice","Homeoffice"],["unbezahlt","Unbezahlt"],["dienstreise","Dienstreise"]].map(([k,l]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className={`flex h-4 w-4 items-center justify-center rounded text-[8px] font-bold ${typeColors[k]}`}>{typeShort[k]}</div>
              <span className="text-xs text-gray-500">{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
