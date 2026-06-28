"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllPendingAbsences, approveAbsence, rejectAbsence } from "@/lib/leave";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Check, X, Calendar, Users, TrendingUp } from "lucide-react";
import type { Absence } from "@/types";
import { useState } from "react";

type AbsenceWithJoin = Absence & {
  employees: { first_name: string; last_name: string } | null;
  absence_types: { name: string } | null;
};

type LeaveBalanceRow = {
  id: string; employee_id: string; year: number;
  entitlement_days: number; taken_days: number; remaining_days: number;
  absence_type_id: string;
  employees: { first_name: string; last_name: string } | null;
  absence_types: { name: string } | null;
};

type ApprovedAbsence = AbsenceWithJoin & { approved_at?: string | null };

const TABS = [
  { key: "pending", label: "Ausstehend", icon: Calendar },
  { key: "approved", label: "Genehmigt", icon: Check },
  { key: "balances", label: "Urlaubskonten", icon: TrendingUp },
] as const;

type Tab = typeof TABS[number]["key"];

export default function AdminLeavePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [balanceYear, setBalanceYear] = useState(new Date().getFullYear());

  const { data: pending = [], isLoading: pendingLoading } = useQuery<AbsenceWithJoin[]>({
    queryKey: ["pending-leaves"],
    queryFn: getAllPendingAbsences as () => Promise<AbsenceWithJoin[]>,
  });

  const { data: approved = [], isLoading: approvedLoading } = useQuery<ApprovedAbsence[]>({
    queryKey: ["approved-leaves"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("absences")
        .select("*, employees(first_name, last_name), absence_types(name)")
        .eq("status", "approved")
        .order("start_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as ApprovedAbsence[];
    },
    enabled: tab === "approved",
  });

  const { data: balances = [], isLoading: balancesLoading } = useQuery<LeaveBalanceRow[]>({
    queryKey: ["leave-balances", balanceYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_balances")
        .select("*, employees(first_name, last_name), absence_types(name)")
        .eq("year", balanceYear)
        .order("employee_id")
        .limit(500);
      if (error) throw error;
      return data as LeaveBalanceRow[];
    },
    enabled: tab === "balances",
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveAbsence(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-leaves"] });
      qc.invalidateQueries({ queryKey: ["approved-leaves"] });
      qc.invalidateQueries({ queryKey: ["leave-balances"] });
      toast.success("Antrag genehmigt");
    },
    onError: () => toast.error("Fehler beim Genehmigen"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => rejectAbsence(id, note || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-leaves"] });
      toast.success("Antrag abgelehnt");
      setRejectTarget(null);
      setRejectionNote("");
    },
    onError: () => toast.error("Fehler beim Ablehnen"),
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(pending.map(p => approveAbsence(p.id)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-leaves"] });
      qc.invalidateQueries({ queryKey: ["approved-leaves"] });
      qc.invalidateQueries({ queryKey: ["leave-balances"] });
      toast.success(`${pending.length} Anträge genehmigt`);
    },
    onError: () => toast.error("Fehler beim Bulk-Genehmigen"),
  });

  const balanceByEmp: Record<string, LeaveBalanceRow[]> = {};
  for (const b of balances) {
    balanceByEmp[b.employee_id] = balanceByEmp[b.employee_id] ?? [];
    balanceByEmp[b.employee_id].push(b);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Urlaubsanträge</h1>
          <p className="mt-0.5 text-sm text-gray-500">{pending.length} offene Anträge</p>
        </div>
        {tab === "pending" && pending.length > 1 && (
          <button
            onClick={() => bulkApproveMutation.mutate()}
            disabled={bulkApproveMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-[#4F772D] px-3 py-2 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60 transition"
          >
            <Check className="h-4 w-4" strokeWidth={2} />
            {bulkApproveMutation.isPending ? "Wird genehmigt…" : `Alle ${pending.length} genehmigen`}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                tab === t.key
                  ? "border-[#4F772D] text-[#4F772D]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
              {t.label}
              {t.key === "pending" && pending.length > 0 && (
                <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-bold text-white">
                  {pending.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Ausstehend ── */}
      {tab === "pending" && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
            <h2 className="text-sm font-medium text-gray-900">Ausstehende Genehmigungen</h2>
          </div>
          {pendingLoading ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">Wird geladen…</p>
          ) : pending.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
                <Check className="h-5 w-5 text-green-500" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-gray-900">Alles erledigt</p>
              <p className="mt-1 text-xs text-gray-400">Keine offenen Urlaubsanträge</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {pending.map(req => {
                const name = req.employees
                  ? `${req.employees.first_name} ${req.employees.last_name}`
                  : "Unbekannt";
                return (
                  <div key={req.id} className="flex items-center justify-between px-5 py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{name}</p>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                          {req.absence_types?.name ?? req.absence_type_id}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {format(parseISO(req.start_date), "d. MMMM", { locale: de })} –{" "}
                        {format(parseISO(req.end_date), "d. MMMM yyyy", { locale: de })}
                        {req.working_days != null && <>{" · "}<strong>{req.working_days} Werktage</strong></>}
                      </p>
                      {req.reason && <p className="mt-1 text-xs text-gray-400 italic">{req.reason}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setRejectTarget(req.id); setRejectionNote(""); }}
                        disabled={rejectMutation.isPending || approveMutation.isPending}
                        className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2} /> Ablehnen
                      </button>
                      <button
                        onClick={() => approveMutation.mutate(req.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        className="flex items-center gap-1.5 rounded-lg bg-[#4F772D] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#31572C] disabled:opacity-60"
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={2} /> Genehmigen
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Genehmigt ── */}
      {tab === "approved" && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-2">
            <Check className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
            <h2 className="text-sm font-medium text-gray-900">Genehmigte Abwesenheiten</h2>
          </div>
          {approvedLoading ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">Wird geladen…</p>
          ) : approved.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">Keine genehmigten Abwesenheiten</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {approved.map(req => {
                const name = req.employees
                  ? `${req.employees.first_name} ${req.employees.last_name}`
                  : "Unbekannt";
                return (
                  <div key={req.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{name}</p>
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] text-green-700">
                          {req.absence_types?.name ?? "Urlaub"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {format(parseISO(req.start_date), "d. MMMM", { locale: de })} –{" "}
                        {format(parseISO(req.end_date), "d. MMMM yyyy", { locale: de })}
                        {req.working_days != null && <>{" · "}{req.working_days} Werktage</>}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {format(parseISO(req.start_date), "yyyy")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Urlaubskonten ── */}
      {tab === "balances" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Jahr:</span>
            <div className="flex gap-1">
              {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(y => (
                <button
                  key={y}
                  onClick={() => setBalanceYear(y)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    y === balanceYear
                      ? "bg-[#4F772D] text-white"
                      : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          {balancesLoading ? (
            <p className="py-8 text-center text-sm text-gray-400">Wird geladen…</p>
          ) : Object.keys(balanceByEmp).length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white px-5 py-12 text-center">
              <Users className="mx-auto mb-3 h-8 w-8 text-gray-300" strokeWidth={1} />
              <p className="text-sm text-gray-500">Keine Urlaubskonten für {balanceYear}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-50">
              {Object.entries(balanceByEmp).map(([empId, rows]) => {
                const emp = rows[0]?.employees;
                const name = emp ? `${emp.first_name} ${emp.last_name}` : "Unbekannt";
                return (
                  <div key={empId} className="px-5 py-4">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#4F772D]/10 text-xs font-semibold text-[#4F772D]">
                        {name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                      </div>
                      <p className="text-sm font-medium text-gray-900">{name}</p>
                    </div>
                    <div className="space-y-2.5">
                      {rows.map(row => {
                        const pct = Math.min(100, Math.round((row.taken_days / (row.entitlement_days || 1)) * 100));
                        return (
                          <div key={row.id}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-500">{row.absence_types?.name ?? "Urlaub"}</span>
                              <span className="text-xs text-gray-700">
                                <strong>{row.taken_days}</strong> / {row.entitlement_days} Tage
                                {" · "}
                                <span className={row.remaining_days <= 3 ? "text-red-500 font-semibold" : "text-green-600 font-semibold"}>
                                  {row.remaining_days} verbleibend
                                </span>
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-gray-100">
                              <div
                                className={`h-1.5 rounded-full transition-all ${
                                  pct >= 90 ? "bg-red-400" : pct >= 70 ? "bg-amber-400" : "bg-[#4F772D]"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Ablehnen-Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Antrag ablehnen</h3>
            <p className="text-xs text-gray-500 mb-4">Optional: Begründung für den Mitarbeiter angeben.</p>
            <textarea
              value={rejectionNote}
              onChange={e => setRejectionNote(e.target.value)}
              placeholder="z.B. Urlaubssperre in diesem Zeitraum, bitte anderen Termin wählen…"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setRejectTarget(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={() => rejectMutation.mutate({ id: rejectTarget, note: rejectionNote })}
                disabled={rejectMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60"
              >
                <X className="h-4 w-4" strokeWidth={2} />
                {rejectMutation.isPending ? "Wird abgelehnt…" : "Ablehnen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
