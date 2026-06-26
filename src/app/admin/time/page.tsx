"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Employee, TimeRecord } from "@/types";
import { calcWorkedMinutes, formatDuration } from "@/lib/time";
import { toast } from "sonner";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Check, X, Clock, Coffee, AlertTriangle } from "lucide-react";

export default function AdminTimePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year] = useState(now.getFullYear());
  const [selectedEmp, setSelectedEmp] = useState("all");

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

  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = `${year}-${String(month).padStart(2, "0")}-31`;

  const { data: entries = [], isLoading } = useQuery<TimeRecord[]>({
    queryKey: ["all-time-entries", year, month, selectedEmp],
    queryFn: async () => {
      let query = supabase
        .from("time_records")
        .select("*")
        .gte("work_date", start)
        .lte("work_date", end)
        .order("work_date", { ascending: false })
        .limit(500);
      if (selectedEmp !== "all") query = query.eq("employee_id", selectedEmp);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as TimeRecord[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("time_records")
        .update({ status: "approved", approved_by: user?.id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["all-time-entries"] }); toast.success("Genehmigt"); },
    onError: () => toast.error("Fehler"),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("time_records")
        .update({ status: "rejected", approved_by: user?.id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["all-time-entries"] }); toast.success("Abgelehnt"); },
    onError: () => toast.error("Fehler"),
  });

  const empMap = Object.fromEntries(employees.map(e => [e.id, e]));
  const MONTHS = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

  // Überstunden: Soll 8h/Tag * Arbeitstage
  const totalMinutesByEmp: Record<string, number> = {};
  entries.forEach(e => {
    if (e.end_time !== null) {
      totalMinutesByEmp[e.employee_id] = (totalMinutesByEmp[e.employee_id] ?? 0) + calcWorkedMinutes(e);
    }
  });

  const pending = entries.filter(e => e.status === "submitted");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Zeiterfassung — Übersicht</h1>
        <p className="mt-0.5 text-sm text-gray-500">{pending.length} Einträge warten auf Genehmigung</p>
      </div>

      {/* Überstunden-Summary */}
      {employees.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {employees.map(emp => {
            const mins = totalMinutesByEmp[emp.id] ?? 0;
            const targetMins = Math.round((emp.hours_per_week ?? 40) * 52 / 12) * 60;
            const overtime = mins - targetMins;
            return (
              <div key={emp.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#4F772D]/10 text-xs font-semibold text-[#4F772D]">
                    {emp.first_name[0]}{emp.last_name[0]}
                  </div>
                  <p className="text-sm font-medium text-gray-900">{emp.first_name} {emp.last_name}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">Gesamt: <strong>{formatDuration(mins)}</strong></p>
                  {overtime > 0 ? (
                    <span className="text-xs font-medium text-amber-600">+{formatDuration(overtime)} ÜSt.</span>
                  ) : overtime < -60 * 60 ? (
                    <span className="text-xs font-medium text-red-500">{formatDuration(overtime)} Minus</span>
                  ) : (
                    <span className="text-xs text-gray-400">Im Soll</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
            <h2 className="text-sm font-medium text-gray-900">Alle Einträge</h2>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedEmp}
              onChange={e => setSelectedEmp(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 focus:border-[#4F772D] focus:outline-none"
            >
              <option value="all">Alle Mitarbeiter</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
            </select>
            <div className="flex gap-1">
              {MONTHS.map((m, i) => (
                <button key={i} onClick={() => setMonth(i + 1)}
                  className={`rounded px-2 py-1 text-xs transition ${i + 1 === month ? "bg-[#4F772D] text-white" : "text-gray-500 hover:bg-gray-100"}`}
                >{m}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {isLoading ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">Wird geladen…</p>
          ) : entries.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">Keine Einträge</p>
          ) : (
            entries.map(entry => {
              const emp = empMap[entry.employee_id];
              const mins = calcWorkedMinutes(entry);
              const isOver10h = mins > 10 * 60;
              return (
                <div key={entry.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">
                        {emp ? `${emp.first_name} ${emp.last_name}` : "—"}
                      </p>
                      <span className="text-xs text-gray-400">
                        {format(parseISO(entry.work_date), "EEE d. MMM", { locale: de })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {entry.start_time} – {entry.end_time ?? "läuft"}
                      {entry.break_minutes > 0 && (
                        <span className="ml-2 inline-flex items-center gap-0.5">
                          <Coffee className="h-3 w-3" strokeWidth={1.5} />
                          {entry.break_minutes} Min.
                        </span>
                      )}
                    </p>
                    {isOver10h && (
                      <p className="text-[10px] text-red-500 flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="h-3 w-3" strokeWidth={1.5} />
                        Überschreitet 10h-Limit (§ 9 AZG)
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <p className={`text-sm font-medium ${isOver10h ? "text-red-500" : "text-gray-900"}`}>
                      {entry.end_time ? formatDuration(mins) : "—"}
                    </p>
                    {entry.status === "submitted" ? (
                      <div className="flex gap-1">
                        <button onClick={() => rejectMutation.mutate(entry.id)}
                          className="rounded-lg border border-red-100 bg-red-50 px-2 py-1 text-xs text-red-500 hover:bg-red-100 transition">
                          <X className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                        <button onClick={() => approveMutation.mutate(entry.id)}
                          className="rounded-lg bg-[#4F772D] px-2 py-1 text-xs text-white hover:bg-[#31572C] transition">
                          <Check className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                      </div>
                    ) : (
                      <span className={`text-[10px] rounded-full px-2 py-0.5 ${
                        entry.status === "approved" ? "bg-green-100 text-green-700" :
                        entry.status === "rejected" ? "bg-red-100 text-red-600" :
                        "bg-gray-100 text-gray-500"
                      }`}>
                        {entry.status === "approved" ? "Genehmigt" : entry.status === "rejected" ? "Abgelehnt" : "Entwurf"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
