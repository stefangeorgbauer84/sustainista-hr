"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { PERF_COLLECTIONS, currentPeriod } from "@/app/lib/collections";
import { Query, ID } from "appwrite";
import type { Employee, PerformanceReview } from "@/types";
import { toast } from "sonner";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { ClipboardList, Star, ChevronDown, ChevronUp, CheckCircle } from "lucide-react";

const SCORE_LABELS = ["", "Unter Erwartung", "Entwicklungsbedarf", "Erfüllt Erwartungen", "Übertrifft Erwartungen", "Exzellent"];

function ScorePicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1.5">
      {[1,2,3,4,5].map(n => (
        <button
          key={n}
          onClick={() => onChange(n)}
          title={SCORE_LABELS[n]}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
            value >= n ? "bg-[#4F772D] text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
          }`}
        >
          <Star className="h-3.5 w-3.5" strokeWidth={value >= n ? 2 : 1.5} fill={value >= n ? "white" : "none"} />
        </button>
      ))}
      {value > 0 && <span className="self-center text-xs text-gray-500 ml-1">{SCORE_LABELS[value]}</span>}
    </div>
  );
}

const inp = "w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-[#4F772D] focus:outline-none focus:ring-2 focus:ring-[#4F772D]/20 resize-none";

export default function PerformancePage() {
  const qc = useQueryClient();
  const period = currentPeriod();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [managerText, setManagerText] = useState<Record<string, string>>({});
  const [managerScore, setManagerScore] = useState<Record<string, number>>({});
  const [strengths, setStrengths] = useState<Record<string, string>>({});
  const [growthAreas, setGrowthAreas] = useState<Record<string, string>>({});

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["all-employees"],
    queryFn: async () => {
      const res = await databases.listDocuments(DB_ID, COLLECTIONS.EMPLOYEES, [
        Query.equal("status", "active"), Query.limit(100),
      ]);
      return res.documents as unknown as Employee[];
    },
  });

  const { data: reviews = [] } = useQuery<PerformanceReview[]>({
    queryKey: ["reviews", period],
    queryFn: async () => {
      const res = await databases.listDocuments(DB_ID, PERF_COLLECTIONS.REVIEWS, [
        Query.equal("period", period), Query.limit(100),
      ]);
      return res.documents as unknown as PerformanceReview[];
    },
  });

  function getReview(empId: string) {
    return reviews.find(r => r.employeeId === empId);
  }

  const initiateMutation = useMutation({
    mutationFn: async (empId: string) => {
      return databases.createDocument(DB_ID, PERF_COLLECTIONS.REVIEWS, ID.unique(), {
        employeeId: empId,
        period,
        status: "self-pending",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews"] });
      toast.success("Performance Review gestartet — Mitarbeiter kann jetzt seine Selbsteinschätzung einreichen");
    },
    onError: () => toast.error("Fehler beim Starten"),
  });

  const completeMutation = useMutation({
    mutationFn: async (review: PerformanceReview) => {
      return databases.updateDocument(DB_ID, PERF_COLLECTIONS.REVIEWS, review.$id, {
        managerAssessment: managerText[review.$id] ?? "",
        managerScore: managerScore[review.$id] ?? 0,
        strengths: strengths[review.$id] ?? "",
        growthAreas: growthAreas[review.$id] ?? "",
        status: "complete",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews"] });
      toast.success("Beurteilung abgeschlossen");
      setExpandedId(null);
    },
    onError: () => toast.error("Fehler beim Speichern"),
  });

  function openReview(review: PerformanceReview) {
    setExpandedId(expandedId === review.$id ? null : review.$id);
    if (!managerText[review.$id] && review.managerAssessment) setManagerText(p => ({ ...p, [review.$id]: review.managerAssessment ?? "" }));
    if (!managerScore[review.$id] && review.managerScore) setManagerScore(p => ({ ...p, [review.$id]: review.managerScore ?? 0 }));
    if (!strengths[review.$id] && review.strengths) setStrengths(p => ({ ...p, [review.$id]: review.strengths ?? "" }));
    if (!growthAreas[review.$id] && review.growthAreas) setGrowthAreas(p => ({ ...p, [review.$id]: review.growthAreas ?? "" }));
  }

  const complete = reviews.filter(r => r.status === "complete").length;
  const selfPending = reviews.filter(r => r.status === "self-pending").length;
  const managerPending = reviews.filter(r => r.status === "manager-pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Performance Reviews</h1>
        <p className="mt-0.5 text-sm text-gray-500">Periode: {period} · Halbjährliche Beurteilungen</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-[#4F772D]">{complete}</p>
          <p className="text-xs text-gray-500">Abgeschlossen</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{selfPending + managerPending}</p>
          <p className="text-xs text-gray-500">In Bearbeitung</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-gray-400">{employees.length - reviews.length}</p>
          <p className="text-xs text-gray-500">Noch nicht gestartet</p>
        </div>
      </div>

      {/* Employee list */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
          <h2 className="text-sm font-medium text-gray-900">Alle Mitarbeiter — {period}</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {employees.map(emp => {
            const review = getReview(emp.$id);
            const isExpanded = expandedId === review?.$id;
            return (
              <div key={emp.$id}>
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#4F772D]/10 text-sm font-semibold text-[#4F772D]">
                      {emp.firstName[0]}{emp.lastName[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{emp.firstName} {emp.lastName}</p>
                      <p className="text-xs text-gray-400">{emp.position} · {emp.department}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!review ? (
                      <span className="text-xs text-gray-400">Nicht gestartet</span>
                    ) : (
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        review.status === "complete" ? "bg-green-100 text-green-700" :
                        review.status === "manager-pending" ? "bg-blue-100 text-blue-700" :
                        "bg-amber-100 text-amber-700"
                      }`}>
                        {review.status === "complete" ? "Abgeschlossen" :
                         review.status === "manager-pending" ? "Deine Beurteilung offen" :
                         "Mitarbeiter ausstehend"}
                      </span>
                    )}
                    {review?.selfScore && (
                      <div className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 text-amber-400" fill="currentColor" strokeWidth={0} />
                        <span className="text-xs text-gray-500">{review.selfScore}/5 (Selbst)</span>
                      </div>
                    )}
                    {!review ? (
                      <button
                        onClick={() => initiateMutation.mutate(emp.$id)}
                        disabled={initiateMutation.isPending}
                        className="rounded-lg border border-[#4F772D] px-3 py-1.5 text-xs text-[#4F772D] hover:bg-[#4F772D]/5 transition"
                      >
                        Review starten
                      </button>
                    ) : review.status === "manager-pending" ? (
                      <button onClick={() => openReview(review)} className="flex items-center gap-1 rounded-lg bg-[#4F772D] px-3 py-1.5 text-xs text-white hover:bg-[#31572C]">
                        Beurteilung ausfüllen
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.5} /> : <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} />}
                      </button>
                    ) : review.status === "complete" ? (
                      <button onClick={() => openReview(review)} className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50">
                        Ansehen
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.5} /> : <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} />}
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Expanded review */}
                {review && isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-5 space-y-5">
                    {/* Self assessment */}
                    {review.selfAssessment && (
                      <div className="rounded-xl bg-white border border-gray-200 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-semibold text-gray-700">Selbsteinschätzung des Mitarbeiters</p>
                          {review.selfScore && (
                            <div className="flex items-center gap-1">
                              {[1,2,3,4,5].map(n => (
                                <Star key={n} className={`h-3.5 w-3.5 ${n <= review.selfScore! ? "text-amber-400" : "text-gray-200"}`}
                                  fill={n <= review.selfScore! ? "currentColor" : "none"} strokeWidth={1} />
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{review.selfAssessment}</p>
                      </div>
                    )}

                    {review.status === "complete" ? (
                      /* Read-only manager view */
                      <div className="rounded-xl bg-white border border-[#4F772D]/20 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-semibold text-[#4F772D]">Meine Beurteilung</p>
                          {review.managerScore && (
                            <div className="flex items-center gap-1">
                              {[1,2,3,4,5].map(n => (
                                <Star key={n} className={`h-3.5 w-3.5 ${n <= review.managerScore! ? "text-[#4F772D]" : "text-gray-200"}`}
                                  fill={n <= review.managerScore! ? "currentColor" : "none"} strokeWidth={1} />
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{review.managerAssessment}</p>
                        {review.strengths && <div className="mt-3"><p className="text-xs font-medium text-green-700 mb-1">Stärken</p><p className="text-xs text-gray-600">{review.strengths}</p></div>}
                        {review.growthAreas && <div className="mt-2"><p className="text-xs font-medium text-blue-700 mb-1">Entwicklungsfelder</p><p className="text-xs text-gray-600">{review.growthAreas}</p></div>}
                      </div>
                    ) : (
                      /* Editable manager review */
                      <div className="rounded-xl bg-white border border-gray-200 p-4 space-y-4">
                        <p className="text-xs font-semibold text-gray-700">Deine Manager-Beurteilung</p>
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-gray-700">Gesamtbewertung</label>
                          <ScorePicker value={managerScore[review.$id] ?? 0} onChange={n => setManagerScore(p => ({ ...p, [review.$id]: n }))} />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-gray-700">Beurteilung (narrativ)</label>
                          <textarea rows={4} className={inp}
                            placeholder="Wie hat sich die Person in dieser Periode entwickelt? Was lief besonders gut?"
                            value={managerText[review.$id] ?? ""}
                            onChange={e => setManagerText(p => ({ ...p, [review.$id]: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-gray-700">Stärken</label>
                            <textarea rows={3} className={inp} placeholder="Was sind die besonderen Stärken?"
                              value={strengths[review.$id] ?? ""}
                              onChange={e => setStrengths(p => ({ ...p, [review.$id]: e.target.value }))} />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-gray-700">Entwicklungsfelder</label>
                            <textarea rows={3} className={inp} placeholder="Wo gibt es Wachstumspotenzial?"
                              value={growthAreas[review.$id] ?? ""}
                              onChange={e => setGrowthAreas(p => ({ ...p, [review.$id]: e.target.value }))} />
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <button
                            onClick={() => completeMutation.mutate(review)}
                            disabled={!managerText[review.$id]?.trim() || !managerScore[review.$id] || completeMutation.isPending}
                            className="flex items-center gap-2 rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60"
                          >
                            <CheckCircle className="h-4 w-4" strokeWidth={1.5} />
                            {completeMutation.isPending ? "Speichert…" : "Beurteilung abschließen"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
