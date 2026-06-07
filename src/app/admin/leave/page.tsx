"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllPendingRequests, approveLeave, rejectLeave } from "@/lib/leave";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Check, X, Calendar } from "lucide-react";

const typeLabels: Record<string, string> = {
  vacation: "Urlaub",
  sick: "Krankenstand",
  unpaid: "Unbezahlter Urlaub",
  special: "Sonderurlaub",
};

export default function AdminLeavePage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ["pending-leaves"],
    queryFn: getAllPendingRequests,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveLeave(id, user!.$id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pending-leaves"] }); toast.success("Antrag genehmigt"); },
    onError: () => toast.error("Fehler beim Genehmigen"),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectLeave(id, user!.$id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pending-leaves"] }); toast.success("Antrag abgelehnt"); },
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
            {pending.map(req => (
              <div key={req.$id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{req.employeeName}</p>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                      {typeLabels[req.type]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {format(parseISO(req.startDate), "d. MMMM", { locale: de })} –{" "}
                    {format(parseISO(req.endDate), "d. MMMM yyyy", { locale: de })}
                    {" · "}<strong>{req.days} Werktage</strong>
                  </p>
                  {req.reason && <p className="mt-1 text-xs text-gray-400 italic">{req.reason}</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => rejectMutation.mutate(req.$id)}
                    disabled={rejectMutation.isPending || approveMutation.isPending}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2} />
                    Ablehnen
                  </button>
                  <button
                    onClick={() => approveMutation.mutate(req.$id)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    className="flex items-center gap-1.5 rounded-lg bg-[#4F772D] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#31572C] disabled:opacity-60"
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={2} />
                    Genehmigen
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
