"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Employee } from "@/types";
import { toast } from "sonner";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { UserCheck, UserX, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";

export default function OnboardingQueuePage() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveData, setApproveData] = useState<Record<string, {
    department: string;
    position: string;
    startDate: string;
    vacationDaysTotal: number;
  }>>({});

  const { data: pending = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["pending-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as Employee[];
    },
  });

  const { data: recent = [] } = useQuery<Employee[]>({
    queryKey: ["recent-verified"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .neq("status", "pending")
        .order("updated_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as unknown as Employee[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, data }: {
      id: string;
      data: { department: string; position: string; startDate: string; vacationDaysTotal: number };
    }) => {
      const { error } = await supabase
        .from("employees")
        .update({
          status: "active",
          department: data.department,
          position: data.position,
          startDate: data.startDate,
          vacationDaysTotal: data.vacationDaysTotal,
          onboardingStep: "complete",
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-employees"] });
      qc.invalidateQueries({ queryKey: ["recent-verified"] });
      qc.invalidateQueries({ queryKey: ["all-employees"] });
      toast.success("Mitarbeiter wurde freigeschaltet");
      setExpanded(null);
    },
    onError: () => toast.error("Fehler beim Freischalten"),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from("employees")
        .update({
          status: "rejected",
          rejectionReason: reason,
          onboardingStep: "rejected",
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-employees"] });
      qc.invalidateQueries({ queryKey: ["recent-verified"] });
      toast.success("Antrag abgelehnt");
      setRejectingId(null);
      setRejectReason("");
    },
    onError: () => toast.error("Fehler beim Ablehnen"),
  });

  function getApproveData(id: string) {
    return approveData[id] ?? { department: "", position: "", startDate: new Date().toISOString().split("T")[0], vacationDaysTotal: 25 };
  }

  function setField(id: string, key: string, value: string | number) {
    setApproveData(prev => ({
      ...prev,
      [id]: { ...getApproveData(id), [key]: value },
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Onboarding-Anträge</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {pending.length > 0
            ? `${pending.length} ${pending.length === 1 ? "Antrag" : "Anträge"} warten auf Prüfung`
            : "Keine offenen Anträge"}
        </p>
      </div>

      {/* Pending */}
      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
          Wird geladen…
        </div>
      ) : pending.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <CheckCircle className="mx-auto h-10 w-10 text-green-400 mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-700">Alle Anträge bearbeitet</p>
          <p className="mt-1 text-xs text-gray-400">Neue Registrierungen erscheinen hier automatisch</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map(emp => (
            <div key={emp.id} className="rounded-xl border border-amber-100 bg-white shadow-sm overflow-hidden">
              {/* Header row */}
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-amber-50/40 transition"
                onClick={() => setExpanded(expanded === emp.id ? null : emp.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-700">
                    {emp.first_name?.[0]}{emp.last_name?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{emp.first_name} {emp.last_name}</p>
                    <p className="text-xs text-gray-400">{emp.contact_email}</p>
                    {emp.contact_phone && <p className="text-xs text-gray-400">{emp.contact_phone}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                    <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Ausstehend
                  </div>
                  <span className="text-xs text-gray-400">
                    {format(parseISO(emp.created_at), "d. MMM yyyy", { locale: de })}
                  </span>
                  {expanded === emp.id
                    ? <ChevronUp className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
                    : <ChevronDown className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
                  }
                </div>
              </div>

              {/* Expanded detail */}
              {expanded === emp.id && (
                <div className="border-t border-gray-100 px-5 py-5 space-y-5">
                  {/* Employee info summary */}
                  <div className="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-400">Adresse</p>
                      <p className="text-gray-700">{(emp.address as Record<string,string>)?.street || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Telefon</p>
                      <p className="text-gray-700">{emp.contact_phone || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">IBAN</p>
                      <p className="text-gray-700">{emp.bank_iban || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Registriert</p>
                      <p className="text-gray-700">{format(parseISO(emp.created_at), "d. MMM yyyy HH:mm", { locale: de })}</p>
                    </div>
                  </div>

                  {/* HR completes: department, position, startDate, vacation */}
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Arbeitsdaten vervollständigen</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700">Abteilung</label>
                        <input
                          value={getApproveData(emp.id).department}
                          onChange={e => setField(emp.id, "department", e.target.value)}
                          className={inp}
                          placeholder="Marketing"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700">Position</label>
                        <input
                          value={getApproveData(emp.id).position}
                          onChange={e => setField(emp.id, "position", e.target.value)}
                          className={inp}
                          placeholder="Consultant"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700">Eintrittsdatum</label>
                        <input
                          type="date"
                          value={getApproveData(emp.id).startDate}
                          onChange={e => setField(emp.id, "startDate", e.target.value)}
                          className={inp}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700">Urlaubsanspruch (Tage)</label>
                        <input
                          type="number"
                          min={0}
                          max={60}
                          value={getApproveData(emp.id).vacationDaysTotal}
                          onChange={e => setField(emp.id, "vacationDaysTotal", parseInt(e.target.value))}
                          className={inp}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {rejectingId === emp.id ? (
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700">Begründung der Ablehnung</label>
                        <textarea
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          rows={3}
                          className={`${inp} resize-none`}
                          placeholder="Bitte begründe die Ablehnung…"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setRejectingId(null)}
                          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                        >
                          Abbrechen
                        </button>
                        <button
                          onClick={() => rejectMutation.mutate({ id: emp.id, reason: rejectReason })}
                          disabled={!rejectReason.trim() || rejectMutation.isPending}
                          className="flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60"
                        >
                          <XCircle className="h-4 w-4" strokeWidth={1.5} />
                          Ablehnen bestätigen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setRejectingId(emp.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                      >
                        <UserX className="h-4 w-4" strokeWidth={1.5} />
                        Ablehnen
                      </button>
                      <button
                        onClick={() => {
                          const d = getApproveData(emp.id);
                          if (!d.department || !d.position) {
                            toast.error("Bitte Abteilung und Position ausfüllen");
                            return;
                          }
                          approveMutation.mutate({ id: emp.id, data: d });
                        }}
                        disabled={approveMutation.isPending}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60 transition"
                      >
                        <UserCheck className="h-4 w-4" strokeWidth={1.5} />
                        {approveMutation.isPending ? "Wird freigeschaltet…" : "Freischalten"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Recent decisions */}
      {recent.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-medium text-gray-900">Zuletzt bearbeitet</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {recent.map(emp => (
              <div key={emp.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{emp.first_name} {emp.last_name}</p>
                  <p className="text-xs text-gray-400">{emp.contact_email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs rounded-full px-2.5 py-1 font-medium ${
                    emp.is_active === true ? "bg-green-100 text-green-700" :
                    emp.is_active === false ? "bg-red-100 text-red-700" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {emp.is_active === true ? "Freigeschaltet" : emp.is_active === false ? "Abgelehnt" : "Ausstehend"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {format(parseISO(emp.updated_at), "d. MMM", { locale: de })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const inp = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none focus:ring-2 focus:ring-[#4F772D]/20";
