"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import {
  getScheduleForLocation, getChangeRequests,
  calcShiftMinutes, formatShiftHours,
  getMonday, addDays, toDateStr,
} from "@/lib/schedule";
import type { Location, Employee, ShiftSchedule, ScheduleChangeRequest } from "@/types";
import { format, parseISO, isSameDay } from "date-fns";
import { de } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, Plus, Check, X,
  Clock, AlertTriangle, MapPin, Users, Calendar,
  Send, TrendingUp, Share2,
} from "lucide-react";
import { toast } from "sonner";

type EmpLocRow = {
  employee_id: string;
  hours_per_week: number;
  company_id: string;
  employees: Pick<Employee, "id" | "first_name" | "last_name"> | null;
};

type ChangeReqWithJoins = ScheduleChangeRequest & {
  employees: { first_name: string; last_name: string } | null;
  shift_schedules: { scheduled_date: string; start_time: string; end_time: string; location_id: string } | null;
};

const DAYS_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-gray-100 border-gray-200 text-gray-600",
  published: "bg-[#4F772D]/10 border-[#4F772D]/30 text-[#4F772D]",
  cancelled: "bg-red-50 border-red-200 text-red-500 line-through",
};

function ShiftCell({
  shift, isToday, onClick,
}: {
  shift?: ShiftSchedule; isToday: boolean; onClick: () => void;
}) {
  const ring = isToday ? "ring-2 ring-blue-400 ring-offset-1" : "";
  if (!shift) {
    return (
      <button onClick={onClick}
        className={`w-full h-16 rounded-lg border-2 border-dashed border-gray-200 hover:border-[#4F772D] hover:bg-[#4F772D]/5 transition flex items-center justify-center group ${ring}`}>
        <Plus className="h-4 w-4 text-gray-300 group-hover:text-[#4F772D]" strokeWidth={2} />
      </button>
    );
  }
  const mins = calcShiftMinutes(shift.start_time, shift.end_time, shift.break_minutes);
  return (
    <button onClick={onClick}
      className={`w-full h-16 rounded-lg border text-left px-2 py-1.5 transition hover:opacity-80 ${STATUS_STYLE[shift.status] ?? ""} ${ring}`}>
      <p className="text-[11px] font-semibold leading-tight">{shift.start_time.slice(0,5)}–{shift.end_time.slice(0,5)}</p>
      <p className="text-[10px] leading-tight mt-0.5 opacity-70">
        {(mins/60).toFixed(1)}h{shift.break_minutes > 0 ? ` · ${shift.break_minutes}' Pause` : ""}
      </p>
      {shift.status === "draft" && <span className="text-[9px] bg-gray-200 text-gray-500 rounded px-1">Entwurf</span>}
    </button>
  );
}

type EditState = { empId: string; date: string; existing?: ShiftSchedule; companyId?: string };

export default function AdminSchedulePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = new Date();

  const [tab, setTab] = useState<"grid" | "summary" | "requests">("grid");
  const [locationId, setLocationId] = useState("");
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(today));
  const [editing, setEditing] = useState<EditState | null>(null);
  const [form, setForm] = useState({ start_time: "06:00", end_time: "14:00", break_minutes: "30", notes: "" });
  const [summaryMonth, setSummaryMonth] = useState(today.getMonth() + 1);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [showWhatsAppConfirm, setShowWhatsAppConfirm] = useState(false);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekStartStr = toDateStr(weekStart);

  /* ─── Queries ─── */
  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("locations").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data as unknown as Location[];
    },
  });

  const { data: empLocs = [] } = useQuery<EmpLocRow[]>({
    queryKey: ["emp-locs-for-location", locationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_locations")
        .select("employee_id, hours_per_week, company_id, employees(id, first_name, last_name)")
        .eq("location_id", locationId);
      if (error) throw error;
      return (data ?? []) as unknown as EmpLocRow[];
    },
    enabled: !!locationId,
  });

  const { data: shifts = [] } = useQuery<ShiftSchedule[]>({
    queryKey: ["shifts", locationId, weekStartStr],
    queryFn: () => getScheduleForLocation(locationId, weekStartStr),
    enabled: !!locationId,
  });

  const { data: summaryShifts = [] } = useQuery<ShiftSchedule[]>({
    queryKey: ["summary-shifts", locationId, summaryMonth],
    queryFn: async () => {
      const yr = today.getFullYear();
      const start = `${yr}-${String(summaryMonth).padStart(2,"0")}-01`;
      const lastDay = new Date(yr, summaryMonth, 0).getDate();
      const end = `${yr}-${String(summaryMonth).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
      const { data, error } = await supabase
        .from("shift_schedules").select("*")
        .eq("location_id", locationId)
        .gte("scheduled_date", start).lte("scheduled_date", end)
        .eq("status", "published");
      if (error) throw error;
      return (data ?? []) as unknown as ShiftSchedule[];
    },
    enabled: !!locationId && empLocs.length > 0,
  });

  const { data: approvedRecords = [] } = useQuery<{ employee_id: string; start_time: string; end_time: string | null; break_minutes: number }[]>({
    queryKey: ["approved-records-summary", summaryMonth, locationId],
    queryFn: async () => {
      const yr = today.getFullYear();
      const start = `${yr}-${String(summaryMonth).padStart(2,"0")}-01`;
      const lastDay2 = new Date(yr, summaryMonth, 0).getDate();
      const end = `${yr}-${String(summaryMonth).padStart(2,"0")}-${String(lastDay2).padStart(2,"0")}`;
      const empIds = empLocs.map((e) => e.employee_id);
      if (!empIds.length) return [];
      const { data, error } = await supabase
        .from("time_records").select("employee_id, start_time, end_time, break_minutes")
        .in("employee_id", empIds).gte("work_date", start).lte("work_date", end)
        .eq("status", "approved").not("end_time", "is", null);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!locationId && empLocs.length > 0,
  });

  const { data: changeRequests = [] } = useQuery<ChangeReqWithJoins[]>({
    queryKey: ["change-requests"],
    queryFn: () => getChangeRequests(),
  });
  const pendingCount = changeRequests.filter((r) => r.status === "pending").length;

  /* ─── Derived ─── */
  const shiftMap = useMemo(() => {
    const m: Record<string, Record<string, ShiftSchedule>> = {};
    shifts.forEach((s) => { if (!m[s.employee_id]) m[s.employee_id] = {}; m[s.employee_id][s.scheduled_date] = s; });
    return m;
  }, [shifts]);

  /* ─── Mutations ─── */
  const upsertShift = useMutation({
    mutationFn: async () => {
      if (!editing || !user) return;
      const payload = {
        employee_id: editing.empId,
        location_id: locationId,
        scheduled_date: editing.date,
        start_time: form.start_time,
        end_time: form.end_time,
        break_minutes: parseInt(form.break_minutes) || 30,
        notes: form.notes || null,
        created_by: user.id,
        ...(editing.companyId ? { company_id: editing.companyId } : {}),
      };
      if (editing.existing) {
        const { error } = await supabase.from("shift_schedules").update(payload).eq("id", editing.existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shift_schedules").insert({ ...payload, status: "draft" });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shifts"] }); toast.success("Schicht gespeichert"); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelShift = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shift_schedules").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shifts"] }); toast.success("Schicht storniert"); setEditing(null); },
  });

  const publishWeek = useMutation({
    mutationFn: async () => {
      const drafts = shifts.filter((s) => s.status === "draft");
      if (!drafts.length) { toast("Keine Entwürfe vorhanden"); return; }
      const { error } = await supabase.from("shift_schedules").update({ status: "published" }).in("id", drafts.map((s) => s.id));
      if (error) throw error;
      const newConflicts: string[] = [];
      for (const shift of drafts) {
        const { data: existing } = await supabase
          .from("time_records").select("id").eq("employee_id", shift.employee_id)
          .eq("work_date", shift.scheduled_date).neq("created_via", "schedule").limit(1);
        if (existing && existing.length > 0) { newConflicts.push(shift.scheduled_date); continue; }
        await supabase.from("time_records").delete()
          .eq("employee_id", shift.employee_id)
          .eq("work_date", shift.scheduled_date)
          .eq("created_via", "schedule");
        const { error: insertErr } = await supabase.from("time_records").insert({
          employee_id: shift.employee_id, company_id: shift.company_id,
          work_date: shift.scheduled_date, start_time: shift.start_time,
          end_time: shift.end_time, break_minutes: shift.break_minutes,
          net_minutes: calcShiftMinutes(shift.start_time, shift.end_time, shift.break_minutes),
          status: "draft", created_via: "schedule", location_type: "office",
        });
        if (insertErr) newConflicts.push(shift.scheduled_date);
      }
      if (newConflicts.length) setConflicts(newConflicts);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shifts"] }); toast.success("Woche veröffentlicht"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveRequest = useMutation({
    mutationFn: async ({ req, note }: { req: ChangeReqWithJoins; note: string }) => {
      const { error: se } = await supabase.from("shift_schedules")
        .update({ start_time: req.requested_start, end_time: req.requested_end, break_minutes: req.break_minutes })
        .eq("id", req.shift_schedule_id);
      if (se) throw se;
      const { error: re } = await supabase.from("schedule_change_requests")
        .update({ status: "approved", admin_note: note || null, resolved_at: new Date().toISOString() })
        .eq("id", req.id);
      if (re) throw re;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["change-requests"] }); qc.invalidateQueries({ queryKey: ["shifts"] }); toast.success("Genehmigt"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectRequest = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await supabase.from("schedule_change_requests")
        .update({ status: "rejected", admin_note: note || null, resolved_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["change-requests"] }); toast.success("Abgelehnt"); },
    onError: (e: Error) => toast.error(e.message),
  });

  function generateScheduleText(): string {
    const locationName = locations.find((l) => l.id === locationId)?.name ?? "Filiale";
    const lines: string[] = [
      `📅 *Dienstplan ${weekLabel}*`,
      `📍 ${locationName}`,
      ``,
    ];
    for (const el of empLocs) {
      const emp = el.employees;
      if (!emp) continue;
      const weekMins = weekDays.reduce((s, d) => {
        const sh = shiftMap[el.employee_id]?.[toDateStr(d)];
        return s + (sh && sh.status !== "cancelled" ? calcShiftMinutes(sh.start_time, sh.end_time, sh.break_minutes) : 0);
      }, 0);
      lines.push(`👤 *${emp.first_name} ${emp.last_name}* (Σ ${(weekMins / 60).toFixed(1)}h)`);
      weekDays.forEach((d, i) => {
        const sh = shiftMap[el.employee_id]?.[toDateStr(d)];
        const day = DAYS_DE[i];
        if (sh && sh.status !== "cancelled") {
          const mins = calcShiftMinutes(sh.start_time, sh.end_time, sh.break_minutes);
          const draftMark = sh.status === "draft" ? " _(Entwurf)_" : "";
          lines.push(`${day}: ${sh.start_time.slice(0, 5)}–${sh.end_time.slice(0, 5)} (${(mins / 60).toFixed(1)}h)${draftMark}`);
        } else {
          lines.push(`${day}: —`);
        }
      });
      lines.push(``);
    }
    return lines.join("\n");
  }

  function shareToWhatsApp() {
    if (!locationId || empLocs.length === 0) { toast("Bitte Filiale mit Mitarbeiter:innen wählen"); return; }
    setShowWhatsAppConfirm(true);
  }

  function doShareToWhatsApp() {
    setShowWhatsAppConfirm(false);
    const text = generateScheduleText();
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  function openEdit(empId: string, date: string) {
    const el = empLocs.find((e) => e.employee_id === empId);
    const existing = shiftMap[empId]?.[date];
    setEditing({ empId, date, existing, companyId: el?.company_id });
    setForm(existing
      ? { start_time: existing.start_time.slice(0,5), end_time: existing.end_time.slice(0,5), break_minutes: String(existing.break_minutes), notes: existing.notes ?? "" }
      : { start_time: "06:00", end_time: "14:00", break_minutes: "30", notes: "" }
    );
  }

  const weekLabel = `KW ${format(weekStart, "ww")} · ${format(weekStart, "d. MMM", { locale: de })} – ${format(addDays(weekStart, 6), "d. MMM yyyy", { locale: de })}`;

  /* ─── Render ─── */
  return (
    <>
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Dienstplan</h1>
          <p className="mt-0.5 text-sm text-gray-500">Schichten je Filiale verwalten und veröffentlichen</p>
        </div>
        <select value={locationId} onChange={(e) => setLocationId(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-[#4F772D] focus:outline-none min-w-[220px]">
          <option value="">Filiale wählen…</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 w-fit">
        {(["grid","summary","requests"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`relative rounded-lg px-4 py-2 text-sm font-medium transition ${tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "grid" && <><Calendar className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" strokeWidth={1.5} />Dienstplan</>}
            {t === "summary" && <><TrendingUp className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" strokeWidth={1.5} />Stunden</>}
            {t === "requests" && <>
              <Clock className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" strokeWidth={1.5} />Anfragen
              {pendingCount > 0 && <span className="ml-1.5 rounded-full bg-amber-500 text-white text-[10px] px-1.5 py-0.5 font-semibold">{pendingCount}</span>}
            </>}
          </button>
        ))}
      </div>

      {/* ── Grid Tab ── */}
      {tab === "grid" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => setWeekStart(addDays(weekStart,-7))} className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50 transition">
              <ChevronLeft className="h-4 w-4 text-gray-500" strokeWidth={1.5} />
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-[260px] text-center">{weekLabel}</span>
            <button onClick={() => setWeekStart(addDays(weekStart,7))} className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50 transition">
              <ChevronRight className="h-4 w-4 text-gray-500" strokeWidth={1.5} />
            </button>
            <button onClick={() => setWeekStart(getMonday(today))} className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 transition">Heute</button>
            <div className="flex-1" />
            {!!locationId && (
              <button onClick={shareToWhatsApp}
                className="flex items-center gap-2 rounded-lg border border-[#25D366] px-4 py-2 text-sm font-medium text-[#25D366] hover:bg-[#25D366]/10 transition">
                <Share2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                WhatsApp
              </button>
            )}
            {!!locationId && (
              <button onClick={() => publishWeek.mutate()}
                disabled={publishWeek.isPending || !shifts.some((s) => s.status === "draft")}
                className="flex items-center gap-2 rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] transition disabled:opacity-40">
                <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
                Veröffentlichen{shifts.filter((s) => s.status === "draft").length > 0 ? ` (${shifts.filter((s) => s.status === "draft").length})` : ""}
              </button>
            )}
          </div>

          {conflicts.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" strokeWidth={1.5} />
                <p className="text-sm font-semibold text-amber-800">Konflikte — manuelle Einträge nicht überschrieben</p>
              </div>
              <ul className="text-xs text-amber-700 space-y-0.5">{conflicts.map((c) => <li key={c}>· {c}</li>)}</ul>
              <button onClick={() => setConflicts([])} className="mt-2 text-xs text-amber-600 underline">Schließen</button>
            </div>
          )}

          {!locationId ? (
            <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
              <div className="text-center"><MapPin className="mx-auto h-8 w-8 text-gray-300 mb-2" strokeWidth={1.5} /><p className="text-sm text-gray-400">Filiale wählen</p></div>
            </div>
          ) : empLocs.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-xl border border-gray-200 bg-white">
              <div className="text-center"><Users className="mx-auto h-8 w-8 text-gray-300 mb-2" strokeWidth={1.5} /><p className="text-sm text-gray-400">Keine Mitarbeiter:innen zugeordnet</p></div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                    <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-500 min-w-[160px]">Mitarbeiterin</th>
                    {weekDays.map((d, i) => {
                      const isT = isSameDay(d, today);
                      return (
                        <th key={i} className={`px-2 py-3 text-center text-xs font-semibold min-w-[110px] ${isT ? "text-blue-600 bg-blue-50/50" : "text-gray-500"}`}>
                          <span>{DAYS_DE[i]}</span><br />
                          <span className="font-normal">{format(d,"d.M.")}</span>
                          {isT && <span className="block text-[9px] bg-blue-100 text-blue-700 rounded-full px-1.5 mt-0.5 mx-auto w-fit">Heute</span>}
                        </th>
                      );
                    })}
                    <th className="px-3 py-3 text-center text-xs font-semibold text-[#4F772D] min-w-[60px]">Σ Woche</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {empLocs.map((el) => {
                    const emp = el.employees;
                    if (!emp) return null;
                    const weekMins = weekDays.reduce((s, d) => {
                      const sh = shiftMap[el.employee_id]?.[toDateStr(d)];
                      return s + (sh ? calcShiftMinutes(sh.start_time, sh.end_time, sh.break_minutes) : 0);
                    }, 0);
                    return (
                      <tr key={el.employee_id} className="hover:bg-gray-50/40 transition">
                        <td className="sticky left-0 z-10 bg-white px-4 py-3 border-r border-gray-50">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#4F772D]/10 text-xs font-bold text-[#4F772D]">
                              {emp.first_name[0]}{emp.last_name[0]}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-900 whitespace-nowrap">{emp.first_name} {emp.last_name}</p>
                              <p className="text-[10px] text-gray-400">{el.hours_per_week}h/Wo</p>
                            </div>
                          </div>
                        </td>
                        {weekDays.map((d, i) => {
                          const dateStr = toDateStr(d);
                          const shift = shiftMap[el.employee_id]?.[dateStr];
                          return (
                            <td key={i} className={`px-2 py-2 ${isSameDay(d,today) ? "bg-blue-50/30" : ""}`}>
                              <ShiftCell shift={shift} isToday={isSameDay(d,today)} onClick={() => openEdit(el.employee_id, dateStr)} />
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center border-l border-gray-50">
                          <p className={`text-sm font-bold ${weekMins > 0 ? "text-[#4F772D]" : "text-gray-300"}`}>{weekMins > 0 ? `${(weekMins/60).toFixed(1)}h` : "—"}</p>
                          <p className="text-[10px] text-gray-400">{el.hours_per_week}h Soll</p>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Day totals footer */}
                  <tr className="bg-[#4F772D]/5 border-t-2 border-[#4F772D]/20">
                    <td className="sticky left-0 bg-[#4F772D]/5 px-4 py-2.5 text-xs font-semibold text-[#4F772D]">Tages-Σ</td>
                    {weekDays.map((d, i) => {
                      const dateStr = toDateStr(d);
                      const dayMins = empLocs.reduce((s, el) => {
                        const sh = shiftMap[el.employee_id]?.[dateStr];
                        return s + (sh ? calcShiftMinutes(sh.start_time, sh.end_time, sh.break_minutes) : 0);
                      }, 0);
                      return (
                        <td key={i} className={`px-2 py-2.5 text-center ${isSameDay(d,today) ? "bg-blue-50/30" : ""}`}>
                          <span className="text-xs font-bold text-gray-700">{dayMins > 0 ? `${(dayMins/60).toFixed(1)}h` : "—"}</span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-sm font-bold text-[#4F772D]">
                        {(empLocs.reduce((tot, el) =>
                          tot + weekDays.reduce((s, d) => {
                            const sh = shiftMap[el.employee_id]?.[toDateStr(d)];
                            return s + (sh ? calcShiftMinutes(sh.start_time, sh.end_time, sh.break_minutes) : 0);
                          }, 0), 0) / 60).toFixed(1)}h
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center gap-4 text-[10px] text-gray-400">
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-gray-200 border border-gray-300" />Entwurf</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-[#4F772D]/30 border border-[#4F772D]/40" />Veröffentlicht</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-red-100 border border-red-200" />Storniert</span>
          </div>
        </div>
      )}

      {/* ── Summary Tab ── */}
      {tab === "summary" && (
        <div className="space-y-4">
          <div className="flex gap-1 flex-wrap">
            {MONTHS.map((m, i) => (
              <button key={i} onClick={() => setSummaryMonth(i+1)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${i+1===summaryMonth ? "bg-[#4F772D] text-white" : "text-gray-500 hover:bg-gray-100"}`}>
                {m}
              </button>
            ))}
          </div>
          {!locationId ? <p className="text-sm text-gray-400">Filiale wählen</p> : (
            <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {empLocs.map((el) => {
                const emp = el.employees;
                if (!emp) return null;
                const scheduledMins = summaryShifts.filter((s) => s.employee_id === el.employee_id)
                  .reduce((s, sh) => s + calcShiftMinutes(sh.start_time, sh.end_time, sh.break_minutes), 0);
                const actualMins = approvedRecords.filter((r) => r.employee_id === el.employee_id)
                  .reduce((s, r) => {
                    if (!r.end_time) return s;
                    const [sh2,sm2] = r.start_time.split(":").map(Number);
                    const [eh2,em2] = r.end_time.split(":").map(Number);
                    return s + (eh2*60+em2) - (sh2*60+sm2) - r.break_minutes;
                  }, 0);
                const diff = actualMins - scheduledMins;
                const hasDiff = Math.abs(diff) > 120;
                return (
                  <div key={el.employee_id} className={`rounded-xl border p-4 ${hasDiff ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4F772D]/10 text-xs font-bold text-[#4F772D]">
                        {emp.first_name[0]}{emp.last_name[0]}
                      </div>
                      <p className="text-sm font-medium text-gray-900 flex-1">{emp.first_name} {emp.last_name}</p>
                      {hasDiff && <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" strokeWidth={1.5} />}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-gray-50 px-3 py-2">
                        <p className="text-gray-400 mb-0.5">Geplant</p>
                        <p className="text-base font-bold text-gray-900">{(scheduledMins/60).toFixed(1)}h</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 px-3 py-2">
                        <p className="text-gray-400 mb-0.5">Tatsächlich</p>
                        <p className={`text-base font-bold ${hasDiff ? "text-amber-600" : "text-gray-900"}`}>{(actualMins/60).toFixed(1)}h</p>
                      </div>
                    </div>
                    {hasDiff && <p className="mt-2 text-[10px] text-amber-600 font-medium">{diff > 0 ? "+" : ""}{(diff/60).toFixed(1)}h Abweichung</p>}
                  </div>
                );
              })}
            </div>
            {empLocs.length > 0 && (
              <div className="rounded-xl border-2 border-[#4F772D]/30 bg-[#4F772D]/5 px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[#4F772D] uppercase tracking-wide">Filiale gesamt</p>
                  <p className="text-xs text-gray-400 mt-0.5">{empLocs.length} Mitarbeiter:innen · {MONTHS[summaryMonth - 1]}</p>
                </div>
                <p className="text-2xl font-bold text-[#4F772D]">
                  {(summaryShifts.reduce((s, sh) => s + calcShiftMinutes(sh.start_time, sh.end_time, sh.break_minutes), 0) / 60).toFixed(1)}h
                </p>
              </div>
            )}
            </div>
          )}
        </div>
      )}

      {/* ── Requests Tab ── */}
      {tab === "requests" && (
        <ChangeRequestPanel
          requests={changeRequests}
          onApprove={(req, note) => approveRequest.mutate({ req, note })}
          onReject={(id, note) => rejectRequest.mutate({ id, note })}
        />
      )}

      {/* ── Edit Modal ── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">{editing.existing ? "Schicht bearbeiten" : "Neue Schicht"}</h3>
              <button onClick={() => setEditing(null)} className="rounded-lg p-1.5 hover:bg-gray-100 transition">
                <X className="h-4 w-4 text-gray-400" strokeWidth={2} />
              </button>
            </div>
            <p className="mb-4 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              {format(parseISO(editing.date), "EEEE, d. MMMM yyyy", { locale: de })}
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Beginn</label>
                  <input type="time" value={form.start_time} onChange={(e) => setForm({...form, start_time: e.target.value})}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Ende</label>
                  <input type="time" value={form.end_time} onChange={(e) => setForm({...form, end_time: e.target.value})}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Pause (Min.)</label>
                <input type="number" min="0" max="120" value={form.break_minutes}
                  onChange={(e) => setForm({...form, break_minutes: e.target.value})}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Notiz (optional)</label>
                <input type="text" value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})}
                  placeholder="z.B. Einschulung…"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none" />
              </div>
              {form.start_time && form.end_time && (() => {
                const netMins = calcShiftMinutes(form.start_time, form.end_time, parseInt(form.break_minutes) || 0);
                return netMins > 0 ? (
                  <div className="rounded-lg bg-[#4F772D]/5 border border-[#4F772D]/20 px-3 py-2 text-sm font-semibold text-[#4F772D]">
                    Nettozeit: {formatShiftHours(form.start_time, form.end_time, parseInt(form.break_minutes) || 0)}
                  </div>
                ) : (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
                    Endzeit muss nach Startzeit liegen
                  </div>
                );
              })()}
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => upsertShift.mutate()}
                disabled={upsertShift.isPending || calcShiftMinutes(form.start_time, form.end_time, parseInt(form.break_minutes) || 0) <= 0}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#4F772D] py-2.5 text-sm font-semibold text-white hover:bg-[#31572C] transition disabled:opacity-50">
                <Check className="h-4 w-4" strokeWidth={2} />Speichern
              </button>
              {editing.existing && (
                <button onClick={() => cancelShift.mutate(editing.existing!.id)}
                  className="rounded-xl border border-red-200 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 transition">
                  Stornieren
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>

    {showWhatsAppConfirm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Dienstplan teilen?</h3>
          <p className="text-sm text-gray-600 mb-1">Der Dienstplan enthält Namen und Arbeitszeiten deiner Mitarbeiter:innen.</p>
          <p className="text-xs text-gray-400 mb-5">
            Diese Daten werden als WhatsApp-Nachricht an Meta-Server übertragen (DSGVO Art. 6 Abs. 1 lit. b).
            Teile den Plan nur in geschlossenen Gruppen mit betroffenen Mitarbeiter:innen.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setShowWhatsAppConfirm(false)}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
              Abbrechen
            </button>
            <button onClick={doShareToWhatsApp}
              className="flex-1 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-medium text-white hover:bg-[#1da851] transition">
              Teilen
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function ChangeRequestPanel({
  requests, onApprove, onReject,
}: {
  requests: ChangeReqWithJoins[];
  onApprove: (req: ChangeReqWithJoins, note: string) => void;
  onReject: (id: string, note: string) => void;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const pending = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status !== "pending").slice(0, 8);

  return (
    <div className="space-y-4">
      {pending.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-xl border border-gray-200 bg-white">
          <p className="text-sm text-gray-400">Keine offenen Anfragen</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((req) => (
            <div key={req.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-700">
                  {req.employees?.first_name?.[0]}{req.employees?.last_name?.[0]}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{req.employees?.first_name} {req.employees?.last_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {req.shift_schedules?.scheduled_date && format(parseISO(req.shift_schedules.scheduled_date), "EEEE, d. MMM yyyy", { locale: de })}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-white/70 px-2 py-1.5">
                      <p className="text-gray-400">Aktuell</p>
                      <p className="font-medium text-gray-700">{req.shift_schedules?.start_time?.slice(0,5)} – {req.shift_schedules?.end_time?.slice(0,5)}</p>
                    </div>
                    <div className="rounded bg-white/70 px-2 py-1.5">
                      <p className="text-gray-400">Beantragt</p>
                      <p className="font-medium text-[#4F772D]">{req.requested_start?.slice(0,5)} – {req.requested_end?.slice(0,5)}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-600 bg-white/70 rounded px-2 py-1.5 italic">„{req.reason}"</p>
                  <div className="mt-3 flex items-center gap-2">
                    <input type="text" placeholder="Admin-Notiz (optional)…" value={notes[req.id] ?? ""}
                      onChange={(e) => setNotes({ ...notes, [req.id]: e.target.value })}
                      className="flex-1 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs focus:border-[#4F772D] focus:outline-none" />
                    <button onClick={() => onReject(req.id, notes[req.id]??"")}
                      className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition">
                      <X className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} />
                      Ablehnen
                    </button>
                    <button onClick={() => onApprove(req, notes[req.id]??"")}
                      className="flex items-center gap-1.5 rounded-lg bg-[#4F772D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#31572C] transition">
                      <Check className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} />
                      Genehmigen
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {resolved.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Zuletzt bearbeitet</p>
          <div className="space-y-2">
            {resolved.map((req) => (
              <div key={req.id} className={`rounded-lg border px-4 py-3 flex items-center justify-between ${req.status === "approved" ? "border-green-100 bg-green-50" : "border-gray-100 bg-gray-50"}`}>
                <div>
                  <p className="text-xs font-medium text-gray-800">{req.employees?.first_name} {req.employees?.last_name}</p>
                  <p className="text-[10px] text-gray-400">{req.shift_schedules?.scheduled_date}</p>
                </div>
                <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${req.status === "approved" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                  {req.status === "approved" ? "Genehmigt" : "Abgelehnt"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
