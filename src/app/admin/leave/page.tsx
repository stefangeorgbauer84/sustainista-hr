"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllPendingAbsences, approveAbsence, rejectAbsence } from "@/lib/leave";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Check, X, Calendar } from "lucide-react";
import type { Absence } from "@/types";
import { useState } from "react";

type AbsenceWithJoin = Absence & {
  employees: { first_name: string; last_name: string } | null;
  absence_types: { name: string } | null;
};

export default function AdminLeavePage() {
  const qc = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");

  const { data: pending = [], isLoading } = useQuery<AbsenceWithJoin[]>({
    queryKey: ["pending-leaves"],
    queryFn: getAllPendingAbsences as () => Promise<AbsenceWithJoin[]>,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveAbsence(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pending-leaves"] }); toast.success("Antrag genehmigt"); },
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Urlaubsanträge</h1>
        <p className="mt-0.5 text-sm text-gray-500">{pending.length} offene Anträge</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
          <h2 className="text-sm font-medium text-gray-900">Ausstehende Genehmigungen</h2>
        </div>

        {isLoading ? (
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
                    <button onClick={() => { setRejectTarget(req.id); setRejectionNote(""); }}
                      disabled={rejectMutation.isPending || approveMutation.isPending}
                      className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-60">
                      <X className="h-3.5 w-3.5" strokeWidth={2} /> Ablehnen
                    </button>
                    <button onClick={() => approveMutation.mutate(req.id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="flex items-center gap-1.5 rounded-lg bg-[#4F772D] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#31572C] disabled:opacity-60">
                      <Check className="h-3.5 w-3.5" strokeWidth={2} /> Genehmigen
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
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
              <button onClick={() => setRejectTarget(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Abbrechen
              </button>
              <button
                onClick={() => rejectMutation.mutate({ id: rejectTarget, note: rejectionNote })}
                disabled={rejectMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60">
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
