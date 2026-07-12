"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Employee } from "@/types";
import {
  Baby, AlertTriangle, LogOut, Search, ChevronRight,
  Calendar, AlertCircle, CheckCircle2, X,
} from "lucide-react";
import { format, parseISO, differenceInDays, isValid, addDays, isAfter, isBefore } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { de } from "date-fns/locale";
import Link from "next/link";
import { toast } from "sonner";

type Tab = "karenz" | "pfaendung" | "austritt";

type CF = {
  status?: string;
  austritt_info?: string;
};

function cf(emp: Employee): CF {
  return (emp.custom_fields ?? {}) as CF;
}

function isKarenz(emp: Employee): boolean {
  return (cf(emp).status ?? "").trim().toLowerCase().includes("karenz");
}

function isPfaendung(emp: Employee): boolean {
  const s = (cf(emp).status ?? "").trim().toLowerCase();
  return s.includes("pfänd") || s.includes("pfaend");
}

function parseDateFromText(text?: string): Date | null {
  if (!text) return null;
  const m = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isValid(d) ? d : null;
}

function CountdownBadge({ date }: { date: Date }) {
  const days = differenceInDays(date, new Date());
  if (days < 0) return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">abgelaufen</span>;
  if (days === 0) return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">heute</span>;
  if (days <= 7) return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">in {days} Tagen</span>;
  if (days <= 30) return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">in {days} Tagen</span>;
  return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">in {days} Tagen</span>;
}

type AustrittState = {
  emp: Employee | null;
  exitDate: string;
  confirming: boolean;
};

export default function StatusPage() {
  const [tab, setTab] = useState<Tab>("karenz");
  const [search, setSearch] = useState("");
  const [austritt, setAustritt] = useState<AustrittState>({
    emp: null,
    exitDate: format(new Date(), "yyyy-MM-dd"),
    confirming: false,
  });

  const { user } = useAuth();
  const qc = useQueryClient();
  const today = new Date();

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["employees-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("is_active", true)
        .or("employee_number.is.null,employee_number.not.in.(EMP001,EMP002)")
        .order("last_name")
        .limit(500);
      if (error) throw error;
      return data as unknown as Employee[];
    },
  });

  const karenzList = useMemo(
    () =>
      employees
        .filter(isKarenz)
        .map(e => ({ emp: e, returnDate: parseDateFromText(cf(e).austritt_info) }))
        .sort((a, b) => {
          if (!a.returnDate) return 1;
          if (!b.returnDate) return -1;
          return a.returnDate.getTime() - b.returnDate.getTime();
        }),
    [employees]
  );

  const pfaendungList = useMemo(() => employees.filter(isPfaendung), [employees]);

  const austrittSearchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return employees
      .filter(
        e =>
          `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
          (e.employee_number ?? "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [employees, search]);

  const austrittMutation = useMutation({
    mutationFn: async () => {
      const emp = austritt.emp!;
      const payload = { is_active: false, exit_date: austritt.exitDate };

      const { error: updateErr } = await supabase
        .from("employees")
        .update(payload)
        .eq("id", emp.id);
      if (updateErr) throw updateErr;

      const { error: histErr } = await supabase.from("employee_history").insert({
        employee_id: emp.id,
        company_id: emp.company_id,
        changed_by: user?.id ?? null,
        change_type: "austritt",
        old_values: { is_active: true, exit_date: emp.exit_date } as Record<string, unknown>,
        new_values: payload as Record<string, unknown>,
        change_note: `Austritt gesetzt: ${format(parseISO(austritt.exitDate), "d. MMM yyyy", { locale: de })}`,
      });
      if (histErr) throw histErr;
    },
    onSuccess: () => {
      toast.success("Mitarbeiter deaktiviert");
      qc.invalidateQueries({ queryKey: ["employees-status"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employees-dashboard"] });
      setAustritt({ emp: null, exitDate: format(new Date(), "yyyy-MM-dd"), confirming: false });
      setSearch("");
    },
    onError: (err: Error) => {
      toast.error(`Fehler: ${err.message}`);
    },
  });

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    {
      key: "karenz",
      label: "Karenz",
      icon: <Baby className="h-4 w-4" strokeWidth={1.5} />,
      count: karenzList.length,
    },
    {
      key: "pfaendung",
      label: "Pfändung",
      icon: <AlertTriangle className="h-4 w-4" strokeWidth={1.5} />,
      count: pfaendungList.length,
    },
    {
      key: "austritt",
      label: "Austritt",
      icon: <LogOut className="h-4 w-4" strokeWidth={1.5} />,
    },
  ];

  return (
    <div className="space-y-5">
      <Link href="/admin/employees" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Mitarbeiter
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Status-Verwaltung</h1>
        <p className="mt-0.5 text-sm text-gray-500">Karenz, Pfändungen und Austritte verwalten</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === t.key
                ? "bg-[#4F772D] text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  tab === t.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── KARENZ ── */}
      {tab === "karenz" && (
        <div className="rounded-xl border border-gray-200 bg-white">
          {isLoading ? (
            <LoadingSkeleton />
          ) : karenzList.length === 0 ? (
            <EmptyState
              icon={<Baby className="h-8 w-8 text-gray-300" strokeWidth={1.5} />}
              label="Keine Mitarbeiter in Karenz"
            />
          ) : (
            <div className="divide-y divide-gray-50">
              {karenzList.map(({ emp, returnDate }) => (
                <Link
                  key={emp.id}
                  href={`/admin/employees/${emp.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-600">
                      {emp.first_name[0]}
                      {emp.last_name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {emp.first_name} {emp.last_name}
                      </p>
                      <p className="text-xs text-gray-400">DNR {emp.employee_number}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {returnDate ? (
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          {format(returnDate, "d. MMM yyyy", { locale: de })}
                        </p>
                        <div className="mt-0.5 flex justify-end">
                          <CountdownBadge date={returnDate} />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Rückkehr unbekannt</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-gray-300" strokeWidth={1.5} />
                  </div>
                </Link>
              ))}
            </div>
          )}
          {karenzList.length > 0 && (
            <div className="border-t border-gray-100 px-5 py-3">
              <p className="text-xs text-gray-400">
                {
                  karenzList.filter(
                    k =>
                      k.returnDate &&
                      isAfter(k.returnDate, today) &&
                      isBefore(k.returnDate, addDays(today, 30))
                  ).length
                }{" "}
                Rückkehr in nächsten 30 Tagen
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── PFÄNDUNG ── */}
      {tab === "pfaendung" && (
        <div className="rounded-xl border border-gray-200 bg-white">
          {isLoading ? (
            <LoadingSkeleton />
          ) : pfaendungList.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle className="h-8 w-8 text-gray-300" strokeWidth={1.5} />}
              label="Keine aktiven Pfändungen"
            />
          ) : (
            <>
              <div className="border-b border-gray-100 px-5 py-3">
                <p className="text-xs text-gray-500">
                  <span className="font-medium text-red-600">{pfaendungList.length} Mitarbeiter</span>{" "}
                  mit aktiver Pfändung
                </p>
              </div>
              <div className="divide-y divide-gray-50">
                {pfaendungList.map(emp => (
                  <Link
                    key={emp.id}
                    href={`/admin/employees/${emp.id}`}
                    className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-sm font-semibold text-red-600">
                        {emp.first_name[0]}
                        {emp.last_name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {emp.first_name} {emp.last_name}
                        </p>
                        <p className="text-xs text-gray-400">DNR {emp.employee_number}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                        {cf(emp).status}
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-300" strokeWidth={1.5} />
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── AUSTRITT ── */}
      {tab === "austritt" && (
        <div className="space-y-4">
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" strokeWidth={1.5} />
            <p className="text-sm text-amber-800">
              Austritt setzt den Mitarbeiter auf{" "}
              <strong>inaktiv</strong> und speichert das Austrittsdatum. Der Schritt wird im
              Verlauf protokolliert.
            </p>
          </div>

          {/* Employee picker */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Mitarbeiter suchen
            </label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                strokeWidth={1.5}
              />
              <input
                type="text"
                placeholder="Name oder Dienstnummer…"
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setAustritt(s => ({ ...s, emp: null, confirming: false }));
                }}
                className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-4 text-sm focus:border-[#4F772D] focus:outline-none focus:ring-1 focus:ring-[#4F772D]"
              />
            </div>

            {austrittSearchResults.length > 0 && !austritt.emp && (
              <div className="mt-2 divide-y divide-gray-50 rounded-lg border border-gray-100 bg-white shadow-sm">
                {austrittSearchResults.map(emp => (
                  <button
                    key={emp.id}
                    onClick={() => {
                      setAustritt(s => ({ ...s, emp, confirming: false }));
                      setSearch("");
                    }}
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {emp.first_name} {emp.last_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        DNR {emp.employee_number} · {emp.employment_type}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300" strokeWidth={1.5} />
                  </button>
                ))}
              </div>
            )}

            {search.trim() && austrittSearchResults.length === 0 && !austritt.emp && (
              <p className="mt-2 text-sm text-gray-400">Keine aktiven Mitarbeiter gefunden.</p>
            )}
          </div>

          {/* Confirm form */}
          {austritt.emp && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4F772D]/10 text-sm font-semibold text-[#4F772D]">
                    {austritt.emp.first_name[0]}
                    {austritt.emp.last_name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {austritt.emp.first_name} {austritt.emp.last_name}
                    </p>
                    <p className="text-xs text-gray-400">DNR {austritt.emp.employee_number}</p>
                  </div>
                </div>
                <button
                  onClick={() => setAustritt(s => ({ ...s, emp: null, confirming: false }))}
                  className="rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  <Calendar className="mr-1.5 inline h-3.5 w-3.5" strokeWidth={1.5} />
                  Austrittsdatum
                </label>
                <input
                  type="date"
                  value={austritt.exitDate}
                  onChange={e =>
                    setAustritt(s => ({ ...s, exitDate: e.target.value, confirming: false }))
                  }
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none focus:ring-1 focus:ring-[#4F772D]"
                />
              </div>

              {!austritt.confirming ? (
                <button
                  onClick={() => setAustritt(s => ({ ...s, confirming: true }))}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition"
                >
                  <LogOut className="h-4 w-4" strokeWidth={1.5} />
                  Austritt durchführen
                </button>
              ) : (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
                  <p className="text-sm font-medium text-red-800">
                    <strong>
                      {austritt.emp.first_name} {austritt.emp.last_name}
                    </strong>{" "}
                    wird deaktiviert. Austrittsdatum:{" "}
                    <strong>
                      {format(parseISO(austritt.exitDate), "d. MMM yyyy", { locale: de })}
                    </strong>
                    .
                  </p>
                  <p className="text-xs text-red-700">
                    Diese Aktion wird im Verlauf protokolliert und kann im Detail-Eintrag
                    rückgängig gemacht werden.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => austrittMutation.mutate()}
                      disabled={austrittMutation.isPending}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition"
                    >
                      <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                      {austrittMutation.isPending ? "Wird gespeichert…" : "Bestätigen"}
                    </button>
                    <button
                      onClick={() => setAustritt(s => ({ ...s, confirming: false }))}
                      className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="divide-y divide-gray-50">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div className="h-9 w-9 animate-pulse rounded-full bg-gray-100" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-36 animate-pulse rounded bg-gray-100" />
            <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      {icon}
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}
