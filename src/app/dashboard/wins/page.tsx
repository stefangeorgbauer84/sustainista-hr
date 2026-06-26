"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { PERF_COLLECTIONS, currentWeekLabel } from "@/app/lib/collections";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Trophy, Plus, X, Sparkles, Tag, Zap } from "lucide-react";

interface Win {
  id: string;
  employee_id: string;
  week_label: string;
  content: string;
  impact: string | null;
  tags: string | null;
  created_at: string;
}

const IMPACT_OPTIONS = [
  { value: "Kunde", label: "Kunde begeistert", color: "bg-blue-100 text-blue-700" },
  { value: "Prozess", label: "Prozess verbessert", color: "bg-purple-100 text-purple-700" },
  { value: "Team", label: "Team unterstützt", color: "bg-green-100 text-green-700" },
  { value: "Lernen", label: "Neues gelernt", color: "bg-amber-100 text-amber-700" },
  { value: "Produkt", label: "Produkt weiterentwickelt", color: "bg-rose-100 text-rose-700" },
];

const TAG_SUGGESTIONS = ["Nachhaltigkeit", "Innovation", "Effizienz", "Kundenfokus", "Teamarbeit", "Lean"];

const inp = "w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-[#4F772D] focus:outline-none focus:ring-2 focus:ring-[#4F772D]/20";

export default function WinsPage() {
  const { employee, company } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState("");
  const [impact, setImpact] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const weekLabel = currentWeekLabel();

  const { data: wins = [], isLoading } = useQuery<Win[]>({
    queryKey: ["wins", employee?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(PERF_COLLECTIONS.WINS)
        .select("*")
        .eq("employee_id", employee!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!employee,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!content.trim()) throw new Error("Pflichtfeld");
      const { error } = await supabase.from(PERF_COLLECTIONS.WINS).insert({
        employee_id: employee!.id,
        company_id: company!.id,
        week_label: weekLabel,
        content: content.trim(),
        impact: impact || null,
        tags: tags.join(",") || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wins"] });
      toast.success("Win eingetragen!");
      setContent(""); setImpact(""); setTags([]); setShowForm(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleTag(t: string) {
    setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  // Group by week_label
  const grouped = wins.reduce<Record<string, Win[]>>((acc, w) => {
    if (!acc[w.week_label]) acc[w.week_label] = [];
    acc[w.week_label].push(w);
    return acc;
  }, {});

  const impactColor = (v: string) => IMPACT_OPTIONS.find(o => o.value === v)?.color ?? "bg-gray-100 text-gray-600";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Meine Wins</h1>
          <p className="mt-0.5 text-sm text-gray-500">Was hast du diese Woche erschaffen, gelöst oder verbessert?</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] transition"
        >
          {showForm ? <X className="h-4 w-4" strokeWidth={1.5} /> : <Plus className="h-4 w-4" strokeWidth={1.5} />}
          Win eintragen
        </button>
      </div>

      {/* Warum das wichtig ist */}
      <div className="rounded-xl bg-[#4F772D]/5 border border-[#4F772D]/10 px-5 py-4 flex gap-4">
        <Sparkles className="h-5 w-5 text-[#4F772D] flex-shrink-0 mt-0.5" strokeWidth={1.5} />
        <div>
          <p className="text-sm font-medium text-[#4F772D]">Warum Wins festhalten?</p>
          <p className="mt-1 text-xs text-gray-600 leading-relaxed">
            Fortschritt sichtbar machen motiviert — für dich und dein Team. Statt zu fragen "was hast du gemacht?" fragen wir:
            "was hast du <em>erschaffen</em>?" Kleine Wins summieren sich zu echtem Impact.
            Das ist Lean Thinking: jeden Tag ein bisschen besser.
          </p>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Neuer Win — {weekLabel}</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Was hast du erschaffen oder gelöst?</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={3}
                placeholder="z.B. Onboarding-Prozess für neue Kunden um 40% beschleunigt durch ein Checklist-Template…"
                className={`${inp} resize-none`}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Impact-Kategorie</label>
              <div className="flex flex-wrap gap-2">
                {IMPACT_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setImpact(impact === o.value ? "" : o.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      impact === o.value ? o.color + " ring-2 ring-offset-1 ring-current" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                <span className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" strokeWidth={1.5} /> Tags (optional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {TAG_SUGGESTIONS.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    className={`rounded-full px-3 py-1 text-xs transition ${
                      tags.includes(t) ? "bg-[#4F772D] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Abbrechen
              </button>
              <button
                onClick={() => addMutation.mutate()}
                disabled={!content.trim() || addMutation.isPending}
                className="rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60"
              >
                {addMutation.isPending ? "Speichert…" : "Win speichern"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Win-Liste */}
      {isLoading ? (
        <p className="text-center text-sm text-gray-400 py-8">Wird geladen…</p>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <Trophy className="mx-auto h-10 w-10 text-gray-300 mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-500">Noch keine Wins eingetragen</p>
          <p className="mt-1 text-xs text-gray-400">Starte jetzt und halte deinen ersten Erfolg fest.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([week, weekWins]) => (
            <div key={week} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-5 py-3">
                <Trophy className="h-4 w-4 text-[#4F772D]" strokeWidth={1.5} />
                <span className="text-xs font-semibold text-gray-700">{week}</span>
                <span className="ml-auto text-xs text-gray-400">{weekWins.length} {weekWins.length === 1 ? "Win" : "Wins"}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {weekWins.map(win => (
                  <div key={win.id} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#4F772D]/10">
                        <Zap className="h-3 w-3 text-[#4F772D]" strokeWidth={2} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900 leading-relaxed">{win.content}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {win.impact && (
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${impactColor(win.impact)}`}>
                              {IMPACT_OPTIONS.find(o => o.value === win.impact)?.label ?? win.impact}
                            </span>
                          )}
                          {win.tags && win.tags.split(",").filter(Boolean).map(tag => (
                            <span key={tag} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] text-gray-500">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <p className="mt-1.5 text-[11px] text-gray-400">
                          {format(parseISO(win.created_at), "EEE, d. MMM yyyy", { locale: de })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
