"use client";

import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getRunningEntry, getTimeEntriesForEmployee,
  startTimer, stopTimer, calcWorkedMinutes, formatDuration,
} from "@/lib/time";
import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID } from "appwrite";
import { toast } from "sonner";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Play, Square, Clock, AlertTriangle, Plus, X, Coffee, Printer } from "lucide-react";

const manualSchema = z.object({
  date: z.string().min(1, "Datum erforderlich"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Format: HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Format: HH:MM"),
  breakMinutes: z.number().min(0).max(480),
  note: z.string().optional(),
}).refine(d => d.endTime > d.startTime, {
  message: "Endzeit muss nach Startzeit liegen",
  path: ["endTime"],
});

type ManualForm = z.infer<typeof manualSchema>;

export default function TimePage() {
  const { employee } = useAuth();
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year] = useState(now.getFullYear());
  const [showManual, setShowManual] = useState(false);

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

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<ManualForm>({
    resolver: zodResolver(manualSchema),
    defaultValues: {
      date: format(now, "yyyy-MM-dd"),
      breakMinutes: 0,
    },
  });

  const startMutation = useMutation({
    mutationFn: () => startTimer(employee!.$id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["running"] }); toast.success("Zeiterfassung gestartet"); },
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

  const addBreakMutation = useMutation({
    mutationFn: ({ entryId, extra }: { entryId: string; extra: number }) =>
      databases.updateDocument(DB_ID, COLLECTIONS.TIME_ENTRIES, entryId, {
        breakMinutes: extra,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["time-entries"] }); toast.success("Pause eingetragen"); },
  });

  const manualMutation = useMutation({
    mutationFn: async (data: ManualForm) => {
      return databases.createDocument(DB_ID, COLLECTIONS.TIME_ENTRIES, ID.unique(), {
        employeeId: employee!.$id,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        breakMinutes: data.breakMinutes,
        note: data.note ?? null,
        status: "completed",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["time-entries"] });
      toast.success("Zeiteintrag gespeichert");
      reset();
      setShowManual(false);
    },
    onError: () => toast.error("Fehler beim Speichern"),
  });

  const totalMinutes = entries
    .filter(e => e.status !== "running")
    .reduce((s, e) => s + calcWorkedMinutes(e), 0);

  // AZG §11: 30 Min Pflichtpause nach 6h, 45 Min nach 9h
  function getPauseWarning(mins: number): string | null {
    if (mins > 9 * 60 && mins < 9 * 60 + 45) return "§ 11 AZG: Ab 9h Arbeitszeit sind 45 Min. Pause Pflicht";
    if (mins > 6 * 60 && mins < 6 * 60 + 30) return "§ 11 AZG: Ab 6h Arbeitszeit sind 30 Min. Pause Pflicht";
    return null;
  }

  const watchStart = watch("startTime");
  const watchEnd = watch("endTime");
  const watchBreak = watch("breakMinutes");
  const previewMins = watchStart && watchEnd
    ? Math.max(0, (parseInt(watchEnd.split(":")[0]) * 60 + parseInt(watchEnd.split(":")[1] || "0")) -
        (parseInt(watchStart.split(":")[0]) * 60 + parseInt(watchStart.split(":")[1] || "0")) - (watchBreak ?? 0))
    : 0;

  const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Zeiterfassung</h1>
          <p className="mt-0.5 text-sm text-gray-500">Starte, stoppe oder trage Zeiten manuell ein</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
            data-print-hide
          >
            <Printer className="h-4 w-4" strokeWidth={1.5} />
            Drucken
          </button>
          <button
            onClick={() => setShowManual(!showManual)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            {showManual ? <X className="h-4 w-4" strokeWidth={1.5} /> : <Plus className="h-4 w-4" strokeWidth={1.5} />}
            Manuell eintragen
          </button>
        </div>
      </div>

      {/* Timer Card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Heute, {format(now, "d. MMMM", { locale: de })}</p>
            {running && (
              <p className="mt-1 text-2xl font-semibold text-[#4F772D]">
                Läuft seit {running.startTime} Uhr
              </p>
            )}
          </div>
          {running ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm text-[#4F772D]">
                <div className="h-2 w-2 animate-pulse rounded-full bg-[#4F772D]" />
                Aktiv
              </div>
              <button
                onClick={() => stopMutation.mutate()}
                disabled={stopMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60 transition"
              >
                <Square className="h-4 w-4" strokeWidth={1.5} fill="white" />
                Stoppen
              </button>
            </div>
          ) : (
            <button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60 transition"
            >
              <Play className="h-4 w-4" strokeWidth={1.5} fill="white" />
              Starten
            </button>
          )}
        </div>
      </div>

      {/* Manuelle Eingabe */}
      {showManual && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Zeiteintrag manuell erfassen</h2>
          <form onSubmit={handleSubmit(d => manualMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Datum</label>
                <input type="date" {...register("date")} className={inp} />
                {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Von</label>
                <input type="time" {...register("startTime")} className={inp} />
                {errors.startTime && <p className="mt-1 text-xs text-red-500">{errors.startTime.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Bis</label>
                <input type="time" {...register("endTime")} className={inp} />
                {errors.endTime && <p className="mt-1 text-xs text-red-500">{errors.endTime.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  <span className="flex items-center gap-1">
                    <Coffee className="h-3 w-3" strokeWidth={1.5} />
                    Pause (Min.)
                  </span>
                </label>
                <input type="number" {...register("breakMinutes", { valueAsNumber: true })} min={0} max={480} className={inp} />
              </div>
            </div>

            {previewMins > 0 && (
              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-600">
                  Nettoarbeitszeit: <strong>{formatDuration(previewMins)}</strong>
                </p>
                {getPauseWarning(previewMins) && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {getPauseWarning(previewMins)}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Notiz (optional)</label>
              <input {...register("note")} placeholder="z.B. Homeoffice, Kundentermin…" className={inp} />
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowManual(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Abbrechen
              </button>
              <button type="submit" disabled={manualMutation.isPending} className="rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60">
                {manualMutation.isPending ? "Speichert…" : "Speichern"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Monatsübersicht */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
            <h2 className="text-sm font-medium text-gray-900">{MONTHS[month - 1]} {year}</h2>
          </div>
          <div className="flex gap-1">
            {MONTHS.map((m, i) => (
              <button
                key={i}
                onClick={() => setMonth(i + 1)}
                className={`rounded px-2 py-1 text-xs transition ${i + 1 === month ? "bg-[#4F772D] text-white" : "text-gray-500 hover:bg-gray-100"}`}
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
              const pauseWarn = entry.endTime ? getPauseWarning(mins + entry.breakMinutes) : null;
              return (
                <div key={entry.$id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {format(parseISO(entry.date), "EEE, d. MMM", { locale: de })}
                    </p>
                    <p className="text-xs text-gray-400">
                      {entry.startTime} – {entry.endTime ?? "läuft"}
                      {entry.breakMinutes > 0 && (
                        <span className="ml-2 inline-flex items-center gap-0.5 text-gray-400">
                          <Coffee className="h-3 w-3" strokeWidth={1.5} />
                          {entry.breakMinutes} Min.
                        </span>
                      )}
                    </p>
                    {entry.note && <p className="text-xs text-gray-400 italic">{entry.note}</p>}
                    {pauseWarn && (
                      <p className="mt-0.5 text-[10px] text-amber-500 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" strokeWidth={1.5} />
                        {pauseWarn}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {entry.endTime && entry.breakMinutes === 0 && mins > 6 * 60 && (
                      <button
                        onClick={() => addBreakMutation.mutate({ entryId: entry.$id, extra: 30 })}
                        className="text-xs text-amber-600 underline underline-offset-2"
                      >
                        + 30 Min. Pause
                      </button>
                    )}
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
                </div>
              );
            })
          )}
        </div>

        {entries.length > 0 && (
          <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 flex items-center justify-between text-sm">
            <div className="flex gap-6 text-xs text-gray-500">
              <span>{entries.filter(e => e.status !== "running").length} Einträge</span>
              {totalMinutes > 160 * 60 && (
                <span className="text-amber-600 font-medium">
                  +{formatDuration(totalMinutes - 160 * 60)} Überstunden
                </span>
              )}
            </div>
            <span className="font-semibold text-gray-900">{formatDuration(totalMinutes)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const inp = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none focus:ring-2 focus:ring-[#4F772D]/20";
