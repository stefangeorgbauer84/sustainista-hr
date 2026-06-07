"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { databases, DB_ID } from "@/lib/appwrite";
import { PERF_COLLECTIONS, currentQuarter } from "@/app/lib/collections";
import { Query, ID } from "appwrite";
import type { OKR } from "@/types";
import { toast } from "sonner";
import { Target, Plus, X, ChevronUp, ChevronDown, Edit2 } from "lucide-react";

const STATUS_OPTS = [
  { value: "on-track", label: "Im Plan", color: "bg-green-100 text-green-700" },
  { value: "at-risk", label: "Gefährdet", color: "bg-amber-100 text-amber-700" },
  { value: "done", label: "Erreicht", color: "bg-[#4F772D]/10 text-[#4F772D]" },
];

const QUARTERS = Array.from({ length: 4 }, (_, i) => {
  const q = i + 1;
  return `${new Date().getFullYear()}-Q${q}`;
});

const inp = "w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-[#4F772D] focus:outline-none focus:ring-2 focus:ring-[#4F772D]/20";

export default function OKRsPage() {
  const { employee } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [objective, setObjective] = useState("");
  const [keyResults, setKeyResults] = useState("");
  const [quarter, setQuarter] = useState(currentQuarter());
  const [selectedQ, setSelectedQ] = useState(currentQuarter());

  const { data: okrs = [], isLoading } = useQuery<OKR[]>({
    queryKey: ["okrs", employee?.$id],
    queryFn: async () => {
      const res = await databases.listDocuments(DB_ID, PERF_COLLECTIONS.OKRS, [
        Query.equal("employeeId", employee!.$id),
        Query.orderDesc("$createdAt"),
        Query.limit(50),
      ]);
      return res.documents as unknown as OKR[];
    },
    enabled: !!employee,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!objective.trim() || !keyResults.trim()) throw new Error("Objective und Key Results erforderlich");
      const data = {
        employeeId: employee!.$id,
        quarter,
        objective: objective.trim(),
        keyResults: keyResults.trim(),
        progress: 0,
        status: "on-track",
      };
      if (editingId) return databases.updateDocument(DB_ID, PERF_COLLECTIONS.OKRS, editingId, { objective: data.objective, keyResults: data.keyResults, quarter });
      return databases.createDocument(DB_ID, PERF_COLLECTIONS.OKRS, ID.unique(), data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["okrs"] });
      toast.success(editingId ? "OKR aktualisiert" : "OKR angelegt");
      setObjective(""); setKeyResults(""); setShowForm(false); setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateProgressMutation = useMutation({
    mutationFn: ({ id, progress, status }: { id: string; progress: number; status?: string }) =>
      databases.updateDocument(DB_ID, PERF_COLLECTIONS.OKRS, id, { progress, ...(status ? { status } : {}) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["okrs"] }),
  });

  function openEdit(okr: OKR) {
    setEditingId(okr.$id);
    setObjective(okr.objective);
    setKeyResults(okr.keyResults);
    setQuarter(okr.quarter);
    setShowForm(true);
  }

  const filtered = okrs.filter(o => o.quarter === selectedQ);
  const statusColor = (s?: string) => STATUS_OPTS.find(o => o.value === s)?.color ?? "bg-gray-100 text-gray-500";
  const statusLabel = (s?: string) => STATUS_OPTS.find(o => o.value === s)?.label ?? "Offen";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Meine OKRs</h1>
          <p className="mt-0.5 text-sm text-gray-500">Objectives & Key Results — Ziele, die Richtung geben</p>
        </div>
        <button
          onClick={() => { setEditingId(null); setObjective(""); setKeyResults(""); setQuarter(currentQuarter()); setShowForm(!showForm); }}
          className="flex items-center gap-2 rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] transition"
        >
          {showForm ? <X className="h-4 w-4" strokeWidth={1.5} /> : <Plus className="h-4 w-4" strokeWidth={1.5} />}
          Neues OKR
        </button>
      </div>

      <div className="rounded-xl bg-blue-50 border border-blue-100 px-5 py-4">
        <p className="text-xs font-semibold text-blue-700 mb-1">Was ist ein OKR?</p>
        <p className="text-xs text-blue-600 leading-relaxed">
          <strong>Objective</strong> = das inspirierende Ziel (qualitativ, motivierend).<br />
          <strong>Key Results</strong> = wie du weißt, dass du es erreicht hast (messbar, 2–4 Punkte).<br />
          Gut formuliert: "Wir wollen X, gemessen an Y." Quartalsweise. Ehrlich über Fortschritt.
        </p>
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">{editingId ? "OKR bearbeiten" : "Neues OKR"}</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Quartal</label>
              <select value={quarter} onChange={e => setQuarter(e.target.value)} className={inp}>
                {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Objective — das Ziel</label>
              <input
                value={objective}
                onChange={e => setObjective(e.target.value)}
                className={inp}
                placeholder="z.B. Unsere Kunden lieben den Onboarding-Prozess"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Key Results — wie du Erfolg misst</label>
              <textarea
                value={keyResults}
                onChange={e => setKeyResults(e.target.value)}
                rows={4}
                placeholder={"KR1: Onboarding-Zeit von 5 Tagen auf 2 Tage reduzieren\nKR2: NPS-Score der Kunden nach Onboarding ≥ 8\nKR3: 3 neue Onboarding-Templates erstellt"}
                className={`${inp} resize-none font-mono text-xs leading-relaxed`}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Abbrechen</button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={!objective.trim() || !keyResults.trim() || saveMutation.isPending}
                className="rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60"
              >
                {saveMutation.isPending ? "Speichert…" : "Speichern"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quarter tabs */}
      <div className="flex gap-1">
        {QUARTERS.map(q => (
          <button
            key={q}
            onClick={() => setSelectedQ(q)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              selectedQ === q ? "bg-[#4F772D] text-white" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
          >
            {q}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-center text-sm text-gray-400 py-8">Wird geladen…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center">
          <Target className="mx-auto h-10 w-10 text-gray-300 mb-3" strokeWidth={1.5} />
          <p className="text-sm text-gray-500">Keine OKRs für {selectedQ}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(okr => (
            <div key={okr.$id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{okr.objective}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor(okr.status)}`}>
                        {statusLabel(okr.status)}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {okr.keyResults.split("\n").filter(Boolean).map((kr, i) => (
                        <p key={i} className="text-xs text-gray-500 flex gap-2">
                          <span className="text-[#4F772D] font-medium flex-shrink-0">KR{i + 1}</span>
                          {kr.replace(/^KR\d+:?\s*/i, "")}
                        </p>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => openEdit(okr)} className="flex-shrink-0 rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                    <Edit2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </div>

                {/* Progress */}
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-gray-500">
                    <span>Fortschritt</span>
                    <span className="font-medium">{okr.progress ?? 0}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-[#4F772D] transition-all"
                      style={{ width: `${okr.progress ?? 0}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => updateProgressMutation.mutate({ id: okr.$id, progress: Math.max(0, (okr.progress ?? 0) - 10) })}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100"
                    >
                      <ChevronDown className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                    <input
                      type="range" min={0} max={100} step={5}
                      value={okr.progress ?? 0}
                      onChange={e => updateProgressMutation.mutate({ id: okr.$id, progress: parseInt(e.target.value) })}
                      className="flex-1 accent-[#4F772D]"
                    />
                    <button
                      onClick={() => updateProgressMutation.mutate({ id: okr.$id, progress: Math.min(100, (okr.progress ?? 0) + 10) })}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100"
                    >
                      <ChevronUp className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                    <div className="flex gap-1 ml-2">
                      {STATUS_OPTS.map(s => (
                        <button
                          key={s.value}
                          onClick={() => updateProgressMutation.mutate({ id: okr.$id, progress: okr.progress ?? 0, status: s.value })}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
                            okr.status === s.value ? s.color : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
