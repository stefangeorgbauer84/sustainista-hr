"use client";

import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { TimeRecord } from "@/types";
import { calcWorkedMinutes, formatDuration } from "@/lib/time";
import { isHoliday } from "@/lib/holidays";
import { format, getDaysInMonth, isWeekend } from "date-fns";
import { de } from "date-fns/locale";
import { TrendingUp, TrendingDown, Clock, Minus } from "lucide-react";

interface MonthSummary {
  year: number;
  month: number;
  label: string;
  actual: number;
  target: number;
  diff: number;
}

function getTargetMinutes(year: number, month: number): number {
  let workdays = 0;
  const days = getDaysInMonth(new Date(year, month - 1));
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month - 1, d);
    const iso = format(date, "yyyy-MM-dd");
    if (!isWeekend(date) && !isHoliday(iso)) workdays++;
  }
  return workdays * 8 * 60;
}

export default function ZeitkontoPage() {
  const { employee } = useAuth();
  const now = new Date();

  const months: { year: number; month: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  const sixMonthsAgo = format(new Date(now.getFullYear(), now.getMonth() - 5, 1), "yyyy-MM-dd");

  const { data: allRecords = [], isLoading } = useQuery<TimeRecord[]>({
    queryKey: ["zeitkonto", employee?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_records")
        .select("*")
        .eq("employee_id", employee!.id)
        .gte("work_date", sixMonthsAgo)
        .not("end_time", "is", null)
        .limit(500);
      if (error) throw error;
      return (data ?? []) as TimeRecord[];
    },
    enabled: !!employee,
  });

  const summaries: MonthSummary[] = months.map(({ year, month }) => {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    const entries = allRecords.filter(e => e.work_date.startsWith(prefix));
    const actual = entries.reduce((s, e) => s + calcWorkedMinutes(e), 0);
    const target = getTargetMinutes(year, month);
    return {
      year, month,
      label: format(new Date(year, month - 1), "MMM yyyy", { locale: de }),
      actual, target, diff: actual - target,
    };
  });

  const totalDiff = summaries.reduce((s, m) => s + m.diff, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Zeitkonto</h1>
        <p className="mt-0.5 text-sm text-gray-500">Überstunden-Saldo der letzten 6 Monate</p>
      </div>

      <div className={`rounded-2xl border p-6 ${totalDiff > 0 ? "border-[#4F772D]/30 bg-[#4F772D]/5" : totalDiff < -60 * 60 ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Gesamtsaldo (6 Monate)</p>
            <p className={`mt-1 text-4xl font-bold ${totalDiff > 0 ? "text-[#4F772D]" : totalDiff < 0 ? "text-red-500" : "text-gray-900"}`}>
              {totalDiff >= 0 ? "+" : ""}{formatDuration(Math.abs(totalDiff))}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {totalDiff > 0 ? "Überstunden angesammelt" : totalDiff < 0 ? "Minusstunden" : "Genau im Soll"}
            </p>
          </div>
          <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${totalDiff > 0 ? "bg-[#4F772D]/20" : totalDiff < 0 ? "bg-red-100" : "bg-gray-100"}`}>
            {totalDiff > 0 ? <TrendingUp className="h-8 w-8 text-[#4F772D]" strokeWidth={1.5} /> :
             totalDiff < 0 ? <TrendingDown className="h-8 w-8 text-red-500" strokeWidth={1.5} /> :
             <Minus className="h-8 w-8 text-gray-400" strokeWidth={1.5} />}
          </div>
        </div>
        {totalDiff > 2 * 8 * 60 && (
          <div className="mt-4 rounded-lg border border-[#4F772D]/20 bg-white/60 px-4 py-3">
            <p className="text-xs text-[#4F772D] font-medium">
              Tipp: {formatDuration(totalDiff)} Überstunden = {Math.floor(totalDiff / (8 * 60))} Tage Zeitausgleich.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
          <h2 className="text-sm font-medium text-gray-900">Monatsübersicht</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {isLoading ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">Wird geladen…</p>
          ) : summaries.map(m => {
            const isCurrentMonth = m.year === now.getFullYear() && m.month === now.getMonth() + 1;
            const targetH = (m.target / 60).toFixed(0);
            const actualH = (m.actual / 60).toFixed(1);
            const pct = m.target > 0 ? Math.min(120, Math.round((m.actual / m.target) * 100)) : 0;
            return (
              <div key={`${m.year}-${m.month}`} className={`px-5 py-4 ${isCurrentMonth ? "bg-[#4F772D]/5" : ""}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{m.label}</p>
                    {isCurrentMonth && (
                      <span className="rounded-full bg-[#4F772D]/10 px-2 py-0.5 text-[10px] font-medium text-[#4F772D]">Laufend</span>
                    )}
                  </div>
                  <span className={`text-sm font-semibold ${m.diff > 0 ? "text-[#4F772D]" : m.diff < -60 * 60 ? "text-red-500" : "text-gray-600"}`}>
                    {m.diff >= 0 ? "+" : ""}{formatDuration(Math.abs(m.diff))}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                    <div className={`h-2 rounded-full transition-all ${pct > 100 ? "bg-amber-400" : pct < 80 ? "bg-red-300" : "bg-[#4F772D]"}`}
                      style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{actualH}h / {targetH}h Soll</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">
        <p className="text-xs font-medium text-blue-800 mb-1">Österreichisches Arbeitszeitrecht</p>
        <ul className="space-y-1 text-xs text-blue-700">
          <li>Überstunden sind innerhalb von 3 Monaten als Zeitausgleich zu nehmen oder auszuzahlen (§ 10 AZG)</li>
          <li>Zuschlag: 50% (Geld) oder 1:1,5 (Zeit) — je nach Vereinbarung</li>
          <li>Gleitzeit: Übertrag maximal 40h in die nächste Periode (§ 4b AZG)</li>
        </ul>
      </div>
    </div>
  );
}
