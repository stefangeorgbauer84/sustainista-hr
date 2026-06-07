"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { databases, DB_ID } from "@/lib/appwrite";
import { PERF_COLLECTIONS, currentWeekLabel } from "@/app/lib/collections";
import { Query, ID } from "appwrite";
import type { CheckIn } from "@/types";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { HeartPulse, CheckCircle, TrendingUp } from "lucide-react";

const ENERGY_LABELS = ["", "Erschöpft", "Müde", "Okay", "Gut", "Sehr gut"];
const ENERGY_COLORS = ["", "bg-red-100 text-red-600", "bg-orange-100 text-orange-600", "bg-amber-100 text-amber-600", "bg-green-100 text-green-600", "bg-emerald-100 text-emerald-700"];
const ENERGY_EMOJIS = ["", "😔", "😐", "🙂", "😊", "🌟"];

const inp = "w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-[#4F772D] focus:outline-none focus:ring-2 focus:ring-[#4F772D]/20";

export default function CheckInPage() {
  const { employee } = useAuth();
  const qc = useQueryClient();
  const weekLabel = currentWeekLabel();
  const [energy, setEnergy] = useState(0);
  const [priority, setPriority] = useState("");
  const [blocker, setBlocker] = useState("");
  const [satisfaction, setSatisfaction] = useState(0);
  const [done, setDone] = useState(false);

  const { data: history = [] } = useQuery<CheckIn[]>({
    queryKey: ["checkins", employee?.$id],
    queryFn: async () => {
      const res = await databases.listDocuments(DB_ID, PERF_COLLECTIONS.CHECK_INS, [
        Query.equal("employeeId", employee!.$id),
        Query.orderDesc("$createdAt"),
        Query.limit(20),
      ]);
      return res.documents as unknown as CheckIn[];
    },
    enabled: !!employee,
  });

  const thisWeek = history.find(c => c.weekLabel === weekLabel);

  useEffect(() => {
    if (thisWeek) {
      setEnergy(thisWeek.energyLevel);
      setPriority(thisWeek.priority);
      setBlocker(thisWeek.blocker ?? "");
      setSatisfaction(thisWeek.satisfaction ?? 0);
      setDone(true);
    }
  }, [thisWeek]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (energy === 0 || !priority.trim()) throw new Error("Energie und Priorität erforderlich");
      if (thisWeek) {
        return databases.updateDocument(DB_ID, PERF_COLLECTIONS.CHECK_INS, thisWeek.$id, {
          energyLevel: energy,
          priority: priority.trim(),
          blocker: blocker.trim() || null,
          satisfaction: satisfaction || null,
        });
      }
      return databases.createDocument(DB_ID, PERF_COLLECTIONS.CHECK_INS, ID.unique(), {
        employeeId: employee!.$id,
        weekLabel,
        energyLevel: energy,
        priority: priority.trim(),
        blocker: blocker.trim() || null,
        satisfaction: satisfaction || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checkins"] });
      qc.invalidateQueries({ queryKey: ["team-pulse"] });
      toast.success("Check-in gespeichert!");
      setDone(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Wöchentlicher Check-in</h1>
        <p className="mt-0.5 text-sm text-gray-500">3 Fragen, 60 Sekunden — wie geht es dir diese Woche?</p>
      </div>

      {/* This week form */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Woche {weekLabel}</h2>
          {done && thisWeek && (
            <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
              <CheckCircle className="h-4 w-4" strokeWidth={1.5} />
              Ausgefüllt
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Energie */}
          <div>
            <label className="mb-3 block text-sm font-medium text-gray-700">Wie ist dein Energie-Level diese Woche?</label>
            <div className="flex gap-2">
              {[1,2,3,4,5].map(n => (
                <button
                  key={n}
                  onClick={() => setEnergy(n)}
                  className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl border-2 py-3 transition ${
                    energy === n ? "border-[#4F772D] bg-[#4F772D]/5" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="text-xl">{ENERGY_EMOJIS[n]}</span>
                  <span className="text-[10px] font-medium text-gray-500">{ENERGY_LABELS[n]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Top Priority */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Was ist deine wichtigste Priorität diese Woche?
            </label>
            <textarea
              value={priority}
              onChange={e => setPriority(e.target.value)}
              rows={2}
              placeholder="z.B. Angebot für Kunde X finalisieren…"
              className={`${inp} resize-none`}
            />
          </div>

          {/* Blocker */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Gibt es etwas, das dich blockiert? (optional)
            </label>
            <input
              value={blocker}
              onChange={e => setBlocker(e.target.value)}
              placeholder="z.B. Warte auf Feedback von…"
              className={inp}
            />
          </div>

          {/* Satisfaction */}
          <div>
            <label className="mb-3 block text-sm font-medium text-gray-700">
              Wie zufrieden bist du gerade mit deiner Arbeit? (optional)
            </label>
            <div className="flex gap-2">
              {[1,2,3,4,5].map(n => (
                <button
                  key={n}
                  onClick={() => setSatisfaction(satisfaction === n ? 0 : n)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition ${
                    satisfaction === n
                      ? "border-[#4F772D] bg-[#4F772D] text-white"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-gray-400">Nicht zufrieden</span>
              <span className="text-[10px] text-gray-400">Sehr zufrieden</span>
            </div>
          </div>

          <button
            onClick={() => saveMutation.mutate()}
            disabled={energy === 0 || !priority.trim() || saveMutation.isPending}
            className="w-full rounded-lg bg-[#4F772D] py-2.5 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60"
          >
            {saveMutation.isPending ? "Speichert…" : thisWeek ? "Aktualisieren" : "Check-in absenden"}
          </button>
        </div>
      </div>

      {/* History */}
      {history.filter(c => c.weekLabel !== weekLabel).length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
            <TrendingUp className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
            <h2 className="text-sm font-medium text-gray-900">Verlauf</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {history.filter(c => c.weekLabel !== weekLabel).slice(0, 8).map(ci => (
              <div key={ci.$id} className="flex items-center gap-4 px-5 py-3">
                <div className="w-20 flex-shrink-0">
                  <span className="text-xs font-mono text-gray-400">{ci.weekLabel}</span>
                </div>
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${ENERGY_COLORS[ci.energyLevel]}`}>
                  {ENERGY_EMOJIS[ci.energyLevel]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{ci.priority}</p>
                  {ci.blocker && (
                    <p className="text-xs text-amber-600 truncate">Blocker: {ci.blocker}</p>
                  )}
                </div>
                {ci.satisfaction && (
                  <span className="flex-shrink-0 rounded-full bg-[#4F772D]/10 px-2 py-0.5 text-xs font-medium text-[#4F772D]">
                    {ci.satisfaction}/5
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
