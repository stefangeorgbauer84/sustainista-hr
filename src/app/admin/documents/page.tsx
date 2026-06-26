"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Employee, Document } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { useState, useRef } from "react";
import { Upload, FileText, Download, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

const typeLabels: Record<string, string> = {
  payslip: "Lohnzettel",
  contract: "Vertrag",
  other: "Sonstiges",
};

export default function AdminDocumentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [docType, setDocType] = useState<"payslip" | "contract" | "other">("payslip");
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [uploading, setUploading] = useState(false);

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["all-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("is_active", true)
        .order("last_name")
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: docs = [], isLoading } = useQuery<Document[]>({
    queryKey: ["all-docs", selectedEmployee],
    queryFn: async () => {
      let query = supabase
        .from("documents")
        .select("*")
        .is("deleted_at", null)
        .order("uploaded_at", { ascending: false })
        .limit(100);
      if (selectedEmployee) {
        query = query.eq("employee_id", selectedEmployee);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  async function handleUpload() {
    if (!fileRef.current?.files?.[0] || !selectedEmployee) {
      toast.error("Bitte Mitarbeiter und Datei auswählen");
      return;
    }
    const file = fileRef.current.files[0];
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const storagePath = `${selectedEmployee}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, file);
      if (uploadError) throw uploadError;

      const emp = employees.find(e => e.id === selectedEmployee);
      const title = docType === "payslip"
        ? `Lohnzettel ${month}`
        : `${typeLabels[docType]} — ${emp?.first_name} ${emp?.last_name}`;

      const { error: insertError } = await supabase.from("documents").insert({
        employee_id: selectedEmployee,
        title,
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        tags: [docType, ...(docType === "payslip" ? [month] : [])],
        visible_to_employee: true,
        uploaded_by: user!.id,
        uploaded_at: new Date().toISOString(),
        version: 1,
        is_current_version: true,
      });
      if (insertError) throw insertError;

      qc.invalidateQueries({ queryKey: ["all-docs"] });
      toast.success("Dokument hochgeladen");
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      toast.error("Fehler beim Hochladen");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: Document) {
    try {
      const { error: storageError } = await supabase.storage
        .from("documents")
        .remove([doc.storage_path]);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("documents")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", doc.id);
      if (dbError) throw dbError;

      qc.invalidateQueries({ queryKey: ["all-docs"] });
      toast.success("Gelöscht");
    } catch {
      toast.error("Fehler beim Löschen");
    }
  }

  function downloadUrl(storagePath: string) {
    const { data } = supabase.storage.from("documents").getPublicUrl(storagePath);
    return data.publicUrl;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dokumente</h1>
        <p className="mt-0.5 text-sm text-gray-500">Lohnzettel und Verträge hochladen</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Dokument hochladen</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Mitarbeiter</label>
            <select
              value={selectedEmployee}
              onChange={e => setSelectedEmployee(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none"
            >
              <option value="">Auswählen…</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Typ</label>
            <select
              value={docType}
              onChange={e => setDocType(e.target.value as typeof docType)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none"
            >
              <option value="payslip">Lohnzettel</option>
              <option value="contract">Vertrag</option>
              <option value="other">Sonstiges</option>
            </select>
          </div>
          {docType === "payslip" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Monat</label>
              <input
                type="month"
                value={month}
                onChange={e => setMonth(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none"
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" accept=".pdf,image/*" className="text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-[#4F772D]/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[#4F772D]" />
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex items-center gap-2 rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60 transition"
          >
            <Upload className="h-4 w-4" strokeWidth={1.5} />
            {uploading ? "Lädt hoch…" : "Hochladen"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
            <h2 className="text-sm font-medium text-gray-900">Alle Dokumente</h2>
          </div>
          <select
            value={selectedEmployee}
            onChange={e => setSelectedEmployee(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 focus:border-[#4F772D] focus:outline-none"
          >
            <option value="">Alle Mitarbeiter</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
            ))}
          </select>
        </div>
        <div className="divide-y divide-gray-50">
          {isLoading ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">Wird geladen…</p>
          ) : docs.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">Noch keine Dokumente</p>
          ) : (
            docs.map(doc => {
              const emp = employees.find(e => e.id === doc.employee_id);
              return (
                <div key={doc.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-500">
                      <FileText className="h-4 w-4" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{doc.title}</p>
                      <p className="text-xs text-gray-400">
                        {emp ? `${emp.first_name} ${emp.last_name}` : "—"} ·{" "}
                        {format(parseISO(doc.uploaded_at), "d. MMM yyyy", { locale: de })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={downloadUrl(doc.storage_path)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition"
                    >
                      <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Download
                    </a>
                    <button
                      onClick={() => handleDelete(doc)}
                      className="flex items-center gap-1.5 rounded-lg border border-red-100 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
