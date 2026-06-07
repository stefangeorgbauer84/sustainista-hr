"use client";

import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getLeaveRequestsForEmployee, createLeaveRequest, calcBusinessDays } from "@/lib/leave";
import { storage, BUCKETS } from "@/lib/appwrite";
import { ID } from "appwrite";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, Plus, X, Upload, Download } from "lucide-react";
import { useState, useRef } from "react";

const schema = z.object({
  type: z.enum(["vacation", "sick", "unpaid", "special"]),
  startDate: z.string().min(1, "Startdatum erforderlich"),
  endDate: z.string().min(1, "Enddatum erforderlich"),
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
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ["leaves", employee?.$id],
    queryFn: () => getLeaveRequestsForEmployee(employee!.$id),
    enabled: !!employee,
  });

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "vacation" },
  });

  const watchType = watch("type");
  const startDate = watch("startDate");
  const endDate = watch("endDate");
  const previewDays = startDate && endDate && endDate >= startDate
    ? calcBusinessDays(startDate, endDate)
    : 0;

  const vacationLeft = (employee?.vacationDaysTotal ?? 25) - (employee?.vacationDaysUsed ?? 0);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      let sickNoteFileId: string | undefined;

      // Krankenzettel hochladen falls vorhanden
      if (data.type === "sick" && fileRef.current?.files?.[0]) {
        setUploading(true);
        const file = fileRef.current.files[0];
        const uploaded = await storage.createFile(BUCKETS.DOCUMENTS, ID.unique(), file);
        sickNoteFileId = uploaded.$id;
        setUploading(false);
      }

      return createLeaveRequest(employee!.$id, `${employee!.firstName} ${employee!.lastName}`, {
        ...data,
        sickNote: sickNoteFileId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leaves"] });
      toast.success("Antrag eingereicht");
      reset();
      setShowForm(false);
    },
    onError: () => { setUploading(false); toast.error("Fehler beim Einreichen"); },
  });

  function downloadUrl(fileId: string) {
    return `https://cloud.appwrite.io/v1/storage/buckets/${BUCKETS.DOCUMENTS}/files/${fileId}/download?project=6a2567ad0021c84890d1`;
  }

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
          className="flex items-center gap-2 rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] transition"
        >
          {showForm ? <X className="h-4 w-4" strokeWidth={1.5} /> : <Plus className="h-4 w-4" strokeWidth={1.5} />}
          {showForm ? "Abbrechen" : "Antrag stellen"}
        </button>
      </div>

      {/* Fortschrittsbalken Urlaub */}
      <div>
        <div className="mb-1.5 flex justify-between text-xs text-gray-500">
          <span>{employee?.vacationDaysUsed ?? 0} verbraucht</span>
          <span>{vacationLeft} verbleibend</span>
        </div>
        <div className="h-2.5 rounded-full bg-gray-200">
          <div
            className="h-2.5 rounded-full bg-[#4F772D] transition-all"
            style={{ width: `${Math.min(100, ((employee?.vacationDaysUsed ?? 0) / (employee?.vacationDaysTotal ?? 25)) * 100)}%` }}
          />
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Neuer Antrag</h2>
          <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Art der Abwesenheit</label>
              <select {...register("type")} className={inp}>
                {Object.entries(typeLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {watchType === "vacation" && vacationLeft <= 5 && (
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
                {watchType === "vacation" && previewDays > vacationLeft && (
                  <span className="ml-2 text-red-500 font-medium">— nicht genug Urlaubstage!</span>
                )}
              </p>
            )}

            {watchType === "sick" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Krankenzettel hochladen (optional, PDF)
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
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{typeLabels[leave.type]}</p>
                    {leave.sickNote && (
                      <a
                        href={downloadUrl(leave.sickNote)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[10px] text-[#4F772D] hover:underline"
                      >
                        <Download className="h-3 w-3" strokeWidth={1.5} />
                        Nachweis
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {format(parseISO(leave.startDate), "d. MMM", { locale: de })} –{" "}
                    {format(parseISO(leave.endDate), "d. MMM yyyy", { locale: de })}
                    {" · "}{leave.days} Werktage
                  </p>
                  {leave.reason && <p className="text-xs text-gray-400 italic">{leave.reason}</p>}
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

const inp = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none focus:ring-2 focus:ring-[#4F772D]/20";
