"use client";

import { useQuery } from "@tanstack/react-query";
import { getAllPendingAbsences } from "@/lib/leave";
import { supabase } from "@/lib/supabase";
import type { Employee, Absence } from "@/types";
import {
  Users, AlertCircle, Baby, AlertTriangle, TrendingUp,
  Calendar, Euro, ChevronRight,
} from "lucide-react";
import { format, parseISO, addDays, isAfter, isBefore, isValid } from "date-fns";
import { de } from "date-fns/locale";
import Link from "next/link";
import { useMemo } from "react";

type CF = {
  brutto?: string;
  status?: string;
  austritt_info?: string;
  naechste_gehaltsaenderung?: string;
};

function cf(emp: Employee): CF {
  return (emp.custom_fields ?? {}) as CF;
}

function parseDateFromText(text?: string): Date | null {
  if (!text) return null;
  const m = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isValid(d) ? d : null;
}

const REFETCH = 5 * 60 * 1000;

const TYPE_LABELS: Record<string, string> = {
  vollzeit: "Vollzeit", teilzeit: "Teilzeit", geringfuegig: "Geringfügig",
  lehrling: "Lehrling", freier_dienstnehmer: "Freier DN",
  praktikant: "Praktikant", werkvertrag: "Werkvertrag",
};

export default function AdminPage() {
  const today = new Date();
  const in30 = addDays(today, 30);

  const { data: employees = [], dataUpdatedAt } = useQuery<Employee[]>({
    queryKey: ["employees-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees").select("*").eq("is_active", true)
        .or("employee_number.is.null,employee_number.not.in.(EMP001,EMP002)").limit(500);
      if (error) throw error;
      return data as unknown as Employee[];
    },
    refetchInterval: REFETCH,
  });

  const { data: kvs = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["kollektivvertraege"],
    queryFn: async () => {
      const { data } = await supabase.from("kollektivvertraege").select("id, name").order("name");
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const { data: pending = [] } = useQuery<Absence[]>({
    queryKey: ["pending-leaves"],
    queryFn: getAllPendingAbsences,
    refetchInterval: REFETCH,
  });

  const kpis = useMemo(() => {
    const total = employees.length;
    const inKarenz = employees.filter(e => (cf(e).status ?? "").toLowerCase().includes("karenz")).length;
    const inPfaendung = employees.filter(e => {
      const s = (cf(e).status ?? "").trim().toLowerCase();
      return s.includes("pfänd") || s.includes("pfaend");
    }).length;
    const byType: Record<string, number> = {};
    for (const e of employees) byType[e.employment_type] = (byType[e.employment_type] ?? 0) + 1;
    const byKv = kvs
      .map(k => ({ name: k.name, count: employees.filter(e => e.kv_id === k.id).length }))
      .filter(x => x.count > 0).sort((a, b) => b.count - a.count);
    return { total, inKarenz, inPfaendung, byType, byKv };
  }, [employees, kvs]);

  const warnings = useMemo(() => {
    const austritts: { emp: Employee; date: Date; info: string }[] = [];
    const salaryChanges: { emp: Employee; date: Date }[] = [];
    for (const e of employees) {
      const c = cf(e);
      const exitDate = parseDateFromText(c.austritt_info);
      if (exitDate && isAfter(exitDate, today) && isBefore(exitDate, in30)) {
        austritts.push({ emp: e, date: exitDate, info: c.austritt_info ?? "" });
      }
      if (c.naechste_gehaltsaenderung) {
        try {
          const d = parseISO(c.naechste_gehaltsaenderung);
          if (isValid(d) && isAfter(d, today) && isBefore(d, in30)) salaryChanges.push({ emp: e, date: d });
        } catch { /* ignore */ }
      }
    }
    austritts.sort((a, b) => a.date.getTime() - b.date.getTime());
    salaryChanges.sort((a, b) => a.date.getTime() - b.date.getTime());
    return { austritts, salaryChanges };
  }, [employees, in30]);

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">HR Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Bäckerei Karl Bauer GmbH · {kpis.total} aktive Mitarbeiter
            {lastUpdated && <span className="ml-2 text-gray-400">· Stand {format(lastUpdated, "HH:mm")} Uhr</span>}
          </p>
        </div>
        <Link href="/admin/employees"
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition">
          <Users className="h-3.5 w-3.5" strokeWidth={1.5} /> Alle Mitarbeiter
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={<Users className="h-5 w-5" strokeWidth={1.5} />} label="Aktive Mitarbeiter" value={kpis.total} color="green" href="/admin/employees" />
        <KpiCard icon={<AlertCircle className="h-5 w-5" strokeWidth={1.5} />} label="Offene Anträge" value={pending.length} color="amber" href="/admin/leave" />
        <KpiCard icon={<Baby className="h-5 w-5" strokeWidth={1.5} />} label="In Karenz" value={kpis.inKarenz} color="blue" href="/admin/employees/status" />
        <KpiCard icon={<AlertTriangle className="h-5 w-5" strokeWidth={1.5} />} label="Pfändungen" value={kpis.inPfaendung} color="red" href="/admin/employees/status" />
      </div>

      {/* Warnings */}
      {(warnings.austritts.length > 0 || warnings.salaryChanges.length > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="mb-3 text-sm font-semibold text-amber-800">
            Handlungsbedarf — nächste 30 Tage
            <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
              {warnings.austritts.length + warnings.salaryChanges.length}
            </span>
          </h2>
          <div className="space-y-2">
            {warnings.austritts.map(w => (
              <WarningRow key={`exit-${w.emp.id}`} href={`/admin/employees/${w.emp.id}`}
                name={`${w.emp.first_name} ${w.emp.last_name}`} label="Austritt" labelColor="red"
                detail={`${format(w.date, "d. MMM yyyy", { locale: de })} · ${w.info}`} dnr={w.emp.employee_number} />
            ))}
            {warnings.salaryChanges.map(w => (
              <WarningRow key={`sal-${w.emp.id}`} href={`/admin/employees/${w.emp.id}`}
                name={`${w.emp.first_name} ${w.emp.last_name}`} label="Gehaltsänderung" labelColor="amber"
                detail={format(w.date, "d. MMM yyyy", { locale: de })} dnr={w.emp.employee_number} />
            ))}
          </div>
        </div>
      )}

      {/* Breakdown grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
            <h2 className="text-sm font-medium text-gray-900">Nach Beschäftigungsart</h2>
          </div>
          <div className="space-y-2">
            {Object.entries(kpis.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <BarRow key={type} label={TYPE_LABELS[type] ?? type} count={count} total={kpis.total} />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <Euro className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
            <h2 className="text-sm font-medium text-gray-900">Nach Kollektivvertrag</h2>
          </div>
          <div className="space-y-2">
            {kpis.byKv.map(({ name, count }) => (
              <BarRow key={name} label={name} count={count} total={kpis.total} />
            ))}
            {(() => {
              const noKv = employees.filter(e => !e.kv_id).length;
              return noKv > 0 ? <BarRow label="Kein KV" count={noKv} total={kpis.total} /> : null;
            })()}
          </div>
        </div>
      </div>

      {/* Karenz list */}
      {kpis.inKarenz > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Baby className="h-4 w-4 text-blue-400" strokeWidth={1.5} />
              <h2 className="text-sm font-medium text-gray-900">Karenz-Übersicht</h2>
            </div>
            <span className="text-xs text-gray-400">{kpis.inKarenz} Mitarbeiter</span>
          </div>
          <div className="divide-y divide-gray-50">
            {employees.filter(e => (cf(e).status ?? "").toLowerCase().includes("karenz")).map(e => (
              <Link key={e.id} href={`/admin/employees/${e.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition">
                <div>
                  <p className="text-sm font-medium text-gray-900">{e.first_name} {e.last_name}</p>
                  <p className="text-xs text-gray-400">{cf(e).austritt_info || cf(e).status}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300" strokeWidth={1.5} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Pending leave */}
      {pending.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
              <h2 className="text-sm font-medium text-gray-900">Offene Urlaubsanträge</h2>
            </div>
            <Link href="/admin/leave" className="text-xs text-[#4F772D] hover:underline">Alle bearbeiten →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {pending.slice(0, 5).map(req => (
              <div key={req.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {(req as { employees?: { first_name?: string; last_name?: string } }).employees?.first_name}{" "}
                    {(req as { employees?: { first_name?: string; last_name?: string } }).employees?.last_name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {format(parseISO(req.start_date), "d. MMM", { locale: de })} – {format(parseISO(req.end_date), "d. MMM yyyy", { locale: de })} · {req.working_days} Tage
                  </p>
                </div>
                <Link href="/admin/leave" className="text-xs font-medium text-[#4F772D] hover:underline">Bearbeiten →</Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, color, href }: {
  icon: React.ReactNode; label: string; value: number; color: string; href?: string;
}) {
  const colors: Record<string, string> = {
    green: "bg-[#4F772D]/10 text-[#4F772D]",
    amber: "bg-amber-50 text-amber-500",
    blue:  "bg-blue-50 text-blue-500",
    red:   "bg-red-50 text-red-500",
  };
  const inner = (
    <div className="rounded-xl border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow">
      <div className={`mb-3 inline-flex rounded-lg p-2 ${colors[color] ?? colors.green}`}>{icon}</div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function BarRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-gray-600 truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-gray-100">
        <div className="h-2 rounded-full bg-[#4F772D]/60 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 text-right text-xs text-gray-500">{count} <span className="text-gray-300">({pct}%)</span></span>
    </div>
  );
}

function WarningRow({ href, name, label, labelColor, detail, dnr }: {
  href: string; name: string; label: string; labelColor: "red" | "amber"; detail: string; dnr?: string | null;
}) {
  const cls = labelColor === "red" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";
  return (
    <Link href={href}
      className="flex items-center justify-between rounded-lg bg-white px-4 py-3 hover:bg-amber-50/50 transition">
      <div className="flex items-center gap-3">
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>
        <div>
          <p className="text-sm font-medium text-gray-900">{name}</p>
          <p className="text-xs text-gray-500">{detail}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-400">
        {dnr && <span>DNR {dnr}</span>}
        <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
      </div>
    </Link>
  );
}
