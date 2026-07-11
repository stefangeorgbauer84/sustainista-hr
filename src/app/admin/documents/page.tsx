"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Employee, Document } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { useState, useRef } from "react";
import {
  Upload, FileText, Download, Trash2, Search,
  Eye, EyeOff, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

const ITEMS_PER_PAGE = 20;

const typeLabels: Record<string, string> = {
  payslip: "Lohnzettel",
  contract: "Vertrag",
  other: "Sonstiges",
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${active ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
      {children}
    </button>
  );
}

export default function AdminDocumentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"payslips" | "all">("payslips");

  // Payslip workflow
  const [payslipMonth, setPayslipMonth] = useState(format(new Date(), "yyyy-MM"));
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  // Single upload (Vertrag/Sonstiges)
  const singleFileRef = useRef<HTMLInputElement>(null);
  const [singleEmployee, setSingleEmployee] = useState("");
  const [singleDocType, setSingleDocType] = useState<"contract" | "other">("contract");
  const [singleTitle, setSingleTitle] = useState("");
  const [singleUploading, setSingleUploading] = useState(false);

  // All docs filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "payslip" | "contract" | "other">("all");
  const [empFilter, setEmpFilter] = useState("");
  const [page, setPage] = useState(0);

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["all-employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("is_active", true).order("last_name").limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: allDocs = [], isLoading } = useQuery<Document[]>({
    queryKey: ["all-docs-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .is("deleted_at", null)
        .eq("is_current_version", true)
        .order("uploaded_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Payslip workflow data
  const monthDocs = allDocs.filter(d => d.tags?.includes("payslip") && d.tags?.includes(payslipMonth));
  const payslipMap = new Map(monthDocs.map(d => [d.employee_id, d]));
  const uploadedCount = employees.filter(e => payslipMap.has(e.id)).length;
  const publishedCount = monthDocs.filter(d => d.visible_to_employee).length;

  // Filtered docs (all tab)
  const filteredDocs = allDocs.filter(d => {
    if (typeFilter !== "all" && !d.tags?.includes(typeFilter)) return false;
    if (empFilter && d.employee_id !== empFilter) return false;
    if (searchQuery) {
      const emp = employees.find(e => e.id === d.employee_id);
      const empName = emp ? `${emp.first_name} ${emp.last_name}`.toLowerCase() : "";
      const q = searchQuery.toLowerCase();
      if (!d.title.toLowerCase().includes(q) && !empName.includes(q)) return false;
    }
    return true;
  });
  const totalPages = Math.ceil(filteredDocs.length / ITEMS_PER_PAGE);
  const pagedDocs = filteredDocs.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  function downloadUrl(storagePath: string) {
    const { data } = supabase.storage.from("documents").getPublicUrl(storagePath);
    return data.publicUrl;
  }

  async function uploadPayslip(empId: string, file: File) {
    setUploadingFor(empId);
    try {
      const ext = file.name.split(".").pop();
      // eslint-disable-next-line react-hooks/purity -- Event-Handler, kein Render-Pfad
      const storagePath = `${empId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, file);
      if (uploadError) throw uploadError;
      const emp = employees.find(e => e.id === empId);
      const { error: insertError } = await supabase.from("documents").insert({
        employee_id: empId,
        title: `Lohnzettel ${payslipMonth}`,
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        tags: ["payslip", payslipMonth],
        visible_to_employee: false,
        uploaded_by: user!.id,
        uploaded_at: new Date().toISOString(),
        version: 1,
        is_current_version: true,
      });
      if (insertError) throw insertError;
      qc.invalidateQueries({ queryKey: ["all-docs-admin"] });
      toast.success(`${emp?.first_name} ${emp?.last_name} — hochgeladen`);
    } catch {
      toast.error("Fehler beim Hochladen");
    } finally {
      setUploadingFor(null);
    }
  }

  async function uploadSingle() {
    if (!singleFileRef.current?.files?.[0] || !singleEmployee || !singleTitle.trim()) {
      toast.error("Alle Felder ausfüllen");
      return;
    }
    const file = singleFileRef.current.files[0];
    setSingleUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const storagePath = `${singleEmployee}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, file);
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("documents").insert({
        employee_id: singleEmployee,
        title: singleTitle,
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        tags: [singleDocType],
        visible_to_employee: true,
        uploaded_by: user!.id,
        uploaded_at: new Date().toISOString(),
        version: 1,
        is_current_version: true,
      });
      if (insertError) throw insertError;
      qc.invalidateQueries({ queryKey: ["all-docs-admin"] });
      toast.success("Dokument hochgeladen");
      setSingleTitle("");
      if (singleFileRef.current) singleFileRef.current.value = "";
    } catch {
      toast.error("Fehler beim Hochladen");
    } finally {
      setSingleUploading(false);
    }
  }

  async function toggleVisibility(doc: Document) {
    const { error } = await supabase.from("documents").update({ visible_to_employee: !doc.visible_to_employee }).eq("id", doc.id);
    if (error) { toast.error("Fehler"); return; }
    qc.invalidateQueries({ queryKey: ["all-docs-admin"] });
    toast.success(doc.visible_to_employee ? "Ausgeblendet" : "Freigegeben");
  }

  async function bulkToggle(visible: boolean) {
    const ids = monthDocs.map(d => d.id);
    if (!ids.length) { toast.error("Keine Lohnzettel für diesen Monat hochgeladen"); return; }
    const { error } = await supabase.from("documents").update({ visible_to_employee: visible }).in("id", ids);
    if (error) { toast.error("Fehler"); return; }
    qc.invalidateQueries({ queryKey: ["all-docs-admin"] });
    toast.success(visible ? `${ids.length} Lohnzettel freigegeben` : `${ids.length} ausgeblendet`);
  }

  async function handleDelete(doc: Document) {
    try {
      await supabase.storage.from("documents").remove([doc.storage_path]);
      await supabase.from("documents").update({ deleted_at: new Date().toISOString() }).eq("id", doc.id);
      qc.invalidateQueries({ queryKey: ["all-docs-admin"] });
      toast.success("Gelöscht");
    } catch {
      toast.error("Fehler beim Löschen");
    }
  }

  const inp = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dokumente</h1>
        <p className="mt-0.5 text-sm text-gray-500">Lohnzettel, Verträge und Unterlagen verwalten</p>
      </div>

      <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 w-fit">
        <TabBtn active={tab === "payslips"} onClick={() => setTab("payslips")}>Lohnzettel-Workflow</TabBtn>
        <TabBtn active={tab === "all"} onClick={() => setTab("all")}>Alle Dokumente</TabBtn>
      </div>

      {/* ======= TAB: LOHNZETTEL-WORKFLOW ======= */}
      {tab === "payslips" && (
        <>
          {/* Month selector + stats + bulk actions */}
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Monat</label>
              <input type="month" value={payslipMonth} onChange={e => setPayslipMonth(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none" />
            </div>
            <div className="ml-auto flex items-center gap-8 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {uploadedCount}<span className="text-sm font-normal text-gray-400">/{employees.length}</span>
                </p>
                <p className="text-xs text-gray-500">hochgeladen</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#4F772D]">{publishedCount}</p>
                <p className="text-xs text-gray-500">freigegeben</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => bulkToggle(false)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition">
                <EyeOff className="h-3.5 w-3.5" strokeWidth={1.5} />Alle ausblenden
              </button>
              <button onClick={() => bulkToggle(true)}
                className="flex items-center gap-1.5 rounded-lg bg-[#4F772D] px-3 py-2 text-xs font-medium text-white hover:bg-[#31572C] transition">
                <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />Alle freigeben
              </button>
            </div>
          </div>

          {/* Employee list */}
          <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-50">
            {employees.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-gray-400">Keine aktiven Mitarbeiter</p>
            )}
            {employees.map(emp => {
              const doc = payslipMap.get(emp.id);
              const isUploading = uploadingFor === emp.id;
              return (
                <div key={emp.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4F772D]/10 text-xs font-bold text-[#4F772D]">
                    {emp.first_name[0]}{emp.last_name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{emp.first_name} {emp.last_name}</p>
                    {doc && (
                      <p className="text-xs text-gray-400">
                        {format(parseISO(doc.uploaded_at), "d. MMM yyyy", { locale: de })}
                        {doc.file_size && <span className="ml-2">{formatBytes(doc.file_size)}</span>}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {doc ? (
                      <>
                        <span className="flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                          <CheckCircle2 className="h-3 w-3" strokeWidth={2} />Hochgeladen
                        </span>
                        <button onClick={() => toggleVisibility(doc)}
                          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                            doc.visible_to_employee
                              ? "border-[#4F772D]/30 bg-[#4F772D]/5 text-[#4F772D] hover:bg-[#4F772D]/10"
                              : "border-gray-200 text-gray-500 hover:bg-gray-50"
                          }`}>
                          {doc.visible_to_employee
                            ? <Eye className="h-3 w-3" strokeWidth={1.5} />
                            : <EyeOff className="h-3 w-3" strokeWidth={1.5} />}
                          {doc.visible_to_employee ? "Sichtbar" : "Ausgeblendet"}
                        </button>
                        <a href={downloadUrl(doc.storage_path)} target="_blank" rel="noreferrer"
                          className="flex items-center justify-center rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition">
                          <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </a>
                        <button onClick={() => handleDelete(doc)}
                          className="flex items-center justify-center rounded-lg border border-red-100 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 transition">
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                      </>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                        <AlertCircle className="h-3 w-3" strokeWidth={2} />Fehlt
                      </span>
                    )}
                    <input
                      ref={el => { fileRefs.current[emp.id] = el; }}
                      type="file" accept=".pdf,image/*" className="hidden"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (file) await uploadPayslip(emp.id, file);
                        e.target.value = "";
                      }}
                    />
                    <button disabled={isUploading} onClick={() => fileRefs.current[emp.id]?.click()}
                      className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50 transition">
                      <Upload className="h-3 w-3" strokeWidth={1.5} />
                      {isUploading ? "…" : doc ? "Ersetzen" : "Upload"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Single upload: Vertrag / Sonstiges */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Vertrag / Sonstiges hochladen</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Mitarbeiter</label>
                <select value={singleEmployee} onChange={e => setSingleEmployee(e.target.value)} className={inp}>
                  <option value="">Auswählen…</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Typ</label>
                <select value={singleDocType} onChange={e => setSingleDocType(e.target.value as typeof singleDocType)} className={inp}>
                  <option value="contract">Vertrag</option>
                  <option value="other">Sonstiges</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Titel</label>
                <input value={singleTitle} onChange={e => setSingleTitle(e.target.value)} placeholder="z.B. Arbeitsvertrag 2025" className={inp} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Datei</label>
                <input ref={singleFileRef} type="file" accept=".pdf,image/*"
                  className="w-full text-xs text-gray-500 file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1.5 file:text-xs file:font-medium file:text-gray-600 hover:file:bg-gray-200" />
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={uploadSingle} disabled={singleUploading}
                className="flex items-center gap-2 rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60 transition">
                <Upload className="h-4 w-4" strokeWidth={1.5} />
                {singleUploading ? "Lädt…" : "Hochladen"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ======= TAB: ALLE DOKUMENTE ======= */}
      {tab === "all" && (
        <div className="rounded-xl border border-gray-200 bg-white">
          {/* Filter row */}
          <div className="border-b border-gray-100 px-5 py-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
              <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(0); }} placeholder="Name oder Titel…"
                className="w-full rounded-lg border border-gray-200 pl-8 pr-3 py-1.5 text-sm focus:border-[#4F772D] focus:outline-none" />
            </div>
            <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value as typeof typeFilter); setPage(0); }}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-[#4F772D] focus:outline-none">
              <option value="all">Alle Typen</option>
              <option value="payslip">Lohnzettel</option>
              <option value="contract">Vertrag</option>
              <option value="other">Sonstiges</option>
            </select>
            <select value={empFilter} onChange={e => { setEmpFilter(e.target.value); setPage(0); }}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-[#4F772D] focus:outline-none">
              <option value="">Alle Mitarbeiter</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
            </select>
            <span className="text-xs text-gray-400 ml-auto">{filteredDocs.length} Dokumente</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-50">
            {isLoading ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">Wird geladen…</p>
            ) : pagedDocs.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">Keine Dokumente gefunden</p>
            ) : pagedDocs.map(doc => {
              const emp = employees.find(e => e.id === doc.employee_id);
              const docType = doc.tags?.find(t => ["payslip", "contract", "other"].includes(t));
              return (
                <div key={doc.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50">
                    <FileText className="h-4 w-4 text-red-400" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                    <p className="text-xs text-gray-400">
                      {emp ? `${emp.first_name} ${emp.last_name}` : "—"}
                      {" · "}{format(parseISO(doc.uploaded_at), "d. MMM yyyy", { locale: de })}
                      {doc.file_size && <span className="ml-2 text-gray-300">{formatBytes(doc.file_size)}</span>}
                    </p>
                  </div>
                  {docType && (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      docType === "payslip" ? "bg-blue-50 text-blue-600" :
                      docType === "contract" ? "bg-purple-50 text-purple-600" : "bg-gray-100 text-gray-600"
                    }`}>{typeLabels[docType] ?? docType}</span>
                  )}
                  <button onClick={() => toggleVisibility(doc)}
                    title={doc.visible_to_employee ? "Klicken zum Ausblenden" : "Klicken zum Freigeben"}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                      doc.visible_to_employee
                        ? "border-[#4F772D]/30 bg-[#4F772D]/5 text-[#4F772D] hover:bg-[#4F772D]/10"
                        : "border-gray-200 text-gray-400 hover:bg-gray-50"
                    }`}>
                    {doc.visible_to_employee
                      ? <Eye className="h-3 w-3" strokeWidth={1.5} />
                      : <EyeOff className="h-3 w-3" strokeWidth={1.5} />}
                    {doc.visible_to_employee ? "Sichtbar" : "Versteckt"}
                  </button>
                  <a href={downloadUrl(doc.storage_path)} target="_blank" rel="noreferrer"
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-50 transition">
                    <Download className="h-3 w-3" strokeWidth={1.5} />Download
                  </a>
                  <button onClick={() => handleDelete(doc)}
                    className="flex shrink-0 items-center justify-center rounded-lg border border-red-100 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 transition">
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-400">Seite {page + 1} von {totalPages}</span>
              <div className="flex gap-2">
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                  className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50 disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
                </button>
                <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                  className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50 disabled:opacity-40">
                  <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
