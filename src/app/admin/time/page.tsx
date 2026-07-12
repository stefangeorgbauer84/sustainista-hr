"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Employee, TimeRecord } from "@/types";
import { calcWorkedMinutes, formatDuration, monthRange, selectableYears } from "@/lib/time";
import { toast } from "sonner";
import { useState } from "react";
import { format, parseISO, addDays } from "date-fns";
import { de } from "date-fns/locale";
import { Check, X, Clock, Coffee, AlertTriangle, Plus, Download, CheckCheck, Trash2 } from "lucide-react";

type BulkRow = { work_date: string; start_time: string; end_time: string; break_minutes: string };

const emptyRow = (date: string): BulkRow => ({
  work_date: date, start_time: "08:00", end_time: "16:00", break_minutes: "30",
});

/** Nächster Werktag (Mo–Fr) nach dem gegebenen Datum — für schnelles Nachtragen ganzer Monate. */
function nextWorkday(dateStr: string): string {
  let d = addDays(parseISO(dateStr), 1);
  while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
  return format(d, "yyyy-MM-dd");
}

export default function AdminTimePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedEmp, setSelectedEmp] = useState("all");
  const [showManual, setShowManual] = useState(false);
  const [bulkEmployeeId, setBulkEmployeeId] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([emptyRow(format(now, "yyyy-MM-dd"))]);

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["all-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("is_active", true)
        .order("last_name")
        .limit(200);
      if (error) throw error;
      return data as unknown as Employee[];
    },
  });

  const { start, end } = monthRange(year, month);

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

  const bulkApproveMutation = useMutation({
    mutationFn: async () => {
      const pendingIds = entries.filter(e => e.status === "submitted").map(e => e.id);
      if (pendingIds.length === 0) return 0;
      const { error } = await supabase
        .from("time_records")
        .update({ status: "approved", approved_by: user?.id })
        .in("id", pendingIds);
      if (error) throw error;
      return pendingIds.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["all-time-entries"] });
      toast.success(`${count ?? 0} Einträge genehmigt`);
    },
    onError: () => toast.error("Fehler beim Bulk-Genehmigen"),
  });

  const bulkInsertMutation = useMutation({
    mutationFn: async () => {
      const emp = employees.find(e => e.id === bulkEmployeeId);
      if (!emp) throw new Error("Kein Mitarbeiter gewählt");
      const validRows = bulkRows.filter(r => r.work_date && r.start_time && r.end_time);
      if (validRows.length === 0) throw new Error("Keine gültigen Zeilen");
      const invalid = validRows.find(r => r.end_time <= r.start_time);
      if (invalid) throw new Error(`Endzeit vor Startzeit am ${invalid.work_date}`);
      const { error } = await supabase.from("time_records").insert(
        validRows.map(r => ({
          employee_id: emp.id,
          company_id: emp.company_id,
          work_date: r.work_date,
          start_time: r.start_time,
          end_time: r.end_time,
          break_minutes: Number(r.break_minutes) || 0,
          status: "approved",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          created_via: "admin",
        }))
      );
      if (error) throw error;
      return validRows.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["all-time-entries"] });
      toast.success(`${count} ${count === 1 ? "Eintrag" : "Einträge"} erfasst und genehmigt`);
      setShowManual(false);
      setBulkRows([emptyRow(format(now, "yyyy-MM-dd"))]);
    },
    onError: (err: Error) => toast.error(err.message || "Fehler beim Erfassen"),
  });

  function updateRow(i: number, patch: Partial<BulkRow>) {
    setBulkRows(rows => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setBulkRows(rows => {
      const last = rows[rows.length - 1];
      return [...rows, { ...last, work_date: nextWorkday(last.work_date) }];
    });
  }

  function exportCSV() {
    const empMap = Object.fromEntries(employees.map(e => [e.id, e]));
    const header = ["Datum", "Mitarbeiter", "Start", "Ende", "Pause (Min)", "Gesamt (Std)", "Status"];
    const rows = entries.map(e => {
      const emp = empMap[e.employee_id];
      const mins = e.end_time ? calcWorkedMinutes(e) : 0;
      return [
        e.work_date,
        emp ? `${emp.last_name} ${emp.first_name}` : e.employee_id,
        e.start_time,
        e.end_time ?? "",
        e.break_minutes,
        (mins / 60).toFixed(2),
        e.status,
      ];
    });
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zeiterfassung-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportiert");
  }

  const empMap = Object.fromEntries(employees.map(e => [e.id, e]));
  const MONTHS = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

  const totalMinutesByEmp: Record<string, number> = {};
  entries.forEach(e => {
    if (e.end_time !== null) {
      totalMinutesByEmp[e.employee_id] = (totalMinutesByEmp[e.employee_id] ?? 0) + calcWorkedMinutes(e);
    }
  });

  const pending = entries.filter(e => e.status === "submitted");
  const inp = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none focus:ring-2 focus:ring-[#4F772D]/20";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Zeiterfassung — Übersicht</h1>
          <p className="mt-0.5 text-sm text-gray-500">{pending.length} Einträge warten auf Genehmigung</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            <Download className="h-4 w-4" strokeWidth={1.5} />
            CSV
          </button>
          <button
            onClick={() => setShowManual(true)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Manuell
          </button>
          {pending.length > 0 && (
            <button
              onClick={() => bulkApproveMutation.mutate()}
              disabled={bulkApproveMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-[#4F772D] px-3 py-2 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60 transition"
            >
              <CheckCheck className="h-4 w-4" strokeWidth={2} />
              {bulkApproveMutation.isPending ? "…" : `Alle ${pending.length} genehmigen`}
            </button>
          )}
        </div>
      </div>

      {/* Überstunden-Summary — nur wenn Einträge vorhanden */}
      {Object.keys(totalMinutesByEmp).length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(totalMinutesByEmp).map(([empId, mins]) => {
            const emp = empMap[empId];
            if (!emp) return null;
            const targetMins = Math.round((emp.hours_per_week ?? 40) * 52 / 12) * 60;
            const overtime = mins - targetMins;
            return (
              <div key={empId} className="rounded-xl border border-gray-200 bg-white p-4">
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
            <span className="text-xs text-gray-400">({entries.length})</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedEmp}
              onChange={e => setSelectedEmp(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 focus:border-[#4F772D] focus:outline-none"
            >
              <option value="all">Alle Mitarbeiter</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
            </select>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-600 focus:border-[#4F772D] focus:outline-none"
            >
              {selectableYears().map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div className="flex gap-1 flex-wrap">
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
            <p className="px-5 py-8 text-center text-sm text-gray-400">Keine Einträge für diesen Zeitraum</p>
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
                    {entry.notes && (
                      <p className="mt-0.5 max-w-xl truncate text-xs italic text-gray-400" title={entry.notes}>
                        {entry.notes}
                      </p>
                    )}
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
                        {entry.status === "approved" ? "Genehmigt" :
                         entry.status === "rejected" ? "Abgelehnt" : "Entwurf"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Manuelle Erfassung — ein oder mehrere Einträge (z.B. Nachtrag 2025) */}
      {showManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-900">Zeiten erfassen</h3>
              <button onClick={() => setShowManual(false)} className="rounded-lg p-1.5 hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
              </button>
            </div>
            <p className="mb-4 text-xs text-gray-400">
              Beliebig viele Tage auf einmal — auch rückwirkend für 2025. Einträge werden direkt als <strong>Genehmigt</strong> gespeichert.
            </p>
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-gray-700">Mitarbeiter *</label>
              <select value={bulkEmployeeId} onChange={e => setBulkEmployeeId(e.target.value)} className={inp}>
                <option value="">— bitte wählen —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_100px_100px_90px_32px] gap-2 text-[11px] font-medium text-gray-500">
                <span>Datum</span><span>Von</span><span>Bis</span><span>Pause (Min)</span><span />
              </div>
              {bulkRows.map((row, i) => (
                <div key={i} className="grid grid-cols-[1fr_100px_100px_90px_32px] gap-2 items-center">
                  <input type="date" value={row.work_date} onChange={e => updateRow(i, { work_date: e.target.value })} className={inp} />
                  <input type="time" value={row.start_time} onChange={e => updateRow(i, { start_time: e.target.value })} className={inp} />
                  <input type="time" value={row.end_time} onChange={e => updateRow(i, { end_time: e.target.value })} className={inp} />
                  <input type="number" min="0" max="480" value={row.break_minutes} onChange={e => updateRow(i, { break_minutes: e.target.value })} className={inp} />
                  <button
                    onClick={() => setBulkRows(rows => rows.filter((_, idx) => idx !== i))}
                    disabled={bulkRows.length === 1}
                    className="rounded p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-400 disabled:opacity-30 transition"
                    title="Zeile entfernen"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addRow}
              className="mt-3 flex items-center gap-1.5 text-xs text-[#4F772D] hover:underline underline-offset-2"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Nächster Werktag ({format(parseISO(nextWorkday(bulkRows[bulkRows.length - 1].work_date)), "EEE, d. MMM", { locale: de })})
            </button>
            <div className="mt-5 flex items-center justify-between">
              <p className="text-xs text-gray-400">{bulkRows.length} {bulkRows.length === 1 ? "Zeile" : "Zeilen"}</p>
              <div className="flex gap-2">
                <button onClick={() => setShowManual(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                  Abbrechen
                </button>
                <button
                  onClick={() => bulkInsertMutation.mutate()}
                  disabled={!bulkEmployeeId || bulkInsertMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60 transition"
                >
                  <Plus className="h-4 w-4" strokeWidth={2} />
                  {bulkInsertMutation.isPending ? "Wird gespeichert…" : `${bulkRows.length > 1 ? `Alle ${bulkRows.length} speichern` : "Eintrag speichern"}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
