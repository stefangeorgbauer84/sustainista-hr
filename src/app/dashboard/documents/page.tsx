"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Document } from "@/types";
import { FileText, Download, AlertCircle } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { de } from "date-fns/locale";
import { useState } from "react";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const { employee } = useAuth();
  const [yearFilter, setYearFilter] = useState<number | "all">("all");

  const { data: docs = [], isLoading } = useQuery<Document[]>({
    queryKey: ["my-docs", employee?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("employee_id", employee!.id)
        .eq("visible_to_employee", true)
        .eq("is_current_version", true)
        .is("deleted_at", null)
        .order("uploaded_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!employee,
  });

  function downloadUrl(storagePath: string) {
    const { data } = supabase.storage.from("documents").getPublicUrl(storagePath);
    return data.publicUrl;
  }

  const availableYears = [...new Set(docs.map(d => new Date(d.uploaded_at).getFullYear()))].sort((a, b) => b - a);
  const filtered = yearFilter === "all" ? docs : docs.filter(d => new Date(d.uploaded_at).getFullYear() === yearFilter);
  const payslips = filtered.filter(d => d.tags?.includes("payslip"));
  const others = filtered.filter(d => !d.tags?.includes("payslip"));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Meine Dokumente</h1>
          <p className="mt-0.5 text-sm text-gray-500">Lohnzettel, Verträge und weitere Unterlagen</p>
        </div>
        {availableYears.length > 1 && (
          <select
            value={yearFilter}
            onChange={e => setYearFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#4F772D] focus:outline-none"
          >
            <option value="all">Alle Jahre</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>

      <DocSection title="Lohnzettel" docs={payslips} loading={isLoading} downloadUrl={downloadUrl} />
      <DocSection title="Verträge & Sonstiges" docs={others} loading={isLoading} downloadUrl={downloadUrl} />
    </div>
  );
}

function DocSection({ title, docs, loading, downloadUrl }: {
  title: string; docs: Document[]; loading: boolean;
  downloadUrl: (storagePath: string) => string;
}) {
  const today = new Date();
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-2">
        <FileText className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
        <h2 className="text-sm font-medium text-gray-900">{title}</h2>
        <span className="ml-auto text-xs text-gray-400">{docs.length} Dateien</span>
      </div>
      <div className="divide-y divide-gray-50">
        {loading ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">Wird geladen…</p>
        ) : docs.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">Noch keine Dokumente verfügbar</p>
        ) : docs.map(doc => {
          const daysLeft = doc.expires_at ? differenceInDays(new Date(doc.expires_at), today) : null;
          const expiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
          const expired = daysLeft !== null && daysLeft < 0;
          return (
            <div key={doc.id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${expired ? "bg-red-100" : "bg-red-50"}`}>
                  <FileText className={`h-4 w-4 ${expired ? "text-red-500" : "text-red-400"}`} strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                    {expiringSoon && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 shrink-0">
                        <AlertCircle className="h-3 w-3" strokeWidth={1.5} />
                        Läuft ab in {daysLeft}d
                      </span>
                    )}
                    {expired && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-600 shrink-0">Abgelaufen</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {format(parseISO(doc.uploaded_at), "d. MMMM yyyy", { locale: de })}
                    {doc.file_size && (
                      <span className="ml-2 text-gray-300">
                        {doc.file_size < 1024 * 1024
                          ? `${(doc.file_size / 1024).toFixed(0)} KB`
                          : `${(doc.file_size / (1024 * 1024)).toFixed(1)} MB`}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <a href={downloadUrl(doc.storage_path)} target="_blank" rel="noreferrer"
                className="ml-3 flex shrink-0 items-center gap-1.5 rounded-lg bg-[#4F772D]/10 px-3 py-1.5 text-xs font-medium text-[#4F772D] hover:bg-[#4F772D]/20 transition">
                <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                Download
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
