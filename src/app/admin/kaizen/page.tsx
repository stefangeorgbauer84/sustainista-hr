"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { databases, DB_ID } from "@/lib/appwrite";
import { PERF_COLLECTIONS } from "@/app/lib/collections";
import { Query } from "appwrite";
import type { KaizenItem } from "@/types";
import { toast } from "sonner";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Lightbulb, ArrowRight, CheckCircle, XCircle } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  open: { label: "Offen", color: "bg-blue-100 text-blue-700" },
  "in-progress": { label: "In Umsetzung", color: "bg-amber-100 text-amber-700" },
  done: { label: "Umgesetzt", color: "bg-green-100 text-green-700" },
  declined: { label: "Abgelehnt", color: "bg-gray-100 text-gray-500" },
};

export default function AdminKaizenPage() {
  const qc = useQueryClient();
  const [comment, setComment] = useState<Record<string, string>>({});

  const { data: items = [], isLoading } = useQuery<KaizenItem[]>({
    queryKey: ["kaizen"],
    queryFn: async () => {
      const res = await databases.listDocuments(DB_ID, PERF_COLLECTIONS.KAIZEN, [
        Query.orderDesc("$createdAt"), Query.limit(200),
      ]);
      return res.documents as unknown as KaizenItem[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, adminComment }: { id: string; status: string; adminComment?: string }) =>
      databases.updateDocument(DB_ID, PERF_COLLECTIONS.KAIZEN, id, {
        status,
        ...(adminComment !== undefined ? { adminComment } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kaizen"] });
      toast.success("Status aktualisiert");
    },
  });

  const open = items.filter(i => i.status === "open");
  const inProgress = items.filter(i => i.status === "in-progress");
  const done = items.filter(i => i.status === "done");
  const declined = items.filter(i => i.status === "declined");

  function ItemCard({ item }: { item: KaizenItem }) {
    const info = STATUS_MAP[item.status ?? "open"];
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
        <div>
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-sm font-semibold text-gray-900">{item.title}</p>
            <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${info.color}`}>{info.label}</span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">{item.description}</p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {item.category && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">{item.category}</span>}
            <span className="text-[10px] text-gray-400">{item.employeeName} · {format(parseISO(item.$createdAt), "d. MMM", { locale: de })}</span>
          </div>
        </div>

        {/* Comment */}
        <input
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-[#4F772D] focus:outline-none"
          placeholder="Feedback hinzufügen (optional)…"
          value={comment[item.$id] ?? item.adminComment ?? ""}
          onChange={e => setComment(p => ({ ...p, [item.$id]: e.target.value }))}
        />

        {/* Actions */}
        <div className="flex flex-wrap gap-1.5">
          {(["open", "in-progress", "done", "declined"] as const).map(s => (
            <button
              key={s}
              onClick={() => updateMutation.mutate({ id: item.$id, status: s, adminComment: comment[item.$id] ?? item.adminComment ?? "" })}
              disabled={item.status === s}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                item.status === s ? STATUS_MAP[s].color + " cursor-default" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {s === "done" && <CheckCircle className="h-3 w-3" strokeWidth={1.5} />}
              {s === "in-progress" && <ArrowRight className="h-3 w-3" strokeWidth={1.5} />}
              {s === "declined" && <XCircle className="h-3 w-3" strokeWidth={1.5} />}
              {STATUS_MAP[s].label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Kaizen-Board — Admin</h1>
        <p className="mt-0.5 text-sm text-gray-500">Alle Verbesserungsvorschläge verwalten und umsetzen</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {Object.entries({ open, "in-progress": inProgress, done, declined }).map(([key, arr]) => (
          <div key={key} className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{arr.length}</p>
            <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${STATUS_MAP[key]?.color ?? "text-gray-500"}`}>
              {STATUS_MAP[key]?.label ?? key}
            </span>
          </div>
        ))}
      </div>

      {isLoading ? (
        <p className="text-center text-sm text-gray-400 py-8">Wird geladen…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <Lightbulb className="mx-auto h-10 w-10 text-gray-300 mb-3" strokeWidth={1.5} />
          <p className="text-sm text-gray-400">Noch keine Vorschläge eingereicht</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map(item => <ItemCard key={item.$id} item={item} />)}
        </div>
      )}
    </div>
  );
}
