"use client";

import { useQuery } from "@tanstack/react-query";
import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { PERF_COLLECTIONS } from "@/app/lib/collections";
import { Query } from "appwrite";
import type { Employee, CheckIn } from "@/types";
import { HeartPulse, AlertTriangle, TrendingUp } from "lucide-react";

const ENERGY_EMOJIS = ["", "😔", "😐", "🙂", "😊", "🌟"];
const ENERGY_LABELS = ["", "Erschöpft", "Müde", "Okay", "Gut", "Sehr gut"];
const ENERGY_COLORS = ["", "bg-red-100 text-red-700", "bg-orange-100 text-orange-700", "bg-amber-100 text-amber-700", "bg-green-100 text-green-700", "bg-emerald-100 text-emerald-700"];

function weekLabel(weeksAgo: number) {
  const now = new Date();
  const d = new Date(now.getTime() - weeksAgo * 7 * 24 * 3600 * 1000);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

const WEEKS = Array.from({ length: 8 }, (_, i) => weekLabel(i)).reverse();

export default function TeamPulsePage() {
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["all-employees"],
    queryFn: async () => {
      const res = await databases.listDocuments(DB_ID, COLLECTIONS.EMPLOYEES, [
        Query.equal("status", "active"), Query.limit(100),
      ]);
      return res.documents as unknown as Employee[];
    },
  });

  const { data: checkins = [], isLoading } = useQuery<CheckIn[]>({
    queryKey: ["all-checkins"],
    queryFn: async () => {
      const res = await databases.listDocuments(DB_ID, PERF_COLLECTIONS.CHECK_INS, [
        Query.orderDesc("$createdAt"),
        Query.limit(500),
      ]);
      return res.documents as unknown as CheckIn[];
    },
  });

  const empMap = Object.fromEntries(employees.map(e => [e.$id, e]));

  const thisWeek = WEEKS[WEEKS.length - 1];
  const thisWeekCheckins = checkins.filter(c => c.weekLabel === thisWeek);
  const missing = employees.filter(e => !thisWeekCheckins.find(c => c.employeeId === e.$id));

  const avgByWeek = WEEKS.map(w => {
    const wc = checkins.filter(c => c.weekLabel === w);
    const avg = wc.length > 0 ? wc.reduce((s, c) => s + c.energyLevel, 0) / wc.length : null;
    return { week: w, avg, count: wc.length, blockers: wc.filter(c => c.blocker?.trim()).length };
  });

  const allBlockers = thisWeekCheckins.filter(c => c.blocker?.trim());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Team-Puls</h1>
        <p className="mt-0.5 text-sm text-gray-500">Aggregierter Check-in Verlauf — anonym auf Teamebene</p>
      </div>

      {/* Trend chart (simple bars) */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-5 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
          <h2 className="text-sm font-medium text-gray-900">Energie-Trend (8 Wochen)</h2>
        </div>
        <div className="flex items-end gap-2 h-32">
          {avgByWeek.map(({ week, avg, count }) => (
            <div key={week} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-gray-400">{avg ? avg.toFixed(1) : "—"}</span>
              <div className="w-full rounded-t-md bg-[#4F772D]/10 flex items-end justify-center" style={{ height: "80px" }}>
                {avg !== null && (
                  <div
                    className="w-full rounded-t-md bg-[#4F772D] transition-all"
                    style={{ height: `${(avg / 5) * 80}px` }}
                  />
                )}
              </div>
              <div className="text-[9px] text-gray-400 text-center">{week.split("-W")[1]}</div>
              <div className="text-[9px] text-gray-400">{count}✓</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-between text-[10px] text-gray-400">
          <span>vor 8 Wochen</span><span>KW {thisWeek.split("-W")[1]}</span>
        </div>
      </div>

      {/* Diese Woche */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Diese Woche — {thisWeek}</h2>
          {isLoading ? <p className="text-sm text-gray-400">Wird geladen…</p> :
            thisWeekCheckins.length === 0 ? (
              <p className="text-sm text-gray-400">Noch keine Check-ins</p>
            ) : (
              <div className="space-y-2">
                {thisWeekCheckins.map(ci => {
                  const emp = empMap[ci.employeeId];
                  return (
                    <div key={ci.$id} className="flex items-start gap-3 rounded-lg bg-gray-50 px-3 py-2.5">
                      <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm ${ENERGY_COLORS[ci.energyLevel]}`}>
                        {ENERGY_EMOJIS[ci.energyLevel]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-gray-700 truncate">
                            {emp ? `${emp.firstName} ${emp.lastName}` : "Unbekannt"}
                          </p>
                          <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] ${ENERGY_COLORS[ci.energyLevel]}`}>
                            {ENERGY_LABELS[ci.energyLevel]}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{ci.priority}</p>
                        {ci.blocker && (
                          <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="h-3 w-3 flex-shrink-0" strokeWidth={1.5} />
                            {ci.blocker}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>

        <div className="space-y-4">
          {/* Noch nicht eingecheckt */}
          {missing.length > 0 && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
              <h2 className="mb-3 text-sm font-semibold text-gray-700">Noch kein Check-in ({missing.length})</h2>
              <div className="space-y-1.5">
                {missing.map(e => (
                  <div key={e.$id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 border border-gray-100">
                    <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-500">
                      {e.firstName[0]}{e.lastName[0]}
                    </div>
                    <span className="text-xs text-gray-600">{e.firstName} {e.lastName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Blockers */}
          {allBlockers.length > 0 && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-5">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" strokeWidth={1.5} />
                <h2 className="text-sm font-semibold text-amber-800">Offene Blockers</h2>
              </div>
              <div className="space-y-2">
                {allBlockers.map(ci => {
                  const emp = empMap[ci.employeeId];
                  return (
                    <div key={ci.$id} className="rounded-lg bg-white px-3 py-2 border border-amber-100">
                      <p className="text-xs font-medium text-gray-700">{emp ? `${emp.firstName} ${emp.lastName}` : "—"}</p>
                      <p className="text-xs text-amber-700 mt-0.5">{ci.blocker}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
