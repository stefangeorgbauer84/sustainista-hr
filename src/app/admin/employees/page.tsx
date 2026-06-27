"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Employee } from "@/types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, X, Pencil, Calendar, Eye, Search, ChevronUp, ChevronDown,
  ChevronLeft, ChevronRight, AlertTriangle, Baby,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { useAuth } from "@/context/AuthContext";
import { canSeePfaendung, canSeeBrutto } from "@/lib/rbac";

const PAGE_SIZE = 25;

const schema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  contact_email: z.string().email().nullable().optional(),
  contact_phone: z.string().optional(),
  entry_date: z.string().min(1),
  hours_per_week: z.number().min(0).max(60),
  employment_type: z.enum(["vollzeit", "teilzeit", "geringfuegig", "lehrling", "freier_dienstnehmer", "praktikant", "werkvertrag"]),
});

type FormData = z.infer<typeof schema>;
type SortField = "last_name" | "entry_date" | "brutto";
type SortDir = "asc" | "desc";

function getStatus(emp: Employee): "karenz" | "pfaendung" | null {
  const s = ((emp.custom_fields as Record<string, string>)?.status ?? "").trim().toLowerCase();
  if (s.includes("karenz")) return "karenz";
  if (s.includes("pfänd") || s.includes("pfaend")) return "pfaendung";
  return null;
}

function getBrutto(emp: Employee): number {
  return parseFloat((emp.custom_fields as Record<string, string>)?.brutto ?? "0") || 0;
}

const EMPLOYMENT_LABELS: Record<string, string> = {
  vollzeit: "Vollzeit",
  teilzeit: "Teilzeit",
  geringfuegig: "Geringfügig",
  lehrling: "Lehrling",
  freier_dienstnehmer: "Freier DN",
  praktikant: "Praktikant",
  werkvertrag: "Werkvertrag",
};

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none focus:ring-2 focus:ring-[#4F772D]/20";
const filterCls = "rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 focus:border-[#4F772D] focus:outline-none focus:ring-2 focus:ring-[#4F772D]/20 bg-white";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function EmployeesPage() {
  const qc = useQueryClient();
  const { isAdminUser, viewAs, profile } = useAuth();
  const role = profile?.role;
  const showPfaendung = canSeePfaendung(role);
  const showBrutto = canSeeBrutto(role);
  const router = useRouter();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [kvFilter, setKvFilter] = useState("");
  const [kstFilter, setKstFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [sortBy, setSortBy] = useState<SortField>("last_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);

  // Debounce search 300 ms
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [kvFilter, kstFilter, typeFilter, showInactive]);

  const { data: kvs = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["kollektivvertraege"],
    queryFn: async () => {
      const { data } = await supabase.from("kollektivvertraege").select("id, name").order("name");
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const { data: costCenters = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["cost_centers"],
    queryFn: async () => {
      const { data } = await supabase.from("cost_centers").select("id, name").order("name");
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const kvMap = useMemo(() => Object.fromEntries(kvs.map(k => [k.id, k.name])), [kvs]);
  const kstMap = useMemo(() => Object.fromEntries(costCenters.map(c => [c.id, c.name])), [costCenters]);

  const { data: allFiltered = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["employees", debouncedSearch, kvFilter, kstFilter, typeFilter, showInactive],
    queryFn: async () => {
      let q = supabase.from("employees").select("*");
      if (!showInactive) q = q.eq("is_active", true);
      if (kvFilter) q = q.eq("kv_id", kvFilter);
      if (kstFilter) q = q.eq("cost_center_id", kstFilter);
      if (typeFilter) q = q.eq("employment_type", typeFilter as Employee["employment_type"]);
      if (debouncedSearch.trim()) {
        const s = debouncedSearch.trim();
        q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,employee_number.ilike.%${s}%`);
      }
      const { data, error } = await q.order("last_name").limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Employee[];
    },
  });

  const sorted = useMemo(() => {
    const arr = [...allFiltered];
    arr.sort((a, b) => {
      let va: string | number, vb: string | number;
      if (sortBy === "entry_date") {
        va = a.entry_date; vb = b.entry_date;
      } else if (sortBy === "brutto") {
        va = getBrutto(a); vb = getBrutto(b);
      } else {
        va = a.last_name.toLowerCase(); vb = b.last_name.toLowerCase();
      }
      return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDir === "asc" ? 1 : -1);
    });
    return arr;
  }, [allFiltered, sortBy, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(field: SortField) {
    if (sortBy === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(field); setSortDir("asc"); }
  }

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { hours_per_week: 38.5, employment_type: "vollzeit" },
  });

  function openEdit(emp: Employee) {
    setEditing(emp);
    reset({
      first_name: emp.first_name, last_name: emp.last_name,
      contact_email: emp.contact_email ?? "",
      contact_phone: emp.contact_phone ?? "",
      entry_date: emp.entry_date,
      hours_per_week: emp.hours_per_week,
      employment_type: emp.employment_type,
    });
    setShowForm(true);
  }

  function openNew() {
    setEditing(null);
    reset({ hours_per_week: 38.5, employment_type: "vollzeit" });
    setShowForm(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        first_name: data.first_name, last_name: data.last_name,
        contact_email: data.contact_email || null,
        contact_phone: data.contact_phone || null,
        entry_date: data.entry_date,
        hours_per_week: data.hours_per_week,
        employment_type: data.employment_type,
      };
      if (editing) {
        const { error } = await supabase.from("employees").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employees").insert({
          ...payload, employment_percentage: 100, contract_type: "unbefristet",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["all-employees"] });
      toast.success(editing ? "Gespeichert" : "Mitarbeiter angelegt");
      setShowForm(false); setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message ?? "Fehler beim Speichern"),
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ChevronUp className="h-3 w-3 text-gray-300" strokeWidth={1.5} />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 text-[#4F772D]" strokeWidth={1.5} />
      : <ChevronDown className="h-3 w-3 text-[#4F772D]" strokeWidth={1.5} />;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Mitarbeiter</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {isLoading ? "Lädt…" : `${allFiltered.length} Mitarbeiter`}
          </p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] transition">
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          <span className="hidden sm:inline">Mitarbeiter anlegen</span>
          <span className="sm:hidden">Neu</span>
        </button>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              {editing ? `${editing.first_name} ${editing.last_name} bearbeiten` : "Neuer Mitarbeiter"}
            </h2>
            <button onClick={() => setShowForm(false)}>
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" strokeWidth={1.5} />
            </button>
          </div>
          <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="grid grid-cols-2 gap-4">
            <Field label="Vorname" error={errors.first_name?.message}>
              <input {...register("first_name")} className={inputCls} placeholder="Maria" />
            </Field>
            <Field label="Nachname" error={errors.last_name?.message}>
              <input {...register("last_name")} className={inputCls} placeholder="Muster" />
            </Field>
            <Field label="E-Mail" error={errors.contact_email?.message}>
              <input {...register("contact_email")} type="email" className={inputCls} />
            </Field>
            <Field label="Telefon">
              <input {...register("contact_phone")} className={inputCls} />
            </Field>
            <Field label="Eintrittsdatum" error={errors.entry_date?.message}>
              <input {...register("entry_date")} type="date" className={inputCls} />
            </Field>
            <Field label="Beschäftigungsart">
              <select {...register("employment_type")} className={inputCls}>
                {Object.entries(EMPLOYMENT_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Stunden/Woche" error={errors.hours_per_week?.message}>
              <input {...register("hours_per_week", { valueAsNumber: true })} type="number" step="0.5" className={inputCls} />
            </Field>
            <div className="col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Abbrechen
              </button>
              <button type="submit" disabled={saveMutation.isPending}
                className="rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60">
                {saveMutation.isPending ? "Speichert…" : "Speichern"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search + Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" strokeWidth={1.5} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Name oder DNR suchen…"
              className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none focus:ring-2 focus:ring-[#4F772D]/20"
            />
          </div>
          <select value={kvFilter} onChange={e => setKvFilter(e.target.value)} className={filterCls}>
            <option value="">Alle KVs</option>
            {kvs.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
          <select value={kstFilter} onChange={e => setKstFilter(e.target.value)} className={filterCls}>
            <option value="">Alle Filialen</option>
            {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={filterCls}>
            <option value="">Alle Arten</option>
            {Object.entries(EMPLOYMENT_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-[#4F772D] focus:ring-[#4F772D]" />
            Inkl. inaktiv
          </label>
        </div>
      </div>

      {/* Table — desktop */}
      <div className="hidden md:block rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <button onClick={() => toggleSort("last_name")}
                  className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700">
                  Name <SortIcon field="last_name" />
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">DNR</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">KV</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Filiale</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Art</th>
              <th className="px-4 py-3 text-right">
                <button onClick={() => toggleSort("entry_date")}
                  className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 ml-auto">
                  <SortIcon field="entry_date" /> Eintritt
                </button>
              </th>
              <th className="px-4 py-3 text-right">
                <button onClick={() => toggleSort("brutto")}
                  className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 ml-auto">
                  <SortIcon field="brutto" /> Brutto
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">Wird geladen…</td></tr>
            ) : pageData.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">Keine Mitarbeiter gefunden</td></tr>
            ) : pageData.map(emp => {
              const status = getStatus(emp);
              const brutto = getBrutto(emp);
              return (
                <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4F772D]/10 text-xs font-semibold text-[#4F772D]">
                        {emp.first_name[0]}{emp.last_name[0]}
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {emp.first_name} {emp.last_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{emp.employee_number ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{emp.kv_id ? (kvMap[emp.kv_id] ?? "—") : "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {emp.cost_center_id ? (kstMap[emp.cost_center_id] ?? "—") : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {EMPLOYMENT_LABELS[emp.employment_type] ?? emp.employment_type}
                    <span className="ml-1 text-gray-400">{emp.hours_per_week}h</span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">
                    {format(parseISO(emp.entry_date), "dd.MM.yyyy", { locale: de })}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-medium text-gray-700">
                    {showBrutto
                      ? (brutto > 0
                          ? `€ ${brutto.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : "—")
                      : <span className="text-gray-300">••••</span>}
                  </td>
                  <td className="px-4 py-3">
                    {status === "karenz" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                        <Baby className="h-3 w-3" strokeWidth={1.5} /> Karenz
                      </span>
                    )}
                    {status === "pfaendung" && showPfaendung && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                        <AlertTriangle className="h-3 w-3" strokeWidth={1.5} /> Pfändung
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {isAdminUser && (
                        <button
                          onClick={() => { viewAs(emp); router.push("/dashboard"); }}
                          className="rounded-md border border-amber-200 bg-amber-50 p-1 text-amber-700 hover:bg-amber-100 transition"
                          aria-label={`Als ${emp.first_name} ${emp.last_name} ansehen`}>
                          <Eye className="h-3 w-3" strokeWidth={1.5} />
                        </button>
                      )}
                      <button onClick={() => openEdit(emp)}
                        aria-label={`${emp.first_name} ${emp.last_name} bearbeiten`}
                        className="rounded-md border border-gray-200 p-1 text-gray-500 hover:bg-gray-50 transition">
                        <Pencil className="h-3 w-3" strokeWidth={1.5} />
                      </button>
                      <Link href={`/admin/employees/${emp.id}`}
                        className="rounded-md border border-gray-200 px-2.5 py-1 text-[10px] text-gray-500 hover:bg-gray-50 transition">
                        Details →
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Card list — mobile */}
      <div className="md:hidden space-y-2">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-gray-400">Wird geladen…</p>
        ) : pageData.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">Keine Mitarbeiter gefunden</p>
        ) : pageData.map(emp => {
          const status = getStatus(emp);
          const brutto = getBrutto(emp);
          return (
            <div key={emp.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#4F772D]/10 text-sm font-semibold text-[#4F772D]">
                    {emp.first_name[0]}{emp.last_name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{emp.first_name} {emp.last_name}</p>
                    <p className="text-xs text-gray-500">
                      DNR {emp.employee_number ?? "—"} · {EMPLOYMENT_LABELS[emp.employment_type]} · {emp.hours_per_week}h
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  {status === "karenz" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                      <Baby className="h-3 w-3" strokeWidth={1.5} /> Karenz
                    </span>
                  )}
                  {status === "pfaendung" && showPfaendung && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                      <AlertTriangle className="h-3 w-3" strokeWidth={1.5} /> Pfändung
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                <div className="space-y-0.5">
                  <p>{emp.kv_id ? (kvMap[emp.kv_id] ?? "—") : "—"}</p>
                  <p>{emp.cost_center_id ? (kstMap[emp.cost_center_id] ?? "—") : "—"}</p>
                </div>
                <div className="text-right space-y-0.5">
                  <p className="flex items-center gap-1 justify-end">
                    <Calendar className="h-3 w-3" strokeWidth={1.5} />
                    {format(parseISO(emp.entry_date), "dd.MM.yyyy", { locale: de })}
                  </p>
                  {showBrutto && brutto > 0 && (
                    <p className="font-medium text-gray-700">
                      € {brutto.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Link href={`/admin/employees/${emp.id}`}
                  className="flex-1 rounded-lg border border-gray-200 py-1.5 text-center text-xs text-gray-600 hover:bg-gray-50 transition">
                  Details
                </Link>
                <button onClick={() => openEdit(emp)}
                  className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition">
                  Bearbeiten
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-3">
          <p className="text-xs text-gray-500">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} von {sorted.length}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i} onClick={() => setPage(i)}
                className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                  page === i
                    ? "border-[#4F772D] bg-[#4F772D] text-white"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}>
                {i + 1}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
              className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
              <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
