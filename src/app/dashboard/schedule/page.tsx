"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { getScheduleForEmployee, calcShiftMinutes, formatShiftHours, getMonday, addDays, toDateStr } from "@/lib/schedule";
import type { ShiftSchedule, ScheduleChangeRequest } from "@/types";
import { format, parseISO, isSameDay } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock, MapPin, AlertCircle, X, Check, MessageCircle } from "lucide-react";
import { toast } from "sonner";

type ShiftWithLocation = ShiftSchedule & { locations: { name: string } | null };

const STATUS_STYLE: Record<string, string> = {
  draft: "border-gray-200 bg-gray-50 text-gray-600",
  published: "border-[#4F772D]/30 bg-[#4F772D]/5 text-[#4F772D]",
  cancelled: "border-red-200 bg-red-50 text-red-400 opacity-60",
};

const DAYS_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export default function EmployeeSchedulePage() {
  const { employee } = useAuth();
  const qc = useQueryClient();
  const today = new Date();

  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(today));
  const viewMonth = weekStart.getMonth() + 1;
  const viewYear = weekStart.getFullYear();
  const [requestingShift, setRequestingShift] = useState<ShiftWithLocation | null>(null);
  const [reqForm, setReqForm] = useState({ start_time: "", end_time: "", break_minutes: "30", reason: "" });

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const { data: shifts = [], isLoading } = useQuery<ShiftWithLocation[]>({
    queryKey: ["emp-schedule", employee?.id, viewYear, viewMonth],
    queryFn: () => getScheduleForEmployee(employee!.id, viewYear, viewMonth) as Promise<ShiftWithLocation[]>,
    enabled: !!employee,
  });

  const { data: changeRequests = [] } = useQuery<ScheduleChangeRequest[]>({
    queryKey: ["emp-change-requests", employee?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_change_requests").select("*")
        .eq("employee_id", employee!.id)
        .order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as ScheduleChangeRequest[];
    },
    enabled: !!employee,
  });

  const shiftMap = useMemo(() => {
    const m: Record<string, ShiftWithLocation> = {};
    shifts.forEach((s) => { m[s.scheduled_date] = s; });
    return m;
  }, [shifts]);

  const weekShifts = useMemo(() => weekDays.map((d) => shiftMap[toDateStr(d)] ?? null), [weekDays, shiftMap]);
  const weeklyMins = weekShifts.reduce((s, sh) => sh ? s + calcShiftMinutes(sh.start_time, sh.end_time, sh.break_minutes) : s, 0);

  const monthMins = shifts.reduce((s, sh) => s + calcShiftMinutes(sh.start_time, sh.end_time, sh.break_minutes), 0);
  const targetMins = Math.round((employee?.hours_per_week ?? 40) * 52 / 12) * 60;
  const diff = monthMins - targetMins;

  const requestMap = useMemo(() => {
    const m: Record<string, ScheduleChangeRequest> = {};
    changeRequests.forEach((r) => { m[r.shift_schedule_id] = r; });
    return m;
  }, [changeRequests]);

  const submitRequest = useMutation({
    mutationFn: async () => {
      if (!requestingShift || !employee) return;
      if (!reqForm.reason.trim()) throw new Error("Bitte Grund angeben");
      const { error } = await supabase.from("schedule_change_requests").insert({
        shift_schedule_id: requestingShift.id,
        employee_id: employee.id,
        company_id: requestingShift.company_id,
        requested_start: reqForm.start_time || requestingShift.start_time,
        requested_end: reqForm.end_time || requestingShift.end_time,
        break_minutes: parseInt(reqForm.break_minutes) || requestingShift.break_minutes,
        reason: reqForm.reason.trim(),
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emp-change-requests"] });
      toast.success("Anfrage gesendet");
      setRequestingShift(null);
      setReqForm({ start_time: "", end_time: "", break_minutes: "30", reason: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelRequest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule_change_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["emp-change-requests"] }); toast.success("Anfrage zurückgezogen"); },
    onError: () => toast.error("Fehler"),
  });

  function openRequest(shift: ShiftWithLocation) {
    setRequestingShift(shift);
    setReqForm({ start_time: shift.start_time.slice(0,5), end_time: shift.end_time.slice(0,5), break_minutes: String(shift.break_minutes), reason: "" });
  }

  const weekLabel = `KW ${format(weekStart,"ww")} · ${format(weekStart,"d. MMM",{locale:de})} – ${format(addDays(weekStart,6),"d. MMM yyyy",{locale:de})}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Mein Dienstplan</h1>
        <p className="mt-0.5 text-sm text-gray-500">Geplante Schichten — bei Bedarf Änderung anfragen</p>
      </div>

      {/* Month summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-400">Geplant {format(new Date(viewYear, viewMonth-1),"MMMM",{locale:de})}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{(monthMins/60).toFixed(1)}h</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-400">Soll</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{(targetMins/60).toFixed(0)}h</p>
        </div>
        <div className={`rounded-xl border p-4 ${diff > 60 ? "border-amber-200 bg-amber-50" : diff < -120 ? "border-red-100 bg-red-50" : "border-green-100 bg-green-50"}`}>
          <p className="text-xs text-gray-400">Differenz</p>
          <p className={`mt-1 text-2xl font-bold ${diff > 60 ? "text-amber-600" : diff < -120 ? "text-red-500" : "text-[#4F772D]"}`}>
            {diff >= 0 ? "+" : ""}{(diff/60).toFixed(1)}h
          </p>
        </div>
      </div>

      {/* Week grid */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3">
          <button onClick={() => setWeekStart(addDays(weekStart,-7))} className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 transition">
            <ChevronLeft className="h-3.5 w-3.5 text-gray-500" strokeWidth={1.5} />
          </button>
          <div className="flex-1 text-center">
            <p className="text-sm font-medium text-gray-700">{weekLabel}</p>
            {weeklyMins > 0 && <p className="text-xs text-[#4F772D] mt-0.5">{(weeklyMins / 60).toFixed(1)}h geplant</p>}
          </div>
          <button onClick={() => setWeekStart(addDays(weekStart,7))} className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 transition">
            <ChevronRight className="h-3.5 w-3.5 text-gray-500" strokeWidth={1.5} />
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setWeekStart(getMonday(today))} className="text-xs text-[#4F772D] underline underline-offset-2">Heute</button>
            <button onClick={() => setWeekStart(addDays(getMonday(today), 7))} className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">Nächste Wo. →</button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-gray-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-[#4F772D]" />
            Wird geladen…
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {weekDays.map((d, i) => {
              const shift = weekShifts[i];
              const isToday = isSameDay(d, today);
              const existingReq = shift ? requestMap[shift.id] : undefined;
              return (
                <div key={i} className={`px-5 py-4 ${isToday ? "bg-blue-50/30" : ""}`}>
                  <div className="flex items-start gap-4">
                    <div className="w-20 flex-shrink-0 pt-1">
                      <p className={`text-xs font-semibold ${isToday ? "text-blue-600" : "text-gray-500"}`}>{DAYS_DE[i]}</p>
                      <p className={`text-sm font-bold ${isToday ? "text-blue-700" : "text-gray-800"}`}>{format(d,"d.M.",{locale:de})}</p>
                      {isToday && <span className="text-[9px] bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5">Heute</span>}
                    </div>

                    {shift ? (
                      <div className="flex-1">
                        <div className={`rounded-xl border px-4 py-3 ${STATUS_STYLE[shift.status]}`}>
                          <div className="flex items-center gap-3 justify-between">
                            <div className="flex items-center gap-2.5">
                              <Clock className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
                              <div>
                                <p className="text-sm font-semibold">{shift.start_time.slice(0,5)} – {shift.end_time.slice(0,5)}</p>
                                <p className="text-xs opacity-60 mt-0.5">
                                  {formatShiftHours(shift.start_time, shift.end_time, shift.break_minutes)} netto
                                  {shift.break_minutes > 0 && ` · ${shift.break_minutes} Min. Pause`}
                                </p>
                              </div>
                            </div>
                            {shift.locations?.name && (
                              <p className="flex items-center gap-1 text-xs opacity-50">
                                <MapPin className="h-3 w-3" strokeWidth={1.5} />
                                {shift.locations.name.split(" · ")[0]}
                              </p>
                            )}
                          </div>
                          {shift.notes && <p className="mt-2 text-xs opacity-50 italic">{shift.notes}</p>}
                        </div>

                        {existingReq ? (
                          <div className={`mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-xs ${existingReq.status === "pending" ? "bg-amber-50 border border-amber-100 text-amber-700" : existingReq.status === "approved" ? "bg-green-50 border border-green-100 text-green-700" : "bg-gray-50 border border-gray-100 text-gray-500"}`}>
                            <span>
                              {existingReq.status === "pending" && "Änderungsanfrage läuft…"}
                              {existingReq.status === "approved" && `Genehmigt: ${existingReq.requested_start?.slice(0,5)} – ${existingReq.requested_end?.slice(0,5)}`}
                              {existingReq.status === "rejected" && `Abgelehnt${existingReq.admin_note ? `: ${existingReq.admin_note}` : ""}`}
                            </span>
                            {existingReq.status === "pending" && (
                              <button onClick={() => cancelRequest.mutate(existingReq.id)} className="ml-2 hover:opacity-70 transition">
                                <X className="h-3.5 w-3.5" strokeWidth={2} />
                              </button>
                            )}
                          </div>
                        ) : shift.status === "published" ? (
                          <button onClick={() => openRequest(shift)}
                            className="mt-2 w-full rounded-lg border border-[#4F772D]/40 bg-[#4F772D]/5 py-2 text-xs font-medium text-[#4F772D] hover:bg-[#4F772D]/10 transition flex items-center justify-center gap-1.5">
                            <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
                            Änderung anfragen
                          </button>
                        ) : shift.status === "draft" ? (
                          <p className="mt-1.5 text-[10px] text-gray-400 text-center">Noch nicht veröffentlicht — Anfrage nach Bestätigung möglich</p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center rounded-xl border-2 border-dashed border-gray-100 py-5">
                        <p className="text-xs text-gray-300">Kein Dienst</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upcoming list */}
      {shifts.filter((s) => s.scheduled_date > toDateStr(today)).length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <p className="text-sm font-medium text-gray-900">Nächste Schichten</p>
          </div>
          <div className="divide-y divide-gray-50">
            {shifts.filter((s) => s.scheduled_date > toDateStr(today)).slice(0, 6).map((shift) => (
              <div key={shift.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{format(parseISO(shift.scheduled_date),"EEEE, d. MMM",{locale:de})}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {shift.start_time.slice(0,5)} – {shift.end_time.slice(0,5)}
                    {shift.locations?.name && ` · ${shift.locations.name.split(" · ")[0]}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#4F772D]">{formatShiftHours(shift.start_time,shift.end_time,shift.break_minutes)}</p>
                  <span className={`text-[10px] rounded-full px-2 py-0.5 ${shift.status==="published" ? "bg-[#4F772D]/10 text-[#4F772D]" : "bg-gray-100 text-gray-500"}`}>
                    {shift.status==="published" ? "Bestätigt" : "Entwurf"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Change request modal */}
      {requestingShift && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setRequestingShift(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Änderung anfragen</h3>
              <button onClick={() => setRequestingShift(null)} className="rounded-lg p-1.5 hover:bg-gray-100 transition">
                <X className="h-4 w-4 text-gray-400" strokeWidth={2} />
              </button>
            </div>
            <div className="mb-4 rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-600">
              <p className="font-medium text-gray-700 mb-1">{format(parseISO(requestingShift.scheduled_date),"EEEE, d. MMMM yyyy",{locale:de})}</p>
              <p>Aktuell: <strong>{requestingShift.start_time.slice(0,5)} – {requestingShift.end_time.slice(0,5)}</strong></p>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Neuer Beginn</label>
                  <input type="time" value={reqForm.start_time} onChange={(e) => setReqForm({...reqForm, start_time: e.target.value})}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Neues Ende</label>
                  <input type="time" value={reqForm.end_time} onChange={(e) => setReqForm({...reqForm, end_time: e.target.value})}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Pause (Min.)</label>
                <input type="number" min="0" max="120" value={reqForm.break_minutes}
                  onChange={(e) => setReqForm({...reqForm, break_minutes: e.target.value})}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Grund <span className="text-red-400">*</span></label>
                <textarea value={reqForm.reason} onChange={(e) => setReqForm({...reqForm, reason: e.target.value})}
                  placeholder="Warum möchtest du die Schicht ändern?"
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none resize-none" />
              </div>
              {!reqForm.reason.trim() && (
                <div className="flex items-center gap-2 text-xs text-amber-600">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.5} />
                  Grund ist Pflichtfeld
                </div>
              )}
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setRequestingShift(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition">
                Abbrechen
              </button>
              <button onClick={() => submitRequest.mutate()} disabled={submitRequest.isPending || !reqForm.reason.trim()}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#4F772D] py-2.5 text-sm font-semibold text-white hover:bg-[#31572C] transition disabled:opacity-50">
                <Check className="h-4 w-4" strokeWidth={2} />
                Anfragen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
