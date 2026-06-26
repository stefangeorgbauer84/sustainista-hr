"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { isHoliday, getHolidayName } from "@/lib/holidays";
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format,
  parseISO, isWithinInterval, addMonths, subMonths,
} from "date-fns";
import { de } from "date-fns/locale";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";

type EmpRow = { id: string; first_name: string; last_name: string };
type AbsenceRow = {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  absence_types: { code: string; name: string } | null;
};

const CODE_COLORS: Record<string, string> = {
  urlaub:      "bg-[#4F772D]/20 text-[#4F772D] border-[#4F772D]/30",
  krankenstand: "bg-red-100 text-red-600 border-red-200",
  unbezahlt:   "bg-gray-200 text-gray-600 border-gray-300",
  sonderurlaub: "bg-purple-100 text-purple-600 border-purple-200",
};
const CODE_SHORT: Record<string, string> = {
  urlaub: "U", krankenstand: "K", unbezahlt: "UB", sonderurlaub: "S",
};
const DEFAULT_COLOR = "bg-blue-100 text-blue-600 border-blue-200";
const DEFAULT_SHORT = "A";

export default function TeamCalendarPage() {
  const [current, setCurrent] = useState(new Date());

  const { data: employees = [] } = useQuery<EmpRow[]>({
    queryKey: ["all-employees-cal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("last_name")
        .limit(100);
      if (error) throw error;
      return (data ?? []) as EmpRow[];
    },
  });

  const { data: absences = [] } = useQuery<AbsenceRow[]>({
    queryKey: ["approved-absences-cal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("absences")
        .select("id, employee_id, start_date, end_date, absence_types(code, name)")
        .eq("status", "approved")
        .order("start_date")
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as AbsenceRow[];
    },
  });

  const days = eachDayOfInterval({ start: startOfMonth(current), end: endOfMonth(current) });
  const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
  const isToday = (d: Date) => format(d, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  function absenceForDay(empId: string, day: Date): AbsenceRow | undefined {
    return absences.find(a =>
      a.employee_id === empId &&
      isWithinInterval(day, { start: parseISO(a.start_date), end: parseISO(a.end_date) })
    );
  }

  const today = new Date();
  const absentToday = employees.filter(emp =>
    absences.some(a =>
      a.employee_id === emp.id &&
      isWithinInterval(today, { start: parseISO(a.start_date), end: parseISO(a.end_date) })
    )
  );

  const holidaysThisMonth = days
    .filter(d => isHoliday(format(d, "yyyy-MM-dd")))
    .map(d => ({ date: d, name: getHolidayName(format(d, "yyyy-MM-dd"))! }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Teamkalender</h1>
          <p className="mt-0.5 text-sm text-gray-500">Abwesenheiten und Feiertage im Überblick</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrent(subMonths(current, 1))} className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 transition">
            <ChevronLeft className="h-4 w-4 text-gray-500" strokeWidth={1.5} />
          </button>
          <span className="min-w-36 text-center text-sm font-medium text-gray-900">
            {format(current, "MMMM yyyy", { locale: de })}
          </span>
          <button onClick={() => setCurrent(addMonths(current, 1))} className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 transition">
            <ChevronRight className="h-4 w-4 text-gray-500" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {absentToday.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Users className="h-4 w-4 text-amber-600 shrink-0" strokeWidth={1.5} />
          <p className="text-sm text-amber-700">
            <strong>Heute abwesend:</strong> {absentToday.map(e => `${e.first_name} ${e.last_name}`).join(", ")}
          </p>
        </div>
      )}

      {holidaysThisMonth.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {holidaysThisMonth.map(h => (
            <span key={h.name} className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs text-blue-700">
              🇦🇹 {format(h.date, "d. MMM", { locale: de })} — {h.name}
            </span>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 w-36 z-10">Mitarbeiter</th>
              {days.map(day => {
                const iso = format(day, "yyyy-MM-dd");
                const holiday = getHolidayName(iso);
                return (
                  <th key={iso} title={holiday ?? undefined}
                    className={`px-0.5 py-2 text-center font-medium min-w-[30px] ${
                      isToday(day) ? "bg-[#4F772D]/10 text-[#4F772D]" :
                      holiday ? "bg-blue-50 text-blue-600" :
                      isWeekend(day) ? "text-gray-300" : "text-gray-500"
                    }`}>
                    <div className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-xs ${isToday(day) ? "bg-[#4F772D] text-white font-semibold" : ""}`}>
                      {format(day, "d")}
                    </div>
                    <div className="text-[9px] font-normal mt-0.5">{format(day, "EE", { locale: de })}</div>
                    {holiday && <div className="text-[7px] text-blue-500 mt-0.5">FT</div>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {employees.map(emp => (
              <tr key={emp.id} className="hover:bg-gray-50/50">
                <td className="sticky left-0 bg-white px-4 py-2.5 z-10 border-r border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#4F772D]/10 text-[10px] font-bold text-[#4F772D]">
                      {emp.first_name[0]}{emp.last_name[0]}
                    </div>
                    <span className="font-medium text-gray-900 whitespace-nowrap text-xs">
                      {emp.first_name} {emp.last_name[0]}.
                    </span>
                  </div>
                </td>
                {days.map(day => {
                  const iso = format(day, "yyyy-MM-dd");
                  const absence = absenceForDay(emp.id, day);
                  const weekend = isWeekend(day);
                  const holiday = isHoliday(iso);
                  const code = absence?.absence_types?.code ?? "";
                  const color = CODE_COLORS[code] ?? DEFAULT_COLOR;
                  const short = CODE_SHORT[code] ?? DEFAULT_SHORT;
                  return (
                    <td key={iso} className={`px-0.5 py-1.5 text-center ${
                      holiday ? "bg-blue-50/40" : weekend ? "bg-gray-50/50" : isToday(day) ? "bg-[#4F772D]/5" : ""
                    }`}>
                      {absence && !weekend && !holiday && (
                        <div title={absence.absence_types?.name ?? code}
                          className={`mx-auto flex h-6 w-6 items-center justify-center rounded border text-[9px] font-bold ${color}`}>
                          {short}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-gray-100 px-4 py-3 flex flex-wrap items-center gap-4">
          {Object.entries(CODE_SHORT).map(([code, short]) => (
            <div key={code} className="flex items-center gap-1.5">
              <div className={`flex h-4 w-4 items-center justify-center rounded border text-[8px] font-bold ${CODE_COLORS[code] ?? DEFAULT_COLOR}`}>{short}</div>
              <span className="text-xs text-gray-500">{{
                urlaub: "Urlaub", krankenstand: "Krankenstand",
                unbezahlt: "Unbezahlt", sonderurlaub: "Sonderurlaub",
              }[code]}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="flex h-4 w-4 items-center justify-center rounded bg-blue-50 border border-blue-100 text-[7px] text-blue-600 font-bold">FT</div>
            <span className="text-xs text-gray-500">Feiertag (AT)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
