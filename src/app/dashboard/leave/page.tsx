"use client";

import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAbsencesForEmployee, createAbsence, getAbsenceTypes,
  calcBusinessDays, getHolidaysForYear,
} from "@/lib/leave";
import { supabase } from "@/lib/supabase";
import type { Absence, AbsenceType, LeaveBalance } from "@/types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format, parseISO, differenceInDays } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, Plus, X, Upload, Download, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { getHolidayName } from "@/lib/holidays";
import { useState, useRef } from "react";

const schema = z.object({
  absence_type_id: z.string().min(1, "Art der Abwesenheit erforderlich"),
  startDate: z.string().min(1, "Startdatum erforderlich"),
  endDate: z.string().min(1, "Enddatum erforderlich"),
  reason: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const statusColors: Record<string, string> = {
  requested: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
  cancelled: "bg-gray-100 text-gray-500",
};

const statusLabels: Record<string, string> = {
  requested: "Ausstehend",
  approved: "Genehmigt",
  rejected: "Abgelehnt",
  cancelled: "Storniert",
};

export default function LeavePage() {
  const { employee } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const currentYear = new Date().getFullYear();
  const [leaveYear, setLeaveYear] = useState(currentYear);

  const { data: absenceTypes = [] } = useQuery<AbsenceType[]>({
    queryKey: ["absence-types"],
    queryFn: getAbsenceTypes,
  });

  const { data: holidays = [] } = useQuery<string[]>({
    queryKey: ["holidays", leaveYear],
    queryFn: () => getHolidaysForYear(leaveYear),
  });

  const { data: leaveBalance } = useQuery<LeaveBalance | null>({
    queryKey: ["leave-balance", employee?.id, leaveYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("employee_id", employee!.id)
        .eq("year", leaveYear)
        .single();
      return data ?? null;
    },
    enabled: !!employee,
  });

  const { data: absences = [], isLoading } = useQuery<Absence[]>({
    queryKey: ["absences", employee?.id, leaveYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("absences")
        .select("*")
        .eq("employee_id", employee!.id)
        .gte("start_date", `${leaveYear}-01-01`)
        .lte("start_date", `${leaveYear}-12-31`)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Absence[];
    },
    enabled: !!employee,
  });

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { absence_type_id: "" },
  });

  const watchTypeId = watch("absence_type_id");
  const startDate = watch("startDate");
  const endDate = watch("endDate");
  const previewDays = startDate && endDate && endDate >= startDate
    ? calcBusinessDays(startDate, endDate, holidays)
    : 0;

  const selectedType = absenceTypes.find(t => t.id === watchTypeId);
  const entitlement = leaveBalance?.entitlement_days ?? 25;
  const carryOver = leaveBalance?.carry_over_days ?? 0;
  const totalEntitlement = entitlement + carryOver;
  const taken = leaveBalance?.taken_days ?? 0;
  const approvedPending = leaveBalance?.approved_pending_days ?? 0;
  const vacationLeft = totalEntitlement - taken - approvedPending;

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      let doctorNotePath: string | undefined;

      if (selectedType?.requires_doc && fileRef.current?.files?.[0]) {
        setUploading(true);
        const file = fileRef.current.files[0];
        const ext = file.name.split(".").pop();
        const path = `sick-notes/${employee!.id}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("documents").upload(path, file);
        if (error) throw error;
        doctorNotePath = path;
        setUploading(false);
      }

      return createAbsence({
        absence_type_id: data.absence_type_id,
        start_date: data.startDate,
        end_date: data.endDate,
        reason: data.reason,
        working_days: previewDays,
        ...(doctorNotePath ? { doctor_note: doctorNotePath } : {}),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["absences"] });
      qc.invalidateQueries({ queryKey: ["leave-balance"] });
      toast.success("Antrag eingereicht");
      reset();
      setShowForm(false);
    },
    onError: () => { setUploading(false); toast.error("Fehler beim Einreichen"); },
  });

  // Improvement 2: Cancel pending leave request
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("absences")
        .update({ status: "cancelled" })
        .eq("id", id)
        .eq("employee_id", employee!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["absences"] });
      qc.invalidateQueries({ queryKey: ["leave-balance"] });
      toast.success("Antrag storniert");
    },
    onError: () => toast.error("Fehler beim Stornieren"),
  });

  function downloadUrl(storagePath: string) {
    const { data } = supabase.storage.from("documents").getPublicUrl(storagePath);
    return data.publicUrl;
  }

  const usedPct = totalEntitlement > 0 ? Math.min(100, Math.round((taken / totalEntitlement) * 100)) : 0;
  const pendingPct = totalEntitlement > 0 ? Math.min(100 - usedPct, Math.round((approvedPending / totalEntitlement) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Urlaub & Abwesenheit</h1>
          {/* Improvement 8: Year switcher */}
          <div className="mt-0.5 flex items-center gap-1">
            <button onClick={() => setLeaveYear(y => y - 1)} className="rounded p-0.5 hover:bg-gray-100 transition">
              <ChevronLeft className="h-3.5 w-3.5 text-gray-400" strokeWidth={2} />
            </button>
            <span className="text-sm text-gray-500 w-10 text-center">{leaveYear}</span>
            <button
              onClick={() => setLeaveYear(y => y + 1)}
              disabled={leaveYear >= currentYear}
              className="rounded p-0.5 hover:bg-gray-100 transition disabled:opacity-30"
            >
              <ChevronRight className="h-3.5 w-3.5 text-gray-400" strokeWidth={2} />
            </button>
          </div>
        </div>
        {leaveYear === currentYear && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] transition"
          >
            {showForm ? <X className="h-4 w-4" strokeWidth={1.5} /> : <Plus className="h-4 w-4" strokeWidth={1.5} />}
            {showForm ? "Abbrechen" : "Antrag stellen"}
          </button>
        )}
      </div>

      {/* Improvement 7: Detailed leave balance breakdown */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-gray-400">Anspruch {leaveYear}</p>
            <p className="mt-0.5 text-2xl font-bold text-gray-900">{entitlement}</p>
            <p className="text-[10px] text-gray-400">Tage</p>
          </div>
          {carryOver > 0 && (
            <div>
              <p className="text-xs text-gray-400">Übertrag Vorjahr</p>
              <p className="mt-0.5 text-2xl font-bold text-blue-600">+{carryOver}</p>
              <p className="text-[10px] text-gray-400">Tage</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400">Verbraucht</p>
            <p className="mt-0.5 text-2xl font-bold text-gray-700">{taken}</p>
            <p className="text-[10px] text-gray-400">Tage genommen</p>
          </div>
          {approvedPending > 0 && (
            <div>
              <p className="text-xs text-gray-400">Genehmigt / offen</p>
              <p className="mt-0.5 text-2xl font-bold text-amber-500">{approvedPending}</p>
              <p className="text-[10px] text-gray-400">Tage reserviert</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400">Verbleibend</p>
            <p className={`mt-0.5 text-2xl font-bold ${vacationLeft <= 3 ? "text-red-500" : "text-[#4F772D]"}`}>{vacationLeft}</p>
            <p className="text-[10px] text-gray-400">von {totalEntitlement} Tagen</p>
          </div>
        </div>

        <div>
          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden flex">
            <div className="h-full bg-[#4F772D] transition-all" style={{ width: `${usedPct}%` }} />
            <div className="h-full bg-amber-300 transition-all" style={{ width: `${pendingPct}%` }} />
          </div>
          <div className="mt-1.5 flex items-center gap-4 text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#4F772D] inline-block" />Verbraucht
            </span>
            {approvedPending > 0 && (
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-300 inline-block" />Reserviert
              </span>
            )}
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-gray-100 border border-gray-200 inline-block" />Verfügbar
            </span>
          </div>
        </div>
      </div>

      {leaveYear === currentYear && vacationLeft <= 5 && vacationLeft >= 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" strokeWidth={1.5} />
          <p className="text-sm text-amber-700">
            Nur noch <strong>{vacationLeft} Urlaubstage</strong> verbleibend — bitte frühzeitig planen.
          </p>
        </div>
      )}

      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Neuer Antrag</h2>
          <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Art der Abwesenheit</label>
              <select {...register("absence_type_id")} className={inp}>
                <option value="">Auswählen…</option>
                {absenceTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {errors.absence_type_id && <p className="mt-1 text-xs text-red-500">{errors.absence_type_id.message}</p>}
            </div>

            {selectedType?.counts_as_leave && vacationLeft <= 5 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                Hinweis: Du hast noch {vacationLeft} Urlaubstage verbleibend.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Von</label>
                <input type="date" {...register("startDate")} className={inp} />
                {errors.startDate && <p className="mt-1 text-xs text-red-500">{errors.startDate.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Bis</label>
                <input type="date" {...register("endDate")} className={inp} />
                {errors.endDate && <p className="mt-1 text-xs text-red-500">{errors.endDate.message}</p>}
              </div>
            </div>

            {previewDays > 0 && (
              <p className="text-xs text-gray-500">
                Das sind <strong>{previewDays} Werktage</strong> (österreichische Feiertage ausgenommen)
                {selectedType?.counts_as_leave && previewDays > vacationLeft && (
                  <span className="ml-2 text-red-500 font-medium">— nicht genug Urlaubstage!</span>
                )}
              </p>
            )}

            {selectedType?.requires_doc && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Nachweis hochladen (optional, PDF)
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 p-3">
                  <Upload className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,image/*"
                    className="text-xs text-gray-500 file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs"
                  />
                </div>
                <p className="mt-1 text-[10px] text-gray-400">
                  Gem. EFZG: Bei Krankenstand ab 3 Tagen ist ein Nachweis erforderlich
                </p>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Anmerkung (optional)</label>
              <textarea {...register("reason")} rows={2} className={`${inp} resize-none`} />
            </div>

            <button
              type="submit"
              disabled={mutation.isPending || uploading}
              className="w-full rounded-lg bg-[#4F772D] py-2 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60 transition"
            >
              {uploading ? "Datei wird hochgeladen…" : mutation.isPending ? "Wird eingereicht…" : "Antrag einreichen"}
            </button>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
          <h2 className="text-sm font-medium text-gray-900">Meine Anträge {leaveYear}</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {isLoading ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">Wird geladen…</p>
          ) : absences.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">Keine Anträge in {leaveYear}</p>
          ) : (
            absences.map(absence => {
              const type = absenceTypes.find(t => t.id === absence.absence_type_id);
              return (
                <div key={absence.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {/* Improvement 4: Absence type color dot */}
                        {type?.color_hex && (
                          <span
                            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: type.color_hex }}
                          />
                        )}
                        <p className="text-sm font-medium text-gray-900">{type?.name ?? "Abwesenheit"}</p>
                        {absence.doctor_note && (
                          <a
                            href={downloadUrl(absence.doctor_note)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-[10px] text-[#4F772D] hover:underline"
                          >
                            <Download className="h-3 w-3" strokeWidth={1.5} />
                            Nachweis
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {format(parseISO(absence.start_date), "d. MMM", { locale: de })} –{" "}
                        {format(parseISO(absence.end_date), "d. MMM yyyy", { locale: de })}
                        {absence.working_days != null && ` · ${absence.working_days} Werktage`}
                      </p>
                      {absence.reason && <p className="text-xs text-gray-400 italic mt-0.5">{absence.reason}</p>}
                    </div>
                    <div className="ml-3 flex items-center gap-2 flex-shrink-0">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusColors[absence.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {statusLabels[absence.status] ?? absence.status}
                      </span>
                      {/* Improvement 2: Cancel button for pending requests */}
                      {absence.status === "requested" && (
                        <button
                          onClick={() => cancelMutation.mutate(absence.id)}
                          disabled={cancelMutation.isPending}
                          title="Antrag stornieren"
                          className="rounded-full p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition disabled:opacity-40"
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Improvement 3: Show admin rejection note */}
                  {absence.status === "rejected" && absence.rejection_note && (
                    <div className="mt-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                      <p className="text-xs text-red-600">
                        <span className="font-medium">Ablehnungsgrund:</span> {absence.rejection_note}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
      <HolidaysSection year={leaveYear} holidays={holidays} />
    </div>
  );
}

function HolidaysSection({ year, holidays }: { year: number; holidays: string[] }) {
  const yearHolidays = holidays.map(d => ({ date: d, name: getHolidayName(d) })).filter(h => h.name);
  if (!yearHolidays.length) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-4">
        <p className="text-sm font-medium text-gray-900">Österreichische Feiertage {year}</p>
        <p className="text-xs text-gray-400 mt-0.5">Gesetzliche Feiertage gem. § 7 ARG</p>
      </div>
      <div className="divide-y divide-gray-50">
        {yearHolidays.map(h => (
          <div key={h.date} className="flex items-center justify-between px-5 py-2.5">
            <span className="text-sm text-gray-700">{h.name}</span>
            <span className="text-xs text-gray-400 font-mono">{h.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const inp = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none focus:ring-2 focus:ring-[#4F772D]/20";
