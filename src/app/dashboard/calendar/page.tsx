"use client";

import { useQuery } from "@tanstack/react-query";
import { getApprovedLeaveForCalendar } from "@/lib/leave";
import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { Query } from "appwrite";
import type { Employee, LeaveRequest } from "@/types";
import { isHoliday, getHolidayName } from "@/lib/holidays";
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format,
  parseISO, isWithinInterval, addMonths, subMonths,
} from "date-fns";
import { de } from "date-fns/locale";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";

const typeColors: Record<string, string> = {
  vacation: "bg-[#4F772D]/20 text-[#4F772D] border-[#4F772D]/30",
  sick:     "bg-red-100 text-red-600 border-red-200",
  unpaid:   "bg-gray-200 text-gray-600 border-gray-300",
  special:  "bg-purple-100 text-purple-600 border-purple-200",
};
const typeShort: Record<string, string> = { vacation: "U", sick: "K", unpaid: "UB", special: "S" };
const typeLegend: Record<string, string> = { vacation: "Urlaub", sick: "Krankenstand", unpaid: "Unbezahlt", special: "Sonderurlaub" };

export default function TeamCalendarPage() {
  const [current, setCurrent] = useState(new Date());

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["all-employees"],
    queryFn: async () => {
      const res = await databases.listDocuments(DB_ID, COLLECTIONS.EMPLOYEES, [Query.limit(100)]);
      return res.documents as unknown as Employee[];
    },
  });

  const { data: leaves = [] } = useQuery<LeaveRequest[]>({
    queryKey: ["approved-leaves"],
    queryFn: getApprovedLeaveForCalendar,
  });

  const days = eachDayOfInterval({ start: startOfMonth(current), end: endOfMonth(current) });
  const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
  const isToday = (d: Date) => format(d, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  function leaveForDay(empId: string, day: Date) {
    return leaves.find(l =>
      l.employeeId === empId &&
      isWithinInterval(day, { start: parseISO(l.startDate), end: parseISO(l.endDate) })
    );
  }

  const today = new Date();
  const absentToday = employees.filter(emp =>
    leaves.some(l =>
      l.employeeId === emp.$id &&
      isWithinInterval(today, { start: parseISO(l.startDate), end: parseISO(l.endDate) })
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
            <strong>Heute abwesend:</strong> {absentToday.map(e => `${e.firstName} ${e.lastName}`).join(", ")}
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
                  <th key={iso}
                    title={holiday}
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
              <tr key={emp.$id} className="hover:bg-gray-50/50">
                <td className="sticky left-0 bg-white px-4 py-2.5 z-10 border-r border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#4F772D]/10 text-[10px] font-bold text-[#4F772D]">
                      {emp.firstName[0]}{emp.lastName[0]}
                    </div>
                    <span className="font-medium text-gray-900 whitespace-nowrap text-xs">
                      {emp.firstName} {emp.lastName[0]}.
                    </span>
                  </div>
                </td>
                {days.map(day => {
                  const iso = format(day, "yyyy-MM-dd");
                  const leave = leaveForDay(emp.$id, day);
                  const weekend = isWeekend(day);
                  const holiday = isHoliday(iso);
                  return (
                    <td key={iso}
                      className={`px-0.5 py-1.5 text-center ${
                        holiday ? "bg-blue-50/40" :
                        weekend ? "bg-gray-50/50" :
                        isToday(day) ? "bg-[#4F772D]/5" : ""
                      }`}>
                      {leave && !weekend && !holiday && (
                        <div
                          title={typeLegend[leave.type]}
                          className={`mx-auto flex h-6 w-6 items-center justify-center rounded border text-[9px] font-bold ${typeColors[leave.type]}`}
                        >
                          {typeShort[leave.type]}
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
          {Object.entries(typeLegend).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`flex h-4 w-4 items-center justify-center rounded border text-[8px] font-bold ${typeColors[key]}`}>{typeShort[key]}</div>
              <span className="text-xs text-gray-500">{label}</span>
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
