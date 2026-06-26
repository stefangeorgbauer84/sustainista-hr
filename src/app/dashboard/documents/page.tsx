"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Document } from "@/types";
import { FileText, Download } from "lucide-react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

const typeLabels: Record<string, string> = {
  payslip: "Lohnzettel",
  contract: "Vertrag",
  other: "Sonstiges",
};

export default function DocumentsPage() {
  const { employee } = useAuth();

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

  const payslips = docs.filter(d => d.category_id === "payslip" || d.tags?.includes("payslip"));
  const others = docs.filter(d => d.category_id !== "payslip" && !d.tags?.includes("payslip"));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Meine Dokumente</h1>
        <p className="mt-0.5 text-sm text-gray-500">Lohnzettel, Verträge und weitere Unterlagen</p>
      </div>

      <DocSection title="Lohnzettel" docs={payslips} loading={isLoading} downloadUrl={downloadUrl} />
      <DocSection title="Verträge & Sonstiges" docs={others} loading={isLoading} downloadUrl={downloadUrl} />
    </div>
  );
}

function DocSection({ title, docs, loading, downloadUrl }: {
  title: string;
  docs: Document[];
  loading: boolean;
  downloadUrl: (storagePath: string) => string;
}) {
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
        ) : (
          docs.map(doc => (
            <div key={doc.id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50">
                  <FileText className="h-4 w-4 text-red-400" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{doc.title}</p>
                  <p className="text-xs text-gray-400">
                    {format(parseISO(doc.uploaded_at), "d. MMMM yyyy", { locale: de })}
                  </p>
                </div>
              </div>
              <a
                href={downloadUrl(doc.storage_path)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-[#4F772D]/10 px-3 py-1.5 text-xs font-medium text-[#4F772D] hover:bg-[#4F772D]/20 transition"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                Download
              </a>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
