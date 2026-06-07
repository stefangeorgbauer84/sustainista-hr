"use client";

import { useQuery } from "@tanstack/react-query";
import { getApprovedLeaveForCalendar, getAllPendingRequests } from "@/lib/leave";
import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { Query } from "appwrite";
import type { Employee, LeaveRequest, TimeEntry } from "@/types";
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
  vacation: "bg-[#4F772D]/20 text-[#4F772D]",
  sick: "bg-red-100 text-red-600",
  unpaid: "bg-gray-200 text-gray-600",
  special: "bg-purple-100 text-purple-600",
};

const typeShort: Record<string, string> = {
  vacation: "U", sick: "K", unpaid: "UB", special: "S",
};

export default function ReportsPage() {
  const [current, setCurrent] = useState(new Date());
  const month = current.getMonth() + 1;
  const year = current.getFullYear();

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

  const { data: allLeaves = [] } = useQuery<LeaveRequest[]>({
    queryKey: ["all-leaves-year", year],
    queryFn: async () => {
      const res = await databases.listDocuments(DB_ID, COLLECTIONS.LEAVE_REQUESTS, [
        Query.greaterThanEqual("startDate", `${year}-01-01`),
        Query.lessThanEqual("endDate", `${year}-12-31`),
        Query.limit(500),
      ]);
      return res.documents as unknown as LeaveRequest[];
    },
  });

  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = `${year}-${String(month).padStart(2, "0")}-31`;

  const { data: timeEntries = [] } = useQuery<TimeEntry[]>({
    queryKey: ["all-time-entries-report", year, month],
    queryFn: async () => {
      const res = await databases.listDocuments(DB_ID, COLLECTIONS.TIME_ENTRIES, [
        Query.greaterThanEqual("date", start),
        Query.lessThanEqual("date", end),
        Query.limit(500),
      ]);
      return res.documents as unknown as TimeEntry[];
    },
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

  // Überstunden
  const overtimeByEmp: Record<string, number> = {};
  timeEntries.filter(e => e.status !== "running").forEach(e => {
    overtimeByEmp[e.employeeId] = (overtimeByEmp[e.employeeId] ?? 0) + calcWorkedMinutes(e);
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
          const mins = overtimeByEmp[emp.$id] ?? 0;
          const overtime = mins - 160 * 60;
          return (
            <div key={emp.$id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#4F772D]/10 text-xs font-bold text-[#4F772D]">
                  {emp.firstName[0]}{emp.lastName[0]}
                </div>
                <p className="text-sm font-medium text-gray-900">{emp.firstName} {emp.lastName}</p>
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
              <tr key={emp.$id} className="hover:bg-gray-50/50">
                <td className="sticky left-0 bg-white px-4 py-2 z-10 border-r border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#4F772D]/10 text-[9px] font-bold text-[#4F772D]">
                      {emp.firstName[0]}{emp.lastName[0]}
                    </div>
                    <span className="font-medium text-gray-900 whitespace-nowrap">
                      {emp.firstName} {emp.lastName[0]}.
                    </span>
                  </div>
                </td>
                {days.map(day => {
                  const leave = leaveForDay(emp.$id, day);
                  const weekend = isWeekend(day);
                  return (
                    <td key={day.toISOString()}
                      className={`px-0.5 py-1.5 text-center ${weekend ? "bg-gray-50/50" : isToday(day) ? "bg-[#4F772D]/5" : ""}`}>
                      {leave && !weekend && (
                        <div
                          title={leave.type}
                          className={`mx-auto flex h-5 w-5 items-center justify-center rounded text-[8px] font-bold ${typeColors[leave.type]}`}
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
        <div className="border-t border-gray-100 px-4 py-3 flex items-center gap-4">
          {[["vacation","Urlaub"],["sick","Krankenstand"],["unpaid","Unbezahlt"],["special","Sonder"]].map(([k,l]) => (
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
