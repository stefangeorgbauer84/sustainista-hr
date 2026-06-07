"use client";

import { useQuery } from "@tanstack/react-query";
import { getAllPendingRequests, getApprovedLeaveForCalendar } from "@/lib/leave";
import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { Query } from "appwrite";
import type { Employee, LeaveRequest } from "@/types";
import { Users, Clock, Calendar, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import Link from "next/link";

export default function AdminPage() {
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["all-employees"],
    queryFn: async () => {
      const res = await databases.listDocuments(DB_ID, COLLECTIONS.EMPLOYEES, [Query.limit(100)]);
      return res.documents as unknown as Employee[];
    },
  });

  const { data: pending = [] } = useQuery<LeaveRequest[]>({
    queryKey: ["pending-leaves"],
    queryFn: getAllPendingRequests,
  });

  const { data: upcoming = [] } = useQuery<LeaveRequest[]>({
    queryKey: ["upcoming-leaves"],
    queryFn: getApprovedLeaveForCalendar,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Admin-Dashboard</h1>
        <p className="mt-0.5 text-sm text-gray-500">Übersicht über Mitarbeiter und Anträge</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" strokeWidth={1.5} />} label="Mitarbeiter" value={String(employees.length)} color="blue" />
        <StatCard icon={<AlertCircle className="h-5 w-5" strokeWidth={1.5} />} label="Offene Anträge" value={String(pending.length)} color="yellow" />
        <StatCard icon={<Calendar className="h-5 w-5" strokeWidth={1.5} />} label="Bald abwesend" value={String(upcoming.length)} color="green" />
        <StatCard icon={<Clock className="h-5 w-5" strokeWidth={1.5} />} label="Heute aktiv" value="—" color="gray" />
      </div>

      {pending.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-amber-800">Offene Urlaubsanträge</h2>
            <Link href="/admin/leave" className="text-xs text-amber-700 underline underline-offset-2">
              Alle anzeigen
            </Link>
          </div>
          <div className="space-y-2">
            {pending.slice(0, 3).map(req => (
              <div key={req.$id} className="flex items-center justify-between rounded-lg bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{req.employeeName}</p>
                  <p className="text-xs text-gray-500">
                    {format(parseISO(req.startDate), "d. MMM", { locale: de })} –{" "}
                    {format(parseISO(req.endDate), "d. MMM yyyy", { locale: de })} · {req.days} Tage
                  </p>
                </div>
                <Link href="/admin/leave" className="text-xs text-[#4F772D] font-medium hover:underline">
                  Bearbeiten →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
            <h2 className="text-sm font-medium text-gray-900">Mitarbeiter</h2>
          </div>
          <Link href="/admin/employees" className="text-xs text-[#4F772D] hover:underline">
            Alle verwalten →
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {employees.slice(0, 5).map(emp => (
            <div key={emp.$id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{emp.firstName} {emp.lastName}</p>
                <p className="text-xs text-gray-400">{emp.position} · {emp.department}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">
                  Urlaub: {emp.vacationDaysTotal - emp.vacationDaysUsed}/{emp.vacationDaysTotal} Tage
                </p>
                <span className={`text-[10px] rounded-full px-2 py-0.5 ${emp.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                  {emp.role === "admin" ? "Admin" : "Mitarbeiter"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-[#4F772D]/10 text-[#4F772D]",
    yellow: "bg-amber-50 text-amber-600",
    gray: "bg-gray-100 text-gray-600",
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className={`mb-3 inline-flex rounded-lg p-2 ${colors[color]}`}>{icon}</div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
