"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { databases, DB_ID } from "@/lib/appwrite";
import { PERF_COLLECTIONS, currentPeriod } from "@/app/lib/collections";
import { Query } from "appwrite";
import type { PerformanceReview } from "@/types";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { ClipboardList, Star, CheckCircle, Clock } from "lucide-react";

const SCORE_LABELS = ["", "Unter Erwartungen", "Entwicklungsbedarf", "Erfüllt Erwartungen", "Übertrifft Erwartungen", "Exzellent"];

const PROMPTS = [
  "Was waren deine größten Erfolge in dieser Periode?",
  "Wo hast du dich am stärksten weiterentwickelt?",
  "Was würdest du anders machen, wenn du zurückblicken könntest?",
  "Wie hast du zum Teamerfolg beigetragen?",
  "Was sind deine Ziele für die nächste Periode?",
];

const inp = "w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-[#4F772D] focus:outline-none focus:ring-2 focus:ring-[#4F772D]/20 resize-none";

export default function ReviewPage() {
  const { employee } = useAuth();
  const qc = useQueryClient();
  const period = currentPeriod();
  const [selfText, setSelfText] = useState("");
  const [score, setScore] = useState(0);

  const { data: reviews = [] } = useQuery<PerformanceReview[]>({
    queryKey: ["my-reviews", employee?.$id],
    queryFn: async () => {
      const res = await databases.listDocuments(DB_ID, PERF_COLLECTIONS.REVIEWS, [
        Query.equal("employeeId", employee!.$id),
        Query.orderDesc("$createdAt"),
        Query.limit(10),
      ]);
      return res.documents as unknown as PerformanceReview[];
    },
    enabled: !!employee,
  });

  const currentReview = reviews.find(r => r.period === period);

  useEffect(() => {
    if (currentReview?.selfAssessment) setSelfText(currentReview.selfAssessment);
    if (currentReview?.selfScore) setScore(currentReview.selfScore);
  }, [currentReview]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!currentReview) throw new Error("Kein Review offen");
      if (!selfText.trim() || score === 0) throw new Error("Bitte Einschätzung und Bewertung ausfüllen");
      return databases.updateDocument(DB_ID, PERF_COLLECTIONS.REVIEWS, currentReview.$id, {
        selfAssessment: selfText.trim(),
        selfScore: score,
        status: "manager-pending",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-reviews"] });
      toast.success("Selbsteinschätzung eingereicht!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Performance Review</h1>
        <p className="mt-0.5 text-sm text-gray-500">Deine Selbsteinschätzung — {period}</p>
      </div>

      {!currentReview ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <Clock className="mx-auto h-10 w-10 text-gray-300 mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-700">Kein Review für {period} gestartet</p>
          <p className="mt-1 text-xs text-gray-400">Deine Führungskraft startet den Review-Prozess. Du wirst dann benachrichtigt.</p>
        </div>
      ) : currentReview.status === "self-pending" ? (
        <div className="space-y-5">
          <div className="rounded-xl bg-[#4F772D]/5 border border-[#4F772D]/10 px-5 py-4">
            <p className="text-sm font-semibold text-[#4F772D] mb-2">Deine Selbstreflexion — {period}</p>
            <p className="text-xs text-gray-600 leading-relaxed">
              Nimm dir 15–20 Minuten. Sei ehrlich mit dir selbst — das Gespräch soll ein echter Dialog werden, kein Bericht.
              Starke Einschätzungen nennen konkrete Beispiele.
            </p>
          </div>

          {/* Reflection prompts */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Denkanstöße</p>
            <div className="space-y-2">
              {PROMPTS.map((p, i) => (
                <div key={i} className="flex gap-2.5 text-xs text-gray-500">
                  <span className="text-[#4F772D] font-semibold flex-shrink-0">{i + 1}.</span>
                  {p}
                </div>
              ))}
            </div>
          </div>

          {/* Self-assessment form */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Meine Selbsteinschätzung</label>
              <textarea
                rows={8}
                className={inp}
                placeholder="Schreibe frei. Was lief gut, was würdest du anders machen, wie hast du dich entwickelt?"
                value={selfText}
                onChange={e => setSelfText(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Wie bewertest du deine eigene Leistung?</label>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(n => (
                  <button
                    key={n}
                    onClick={() => setScore(n)}
                    title={SCORE_LABELS[n]}
                    className={`flex flex-1 flex-col items-center gap-1 rounded-xl border-2 py-3 transition ${
                      score >= n ? "border-[#4F772D] bg-[#4F772D]/5" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Star className={`h-5 w-5 ${score >= n ? "text-[#4F772D]" : "text-gray-300"}`} strokeWidth={1.5} fill={score >= n ? "currentColor" : "none"} />
                    <span className="text-[9px] text-center text-gray-500 leading-tight px-1">{SCORE_LABELS[n]}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => submitMutation.mutate()}
              disabled={!selfText.trim() || score === 0 || submitMutation.isPending}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#4F772D] py-2.5 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60"
            >
              <CheckCircle className="h-4 w-4" strokeWidth={1.5} />
              {submitMutation.isPending ? "Wird eingereicht…" : "Einschätzung einreichen"}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
          <div className="flex items-center gap-2 text-[#4F772D]">
            <CheckCircle className="h-5 w-5" strokeWidth={1.5} />
            <p className="text-sm font-medium">
              {currentReview.status === "manager-pending" ? "Selbsteinschätzung eingereicht — deine Führungskraft bearbeitet jetzt den Review" : "Review abgeschlossen"}
            </p>
          </div>

          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">Deine Selbsteinschätzung</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{currentReview.selfAssessment}</p>
          </div>

          {currentReview.status === "complete" && currentReview.managerAssessment && (
            <div className="rounded-lg bg-[#4F772D]/5 border border-[#4F772D]/10 p-4">
              <p className="text-xs font-semibold text-[#4F772D] mb-2">Beurteilung deiner Führungskraft</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{currentReview.managerAssessment}</p>
              {currentReview.strengths && <div className="mt-3"><p className="text-xs font-medium text-green-700">Stärken</p><p className="text-xs text-gray-600 mt-1">{currentReview.strengths}</p></div>}
              {currentReview.growthAreas && <div className="mt-2"><p className="text-xs font-medium text-blue-700">Entwicklungsfelder</p><p className="text-xs text-gray-600 mt-1">{currentReview.growthAreas}</p></div>}
            </div>
          )}
        </div>
      )}

      {/* History */}
      {reviews.filter(r => r.period !== period && r.status === "complete").length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
            <h2 className="text-sm font-medium text-gray-900">Frühere Reviews</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {reviews.filter(r => r.period !== period && r.status === "complete").map(r => (
              <div key={r.$id} className="flex items-center gap-4 px-5 py-3">
                <span className="text-xs font-mono text-gray-500">{r.period}</span>
                <div className="flex-1">
                  {r.managerScore && (
                    <div className="flex items-center gap-1">
                      {[1,2,3,4,5].map(n => (
                        <Star key={n} className={`h-3 w-3 ${n <= r.managerScore! ? "text-[#4F772D]" : "text-gray-200"}`} fill={n <= r.managerScore! ? "currentColor" : "none"} strokeWidth={1} />
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-400">{format(parseISO(r.$updatedAt), "MMM yyyy", { locale: de })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
