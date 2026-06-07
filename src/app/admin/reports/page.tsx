"use client";

import { useQuery } from "@tanstack/react-query";
import { getApprovedLeaveForCalendar } from "@/lib/leave";
import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { Query } from "appwrite";
import type { Employee, LeaveRequest } from "@/types";
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format, parseISO,
  isSameDay, isWithinInterval, addMonths, subMonths,
} from "date-fns";
import { de } from "date-fns/locale";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const typeColors: Record<string, string> = {
  vacation: "bg-[#4F772D]/20 text-[#4F772D]",
  sick: "bg-red-100 text-red-600",
  unpaid: "bg-gray-200 text-gray-600",
  special: "bg-purple-100 text-purple-600",
};

const typeLabels: Record<string, string> = {
  vacation: "Urlaub",
  sick: "Krankenstand",
  unpaid: "Unbez.",
  special: "Sonder",
};

export default function ReportsPage() {
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

  function leaveForDay(empId: string, day: Date): LeaveRequest | undefined {
    return leaves.find(l =>
      l.employeeId === empId &&
      isWithinInterval(day, { start: parseISO(l.startDate), end: parseISO(l.endDate) })
    );
  }

  const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Urlaubskalender</h1>
          <p className="mt-0.5 text-sm text-gray-500">Wer ist wann abwesend</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrent(subMonths(current, 1))}
            className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 transition"
          >
            <ChevronLeft className="h-4 w-4 text-gray-500" strokeWidth={1.5} />
          </button>
          <span className="min-w-36 text-center text-sm font-medium text-gray-900">
            {format(current, "MMMM yyyy", { locale: de })}
          </span>
          <button
            onClick={() => setCurrent(addMonths(current, 1))}
            className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 transition"
          >
            <ChevronRight className="h-4 w-4 text-gray-500" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="sticky left-0 bg-white px-4 py-3 text-left text-xs font-medium text-gray-500 w-36 z-10">
                Mitarbeiter
              </th>
              {days.map(day => (
                <th
                  key={day.toISOString()}
                  className={`px-1 py-3 text-center font-medium min-w-[28px] ${isWeekend(day) ? "text-gray-300" : "text-gray-500"}`}
                >
                  <div>{format(day, "d")}</div>
                  <div className="text-[9px] font-normal">{format(day, "EEE", { locale: de })}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {employees.map(emp => (
              <tr key={emp.$id} className="hover:bg-gray-50/50">
                <td className="sticky left-0 bg-white px-4 py-2.5 z-10">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#4F772D]/10 text-[10px] font-semibold text-[#4F772D]">
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
                    <td
                      key={day.toISOString()}
                      className={`px-0.5 py-2 text-center ${weekend ? "bg-gray-50/50" : ""}`}
                    >
                      {leave && !weekend && (
                        <div
                          title={`${typeLabels[leave.type]}`}
                          className={`rounded text-[9px] font-medium py-0.5 ${typeColors[leave.type]}`}
                        >
                          {typeLabels[leave.type][0]}
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
          {Object.entries(typeLabels).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`h-3 w-3 rounded ${typeColors[key].split(" ")[0]}`} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
