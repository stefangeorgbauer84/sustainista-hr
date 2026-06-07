"use client";

import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getRunningEntry, getTimeEntriesForEmployee,
  startTimer, stopTimer, calcWorkedMinutes, formatDuration,
} from "@/lib/time";
import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { toast } from "sonner";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Play, Square, Clock, AlertTriangle } from "lucide-react";

export default function TimePage() {
  const { employee } = useAuth();
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year] = useState(now.getFullYear());

  const { data: running } = useQuery({
    queryKey: ["running", employee?.$id],
    queryFn: () => getRunningEntry(employee!.$id),
    enabled: !!employee,
    refetchInterval: 30_000,
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["time-entries", employee?.$id, year, month],
    queryFn: () => getTimeEntriesForEmployee(employee!.$id, year, month),
    enabled: !!employee,
  });

  const startMutation = useMutation({
    mutationFn: () => startTimer(employee!.$id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["running"] });
      toast.success("Zeiterfassung gestartet");
    },
    onError: () => toast.error("Fehler beim Starten"),
  });

  const stopMutation = useMutation({
    mutationFn: () => stopTimer(running!.$id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["running"] });
      qc.invalidateQueries({ queryKey: ["time-entries"] });
      toast.success("Zeiterfassung gestoppt");
    },
    onError: () => toast.error("Fehler beim Stoppen"),
  });

  const totalMinutes = entries.filter(e => e.status !== "running").reduce((s, e) => s + calcWorkedMinutes(e), 0);
  const targetMinutes = entries.length * 8 * 60;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Zeiterfassung</h1>
        <p className="mt-0.5 text-sm text-gray-500">Starte und stoppe deine Arbeitszeit</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Heute</p>
            <p className="text-xs text-gray-400">{format(now, "EEEE, d. MMMM", { locale: de })}</p>
          </div>
          {running ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-[#4F772D]">
                <div className="h-2 w-2 animate-pulse rounded-full bg-[#4F772D]" />
                Läuft seit {running.startTime}
              </div>
              <button
                onClick={() => stopMutation.mutate()}
                disabled={stopMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-60"
              >
                <Square className="h-4 w-4" strokeWidth={1.5} fill="white" />
                Stoppen
              </button>
            </div>
          ) : (
            <button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#31572C] disabled:opacity-60"
            >
              <Play className="h-4 w-4" strokeWidth={1.5} fill="white" />
              Starten
            </button>
          )}
        </div>
      </div>

      {totalMinutes > 10 * 60 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          Achtung: Österreichisches Arbeitszeitgesetz — max. 10h/Tag (§ 9 AZG)
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
            <h2 className="text-sm font-medium text-gray-900">
              Monat: {String(month).padStart(2, "0")}/{year}
            </h2>
          </div>
          <div className="flex gap-1">
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
              <button
                key={m}
                onClick={() => setMonth(m)}
                className={`rounded px-2 py-1 text-xs transition ${m === month ? "bg-[#4F772D] text-white" : "text-gray-500 hover:bg-gray-100"}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {isLoading ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">Wird geladen…</p>
          ) : entries.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">Keine Einträge in diesem Monat</p>
          ) : (
            entries.map(entry => {
              const mins = calcWorkedMinutes(entry);
              const isOver = mins > 10 * 60;
              return (
                <div key={entry.$id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {format(parseISO(entry.date), "EEE, d. MMM", { locale: de })}
                    </p>
                    <p className="text-xs text-gray-400">
                      {entry.startTime} – {entry.endTime ?? "läuft"}
                      {entry.breakMinutes > 0 && ` · ${entry.breakMinutes} Min. Pause`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${isOver ? "text-red-500" : "text-gray-900"}`}>
                      {entry.endTime ? formatDuration(mins) : "—"}
                    </p>
                    <span className={`text-[10px] rounded-full px-2 py-0.5 ${
                      entry.status === "approved" ? "bg-green-100 text-green-700" :
                      entry.status === "running" ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {entry.status === "approved" ? "Genehmigt" : entry.status === "running" ? "Läuft" : "Ausstehend"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {entries.length > 0 && (
          <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 flex justify-between text-sm">
            <span className="text-gray-500">Gesamt</span>
            <span className="font-semibold text-gray-900">{formatDuration(totalMinutes)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
