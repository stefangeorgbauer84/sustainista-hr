"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Employee } from "@/types";
import { FileSpreadsheet, Download, AlertCircle, ArrowLeft, UserMinus, Shield, FileText } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type CostCenter = { id: string; name: string };
type KV = { id: string; name: string };

type EmployeeStatus = "karenz" | "pfaendung" | "aktiv";

type PayrollRow = {
  id: string;
  employee_number: string | null;
  first_name: string;
  last_name: string;
  employment_type: string;
  cost_center_id: string | null;
  kv_id: string | null;
  gross: number;
  empStatus: EmployeeStatus;
};

function getEmployeeStatus(emp: Employee): EmployeeStatus {
  const s = ((emp.custom_fields as Record<string, string>)?.status ?? "").trim().toLowerCase();
  if (s.includes("karenz")) return "karenz";
  if (s.includes("pfänd") || s.includes("pfaend")) return "pfaendung";
  return "aktiv";
}

function parseGross(emp: Employee): number {
  const raw = (emp.custom_fields as Record<string, string>)?.brutto ?? "";
  return parseFloat(raw) || 0;
}

const MONTH_NAMES = [
  "Jänner", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

export default function PayrollExportPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const { user, company } = useAuth();

  const { data: employees = [], isLoading: loadingEmps } = useQuery<Employee[]>({
    queryKey: ["employees-payroll"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("is_active", true)
        .not("employee_number", "in", '("EMP001","EMP002")')
        .order("last_name")
        .limit(500);
      if (error) throw error;
      return data as unknown as Employee[];
    },
  });

  const { data: costCenters = [] } = useQuery<CostCenter[]>({
    queryKey: ["cost-centers-payroll"],
    queryFn: async () => {
      const { data } = await supabase.from("cost_centers").select("id, name").order("name");
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const { data: kvs = [] } = useQuery<KV[]>({
    queryKey: ["kollektivvertraege-payroll"],
    queryFn: async () => {
      const { data } = await supabase.from("kollektivvertraege").select("id, name").order("name");
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const kstMap = useMemo(
    () => Object.fromEntries(costCenters.map(c => [c.id, c.name])),
    [costCenters]
  );
  const kvMap = useMemo(
    () => Object.fromEntries(kvs.map(k => [k.id, k.name])),
    [kvs]
  );

  const rows: PayrollRow[] = useMemo(
    () =>
      employees.map(e => ({
        id: e.id,
        employee_number: e.employee_number,
        first_name: e.first_name,
        last_name: e.last_name,
        employment_type: e.employment_type,
        cost_center_id: e.cost_center_id,
        kv_id: e.kv_id,
        gross: parseGross(e),
        empStatus: getEmployeeStatus(e),
      })),
    [employees]
  );

  const totalGross = useMemo(() => rows.reduce((sum, r) => sum + r.gross, 0), [rows]);

  const byKst = useMemo(() => {
    const map: Record<string, { name: string; count: number; total: number }> = {};
    for (const r of rows) {
      const key = r.cost_center_id ?? "__none__";
      const name = r.cost_center_id ? (kstMap[r.cost_center_id] ?? "Unbekannt") : "Keine KST";
      if (!map[key]) map[key] = { name, count: 0, total: 0 };
      map[key].count++;
      map[key].total += r.gross;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [rows, kstMap]);

  const logMutation = useMutation({
    mutationFn: async (fmt: "xlsx" | "csv") => {
      const companyId = company?.id;
      if (!companyId) throw new Error("Kein Unternehmen gefunden");

      const { data: exp, error: expErr } = await supabase
        .from("payroll_exports")
        .insert({
          company_id: companyId,
          period_year: year,
          period_month: month,
          export_format: fmt,
          status: "exported",
          created_by: user?.id ?? null,
          total_gross_salary: totalGross,
          total_employees: rows.length,
        })
        .select("id")
        .single();
      if (expErr) throw expErr;

      const items = rows.map(r => ({
        payroll_export_id: exp.id,
        company_id: companyId,
        employee_id: r.id,
        gross_salary: r.gross > 0 ? r.gross : null,
      }));

      const { error: itemsErr } = await supabase
        .from("payroll_export_items")
        .insert(items);
      if (itemsErr) throw itemsErr;
    },
    onError: (err: Error) => {
      toast.error(`Protokollierung fehlgeschlagen: ${err.message}`);
    },
  });

  function buildSheetData() {
    return rows.map(r => ({
      "Dienstnummer": r.employee_number ?? "",
      "Nachname": r.last_name,
      "Vorname": r.first_name,
      "Beschäftigungsart": r.employment_type,
      "KST / Filiale": r.cost_center_id ? (kstMap[r.cost_center_id] ?? "") : "",
      "Kollektivvertrag": r.kv_id ? (kvMap[r.kv_id] ?? "") : "",
      "Brutto (€)": r.gross > 0 ? r.gross : "",
      "Status": r.empStatus === "karenz" ? "Karenz" : r.empStatus === "pfaendung" ? "Pfändung" : "",
      "Periode": `${String(month).padStart(2, "0")}/${year}`,
    }));
  }

  async function handleXlsx() {
    const data = buildSheetData();
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 16 },
      { wch: 18 }, { wch: 22 }, { wch: 12 }, { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lohnliste");

    const kstData = byKst.map(k => ({
      "KST / Filiale": k.name,
      "Mitarbeiter": k.count,
      "Brutto gesamt (€)": k.total > 0 ? k.total : "",
    }));
    const wsKst = XLSX.utils.json_to_sheet(kstData);
    wsKst["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsKst, "Nach Filiale");

    XLSX.writeFile(wb, `Lohnliste_${year}_${String(month).padStart(2, "0")}.xlsx`);
    await logMutation.mutateAsync("xlsx");
    toast.success("XLSX exportiert");
  }

  async function handleCsv() {
    const data = buildSheetData();
    const headers = Object.keys(data[0] ?? {});
    const lines = [
      headers.join(";"),
      ...data.map(row =>
        headers
          .map(h => {
            const v = (row as Record<string, unknown>)[h];
            const s = v == null ? "" : String(v);
            return s.includes(";") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(";")
      ),
    ];
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Lohnliste_${year}_${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    await logMutation.mutateAsync("csv");
    toast.success("CSV exportiert");
  }

  const periodLabel = `${MONTH_NAMES[month - 1]} ${year}`;
  const noGrossCount = rows.filter(r => r.gross === 0).length;
  const karenzCount = rows.filter(r => r.empStatus === "karenz").length;
  const pfaendungCount = rows.filter(r => r.empStatus === "pfaendung").length;

  return (
    <div className="space-y-5">
      <Link href="/admin/reports" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Reports
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Lohnexport</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Monatliche Lohnliste als XLSX oder CSV exportieren
        </p>
      </div>

      {/* Period picker + export buttons */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Monat</label>
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-[#4F772D] focus:outline-none"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Jahr</label>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-[#4F772D] focus:outline-none"
          >
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={handleCsv}
            disabled={loadingEmps || rows.length === 0 || logMutation.isPending}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
          >
            <Download className="h-4 w-4" strokeWidth={1.5} />
            CSV
          </button>
          <button
            onClick={handleXlsx}
            disabled={loadingEmps || rows.length === 0 || logMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#4F772D]/90 disabled:opacity-50 transition"
          >
            <FileSpreadsheet className="h-4 w-4" strokeWidth={1.5} />
            XLSX exportieren
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Mitarbeiter</p>
          <p className="mt-0.5 text-2xl font-semibold text-gray-900">{rows.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Brutto gesamt</p>
          <p className="mt-0.5 text-2xl font-semibold text-gray-900">
            € {totalGross.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Periode</p>
          <p className="mt-0.5 text-2xl font-semibold text-gray-900">{periodLabel}</p>
        </div>
      </div>

      {/* Missing brutto warning */}
      {noGrossCount > 0 && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" strokeWidth={1.5} />
          <p className="text-sm text-amber-800">
            <strong>{noGrossCount} Mitarbeiter</strong> haben kein Brutto eingetragen und
            werden mit € 0,00 exportiert.
          </p>
        </div>
      )}

      {karenzCount > 0 && (
        <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <UserMinus className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" strokeWidth={1.5} />
          <p className="text-sm text-blue-800">
            <strong>{karenzCount} Mitarbeiter</strong> in Karenz im Export — Brutto prüfen.
          </p>
        </div>
      )}
      {pfaendungCount > 0 && (
        <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-red-500" strokeWidth={1.5} />
          <p className="text-sm text-red-800">
            <strong>{pfaendungCount} Mitarbeiter</strong> mit Pfändung im Export — Pfändungsbetrag separat an Lohnverrechnung melden.
          </p>
        </div>
      )}

      {/* Preview table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-900">Vorschau Lohnliste</h2>
          <span className="text-xs text-gray-400">{rows.length} Mitarbeiter</span>
        </div>
        {loadingEmps ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">Wird geladen…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10 text-left text-xs font-medium text-gray-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">DNR</th>
                  <th className="px-4 py-3">KST / Filiale</th>
                  <th className="px-4 py-3">KV</th>
                  <th className="px-4 py-3">Art</th>
                  <th className="px-4 py-3 text-right">Brutto</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      {r.last_name}, {r.first_name}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{r.employee_number}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">
                      {r.cost_center_id ? (kstMap[r.cost_center_id] ?? "—") : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">
                      {r.kv_id ? (kvMap[r.kv_id] ?? "—") : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{r.employment_type}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-medium text-gray-700">
                      {r.gross > 0
                        ? `€ ${r.gross.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.empStatus === "karenz" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                          <UserMinus className="h-3 w-3" strokeWidth={1.5} /> Karenz
                        </span>
                      )}
                      {r.empStatus === "pfaendung" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                          <Shield className="h-3 w-3" strokeWidth={1.5} /> Pfändung
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/admin/reports/payroll/${r.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#4F772D] hover:underline underline-offset-2"
                      >
                        <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
                        Lohnzettel
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-gray-700">
                    Gesamt
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                    € {totalGross.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Per-KST breakdown */}
      {byKst.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-medium text-gray-900">Aufschlüsselung nach Filiale / KST</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {byKst.map(k => (
              <div key={k.name} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{k.name}</p>
                  <p className="text-xs text-gray-400">{k.count} Mitarbeiter</p>
                </div>
                <p className="text-sm font-semibold text-gray-700">
                  € {k.total.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
