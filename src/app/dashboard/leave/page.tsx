"use client";

import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getLeaveRequestsForEmployee, createLeaveRequest, calcBusinessDays } from "@/lib/leave";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, Plus, X } from "lucide-react";
import { useState } from "react";

const schema = z.object({
  type: z.enum(["vacation", "sick", "unpaid", "special"]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const typeLabels: Record<string, string> = {
  vacation: "Urlaub",
  sick: "Krankenstand",
  unpaid: "Unbezahlter Urlaub",
  special: "Sonderurlaub",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
};

const statusLabels: Record<string, string> = {
  pending: "Ausstehend",
  approved: "Genehmigt",
  rejected: "Abgelehnt",
};

export default function LeavePage() {
  const { employee } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ["leaves", employee?.$id],
    queryFn: () => getLeaveRequestsForEmployee(employee!.$id),
    enabled: !!employee,
  });

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "vacation" },
  });

  const startDate = watch("startDate");
  const endDate = watch("endDate");
  const previewDays = startDate && endDate ? calcBusinessDays(startDate, endDate) : 0;
  const vacationLeft = (employee?.vacationDaysTotal ?? 25) - (employee?.vacationDaysUsed ?? 0);

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      createLeaveRequest(employee!.$id, `${employee!.firstName} ${employee!.lastName}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leaves"] });
      toast.success("Antrag eingereicht");
      reset();
      setShowForm(false);
    },
    onError: () => toast.error("Fehler beim Einreichen"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Urlaub & Abwesenheit</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {vacationLeft} von {employee?.vacationDaysTotal ?? 25} Urlaubstagen verbleibend
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#31572C]"
        >
          {showForm ? <X className="h-4 w-4" strokeWidth={1.5} /> : <Plus className="h-4 w-4" strokeWidth={1.5} />}
          {showForm ? "Abbrechen" : "Antrag stellen"}
        </button>
      </div>

      <div className="h-2 rounded-full bg-gray-200">
        <div
          className="h-2 rounded-full bg-[#4F772D] transition-all"
          style={{ width: `${Math.min(100, ((employee?.vacationDaysUsed ?? 0) / (employee?.vacationDaysTotal ?? 25)) * 100)}%` }}
        />
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Neuer Antrag</h2>
          <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Art der Abwesenheit</label>
              <select {...register("type")} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none">
                {Object.entries(typeLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Von</label>
                <input type="date" {...register("startDate")} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Bis</label>
                <input type="date" {...register("endDate")} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none" />
              </div>
            </div>
            {previewDays > 0 && (
              <p className="text-xs text-gray-500">
                Das sind <strong>{previewDays} Werktage</strong> (österreichische Feiertage ausgenommen)
              </p>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Anmerkung (optional)</label>
              <textarea {...register("reason")} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none resize-none" />
            </div>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full rounded-lg bg-[#4F772D] py-2 text-sm font-medium text-white transition hover:bg-[#31572C] disabled:opacity-60"
            >
              {mutation.isPending ? "Wird eingereicht…" : "Antrag einreichen"}
            </button>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
          <h2 className="text-sm font-medium text-gray-900">Meine Anträge</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {isLoading ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">Wird geladen…</p>
          ) : leaves.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">Noch keine Anträge</p>
          ) : (
            leaves.map(leave => (
              <div key={leave.$id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{typeLabels[leave.type]}</p>
                  <p className="text-xs text-gray-400">
                    {format(parseISO(leave.startDate), "d. MMM", { locale: de })} –{" "}
                    {format(parseISO(leave.endDate), "d. MMM yyyy", { locale: de })}
                    {" · "}{leave.days} Werktage
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusColors[leave.status]}`}>
                  {statusLabels[leave.status]}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
