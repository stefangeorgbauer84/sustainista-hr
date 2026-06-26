"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Lightbulb, Plus, X, CheckCircle, ArrowRight, XCircle } from "lucide-react";

const CATEGORIES = ["Prozess", "Produkt", "Kultur", "Tooling", "Kommunikation", "Nachhaltigkeit", "Sonstiges"];

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open: { label: "Offen", color: "bg-blue-100 text-blue-700", icon: <Lightbulb className="h-3 w-3" strokeWidth={1.5} /> },
  "in-progress": { label: "In Umsetzung", color: "bg-amber-100 text-amber-700", icon: <ArrowRight className="h-3 w-3" strokeWidth={1.5} /> },
  done: { label: "Umgesetzt", color: "bg-green-100 text-green-700", icon: <CheckCircle className="h-3 w-3" strokeWidth={1.5} /> },
  declined: { label: "Abgelehnt", color: "bg-gray-100 text-gray-500", icon: <XCircle className="h-3 w-3" strokeWidth={1.5} /> },
};

type KaizenRow = {
  id: string;
  employee_id: string;
  title: string;
  description: string;
  category: string | null;
  status: string;
  admin_comment: string | null;
  upvotes: number;
  created_at: string;
  employees: { first_name: string; last_name: string } | null;
};

const inp = "w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-[#4F772D] focus:outline-none focus:ring-2 focus:ring-[#4F772D]/20";

export default function KaizenPage() {
  const { employee, isAdminUser } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const { data: items = [], isLoading } = useQuery<KaizenRow[]>({
    queryKey: ["kaizen"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kaizen_items")
        .select("*, employees(first_name, last_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as KaizenRow[];
    },
    enabled: !!employee,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !description.trim()) throw new Error("Titel und Beschreibung erforderlich");
      const { error } = await supabase.from("kaizen_items").insert({
        employee_id: employee!.id,
        title: title.trim(),
        description: description.trim(),
        category: category || null,
        status: "open",
        upvotes: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kaizen"] });
      toast.success("Verbesserungsvorschlag eingereicht!");
      setTitle(""); setDescription(""); setCategory(""); setShowForm(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, admin_comment }: { id: string; status: string; admin_comment?: string }) => {
      const { error } = await supabase
        .from("kaizen_items")
        .update({ status, ...(admin_comment !== undefined ? { admin_comment } : {}) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kaizen"] });
      toast.success("Status aktualisiert");
    },
  });

  const filtered = filter === "all" ? items : items.filter(i => i.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Kaizen-Board</h1>
          <p className="mt-0.5 text-sm text-gray-500">Kontinuierliche Verbesserung — jede Idee zählt</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] transition"
        >
          {showForm ? <X className="h-4 w-4" strokeWidth={1.5} /> : <Plus className="h-4 w-4" strokeWidth={1.5} />}
          Idee einreichen
        </button>
      </div>

      <div className="rounded-xl bg-amber-50 border border-amber-100 px-5 py-4 flex gap-4">
        <Lightbulb className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
        <div>
          <p className="text-sm font-semibold text-amber-800">Kaizen — 改善 — "Veränderung zum Besseren"</p>
          <p className="mt-1 text-xs text-amber-700 leading-relaxed">
            Aus dem Lean Thinking: Jeder im Team ist Experte für seinen Bereich. Kleine kontinuierliche Verbesserungen
            summieren sich zu großem Wandel. Kein Vorschlag ist zu klein.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {(["open", "in-progress", "done", "declined"] as const).map(s => {
          const count = items.filter(i => i.status === s).length;
          const info = STATUS_MAP[s];
          return (
            <button key={s} onClick={() => setFilter(filter === s ? "all" : s)}
              className={`rounded-xl border p-4 text-left transition ${filter === s ? "border-[#4F772D] bg-[#4F772D]/5" : "border-gray-200 bg-white hover:border-gray-300"}`}>
              <p className="text-2xl font-bold text-gray-900">{count}</p>
              <div className="mt-1 flex items-center gap-1">
                <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${info.color}`}>
                  {info.icon}{info.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Neuer Verbesserungsvorschlag</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Titel</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className={inp} placeholder="z.B. Bessere Meeting-Kultur durch 25-Min-Slots" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Beschreibung</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className={`${inp} resize-none`}
                placeholder="Was ist das Problem? Was schlägst du vor? Welchen Nutzen siehst du?" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Kategorie</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => (
                  <button key={c} type="button" onClick={() => setCategory(category === c ? "" : c)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${category === c ? "bg-[#4F772D] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Abbrechen</button>
              <button onClick={() => addMutation.mutate()} disabled={!title.trim() || !description.trim() || addMutation.isPending}
                className="rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60">
                {addMutation.isPending ? "Einreichen…" : "Einreichen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-center text-sm text-gray-400 py-8">Wird geladen…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center">
          <Lightbulb className="mx-auto h-10 w-10 text-gray-300 mb-3" strokeWidth={1.5} />
          <p className="text-sm text-gray-500">Noch keine Vorschläge</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const info = STATUS_MAP[item.status ?? "open"] ?? STATUS_MAP.open;
            const isOwn = item.employee_id === employee?.id;
            const empName = item.employees
              ? `${item.employees.first_name} ${item.employees.last_name}`
              : "Unbekannt";
            return (
              <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${info.color}`}>
                        {info.icon}{info.label}
                      </span>
                      {item.category && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">{item.category}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
                    {item.admin_comment && (
                      <div className="mt-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
                        <span className="font-medium">Admin-Feedback:</span> {item.admin_comment}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-xs text-gray-400">
                        {empName} · {format(parseISO(item.created_at), "d. MMM", { locale: de })}
                      </span>
                      {isOwn && <span className="rounded-full bg-[#4F772D]/10 px-2 py-0.5 text-[10px] text-[#4F772D] font-medium">Mein Vorschlag</span>}
                    </div>
                  </div>
                </div>
                {isAdminUser && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                    {(["open", "in-progress", "done", "declined"] as const).map(s => (
                      <button key={s} onClick={() => statusMutation.mutate({ id: item.id, status: s })}
                        disabled={item.status === s}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          item.status === s ? STATUS_MAP[s].color : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        } disabled:cursor-default`}>
                        {STATUS_MAP[s].label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
