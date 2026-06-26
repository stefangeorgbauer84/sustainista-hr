"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Contract } from "@/types";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import DOMPurify from "dompurify";
import {
  FileText, Edit3, Download, Save, X, Eye, EyeOff, Pen,
} from "lucide-react";

function sanitize(html: string): string {
  if (typeof window === "undefined") return html;
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["style", "class", "width", "height", "align", "cellpadding", "cellspacing"],
  });
}

interface Props {
  employeeId: string;
  employeeName: string;
  companyId: string;
}

export function ContractSection({ employeeId, employeeName, companyId }: Props) {
  const qc = useQueryClient();

  const [mode, setMode] = useState<"view" | "edit">("view");
  const [showPreview, setShowPreview] = useState(false);
  const [title, setTitle] = useState("Arbeitsvertrag");
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploadingSig, setUploadingSig] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);

  const { data: contract, isLoading } = useQuery<Contract | null>({
    queryKey: ["contract", employeeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("contracts")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as Contract) ?? null;
    },
    enabled: !!employeeId,
  });

  useEffect(() => {
    async function loadSignature() {
      for (const ext of ["png", "jpg", "jpeg", "svg"]) {
        const path = `signatures/${companyId}.${ext}`;
        const { data } = supabase.storage.from("documents").getPublicUrl(path);
        try {
          const res = await fetch(data.publicUrl, { method: "HEAD" });
          if (res.ok) { setSignatureUrl(data.publicUrl); return; }
        } catch { /* not found */ }
      }
    }
    loadSignature();
  }, [companyId]);

  function startEdit() {
    setTitle(contract?.title ?? "Arbeitsvertrag");
    setMode("edit");
    setShowPreview(false);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = contract?.html_content ?? "";
        editorRef.current.focus();
      }
    }, 50);
  }

  function cancelEdit() {
    setMode("view");
    setShowPreview(false);
  }

  async function saveContract() {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML.trim();
    if (!html || html === "<br>") { toast.error("Kein Inhalt"); return; }
    setSaving(true);
    try {
      if (contract) {
        const { error } = await supabase.from("contracts").update({
          title,
          html_content: html,
          updated_at: new Date().toISOString(),
        }).eq("id", contract.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contracts").insert({
          company_id: companyId,
          employee_id: employeeId,
          title,
          html_content: html,
        });
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["contract", employeeId] });
      toast.success("Vertrag gespeichert");
      setMode("view");
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function uploadSignature(file: File) {
    setUploadingSig(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `signatures/${companyId}.${ext}`;
      const { error } = await supabase.storage
        .from("documents")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("documents").getPublicUrl(path);
      setSignatureUrl(data.publicUrl);
      toast.success("Unterschrift gespeichert");
    } catch {
      toast.error("Fehler beim Hochladen der Unterschrift");
    } finally {
      setUploadingSig(false);
    }
  }

  async function downloadPdf() {
    if (!contract?.html_content) return;
    setDownloading(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;

      const wrapper = document.createElement("div");
      wrapper.style.cssText =
        "font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.65; color: #1a1a1a;";
      wrapper.innerHTML = contract.html_content;

      const today = format(new Date(), "d. MMMM yyyy", { locale: de });
      const sigBlock = document.createElement("div");
      sigBlock.style.cssText = "margin-top: 56px; page-break-inside: avoid;";
      sigBlock.innerHTML = `
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="width:46%; padding-right:24px; vertical-align:bottom;">
              <p style="font-size:10pt; color:#555; margin:0 0 10px 0;">Wien, ${today}</p>
              ${
                signatureUrl
                  ? `<img src="${signatureUrl}" style="height:54px; display:block; margin-bottom:6px;" crossorigin="anonymous" />`
                  : `<div style="height:54px; margin-bottom:6px;"></div>`
              }
              <div style="border-top:1px solid #aaa; padding-top:4px;">
                <p style="font-size:9.5pt; color:#333; margin:0;">Arbeitgeber</p>
              </div>
            </td>
            <td style="width:46%; vertical-align:bottom;">
              <div style="height:54px; margin-bottom:6px;"></div>
              <div style="border-top:1px solid #aaa; padding-top:4px;">
                <p style="font-size:9.5pt; color:#333; margin:0;">${employeeName} (Arbeitnehmer/in)</p>
              </div>
            </td>
          </tr>
        </table>
      `;
      wrapper.appendChild(sigBlock);

      await html2pdf()
        .set({
          margin: [20, 20, 20, 20],
          filename: `Vertrag_${employeeName.replace(/ /g, "_")}.pdf`,
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pagebreak: { mode: ["avoid-all", "css"] } as any,
        } as any)
        .from(wrapper)
        .save();
    } catch {
      toast.error("Fehler beim PDF-Export");
    } finally {
      setDownloading(false);
    }
  }

  if (isLoading) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      {/* Header */}
      <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
          <h2 className="text-sm font-medium text-gray-900">Vertrag</h2>
          {contract && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
              Vorhanden
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Signature upload control */}
          <div className="flex items-center gap-1.5">
            {signatureUrl && (
              <img
                src={signatureUrl}
                alt="Unterschrift"
                className="h-7 rounded border border-gray-200 bg-gray-50 px-1 object-contain"
              />
            )}
            <input
              ref={sigInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadSignature(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => sigInputRef.current?.click()}
              disabled={uploadingSig}
              title={signatureUrl ? "Unterschrift ersetzen" : "Musterunterschrift hochladen"}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition"
            >
              <Pen className="h-3 w-3" strokeWidth={1.5} />
              {uploadingSig ? "…" : signatureUrl ? "Sig. ändern" : "Unterschrift hochladen"}
            </button>
          </div>

          {mode === "view" && contract && (
            <>
              <button
                onClick={downloadPdf}
                disabled={downloading}
                className="flex items-center gap-1.5 rounded-lg bg-[#4F772D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#31572C] disabled:opacity-60 transition"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                {downloading ? "Erstelle PDF…" : "Als PDF"}
              </button>
              <button
                onClick={startEdit}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                <Edit3 className="h-3.5 w-3.5" strokeWidth={1.5} />
                Bearbeiten
              </button>
            </>
          )}

          {mode === "view" && !contract && (
            <button
              onClick={startEdit}
              className="flex items-center gap-1.5 rounded-lg bg-[#4F772D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#31572C] transition"
            >
              <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
              Vertrag anlegen
            </button>
          )}
        </div>
      </div>

      {/* View — contract exists */}
      {mode === "view" && contract && (
        <div>
          <div className="flex items-center justify-between px-5 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">{contract.title}</p>
              <p className="text-xs text-gray-400">
                Aktualisiert: {format(new Date(contract.updated_at), "d. MMM yyyy", { locale: de })}
              </p>
            </div>
            <button
              onClick={() => setShowPreview((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition"
            >
              {showPreview
                ? <><EyeOff className="h-3.5 w-3.5" strokeWidth={1.5} /> Schließen</>
                : <><Eye className="h-3.5 w-3.5" strokeWidth={1.5} /> Vorschau</>}
            </button>
          </div>

          {showPreview && (
            <div className="border-t border-gray-100 px-6 py-5 max-h-[480px] overflow-y-auto">
              <div
                className="prose prose-sm max-w-none text-gray-800"
                dangerouslySetInnerHTML={{ __html: contract.html_content }}
              />
            </div>
          )}
        </div>
      )}

      {/* View — no contract */}
      {mode === "view" && !contract && (
        <p className="px-5 py-8 text-center text-xs text-gray-400">
          Noch kein Vertrag angelegt. Klicke auf &quot;Vertrag anlegen&quot; und füge den Inhalt aus Google Docs ein.
        </p>
      )}

      {/* Edit mode */}
      {mode === "edit" && (
        <div className="p-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Titel</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none"
              placeholder="z. B. Arbeitsvertrag"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-gray-700">
                Inhalt — aus Google Docs einfügen&nbsp;
                <span className="text-gray-400 font-normal">(⌘V / Strg+V)</span>
              </label>
              <button
                onClick={() => setShowPreview((v) => !v)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition"
              >
                {showPreview
                  ? <><EyeOff className="h-3 w-3" strokeWidth={1.5} /> Editor</>
                  : <><Eye className="h-3 w-3" strokeWidth={1.5} /> Vorschau</>}
              </button>
            </div>

            <div
              ref={editorRef}
              contentEditable={!showPreview}
              suppressContentEditableWarning
              className={`min-h-[360px] max-h-[560px] rounded-lg border px-4 py-3 text-sm overflow-y-auto focus:outline-none transition ${
                showPreview
                  ? "border-gray-200 bg-gray-50 text-gray-800"
                  : "border-gray-300 text-gray-800 focus:border-[#4F772D]"
              }`}
              style={{ lineHeight: "1.65" }}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={cancelEdit}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
              Abbrechen
            </button>
            <button
              onClick={saveContract}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60 transition"
            >
              <Save className="h-4 w-4" strokeWidth={1.5} />
              {saving ? "Speichert…" : "Speichern"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
