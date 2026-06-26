"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Employee } from "@/types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Pencil, Users, Mail, Phone, Calendar, Eye } from "lucide-react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { useAuth } from "@/context/AuthContext";

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

export default function EmployeesPage() {
  const qc = useQueryClient();
  const { isSuperAdmin, isAdminUser, viewAs } = useAuth();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["all-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees").select("*").eq("is_active", true)
        .order("last_name", { ascending: true }).limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Employee[];
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { hours_per_week: 38.5, employment_type: "vollzeit" },
  });

  function openEdit(emp: Employee) {
    setEditing(emp);
    reset({
      first_name: emp.first_name,
      last_name: emp.last_name,
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
        first_name: data.first_name,
        last_name: data.last_name,
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
        const { error } = await supabase.from("employees").insert({ ...payload, employment_percentage: 100, contract_type: "unbefristet" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-employees"] });
      toast.success(editing ? "Gespeichert" : "Mitarbeiter angelegt");
      setShowForm(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message ?? "Fehler beim Speichern"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Mitarbeiter</h1>
          <p className="mt-0.5 text-sm text-gray-500">{employees.length} aktive Mitarbeiter</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] transition">
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          Mitarbeiter anlegen
        </button>
      </div>

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
              <input {...register("contact_email")} type="email" className={inputCls} placeholder="m.muster@beispiel.at" />
            </Field>
            <Field label="Telefon">
              <input {...register("contact_phone")} className={inputCls} placeholder="+43 664 123 456" />
            </Field>
            <Field label="Eintrittsdatum" error={errors.entry_date?.message}>
              <input {...register("entry_date")} type="date" className={inputCls} />
            </Field>
            <Field label="Beschäftigungsart">
              <select {...register("employment_type")} className={inputCls}>
                <option value="vollzeit">Vollzeit</option>
                <option value="teilzeit">Teilzeit</option>
                <option value="geringfuegig">Geringfügig</option>
                <option value="lehrling">Lehrling</option>
                <option value="freier_dienstnehmer">Freier Dienstnehmer</option>
                <option value="praktikant">Praktikant</option>
                <option value="werkvertrag">Werkvertrag</option>
              </select>
            </Field>
            <Field label="Stunden/Woche" error={errors.hours_per_week?.message}>
              <input {...register("hours_per_week", { valueAsNumber: true })} type="number" step="0.5" className={inputCls} />
            </Field>
            <div className="col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Abbrechen
              </button>
              <button type="submit" disabled={saveMutation.isPending} className="rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60">
                {saveMutation.isPending ? "Speichert…" : "Speichern"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
          <h2 className="text-sm font-medium text-gray-900">Alle Mitarbeiter</h2>
        </div>
        {isLoading ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">Wird geladen…</p>
        ) : employees.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">Noch keine Mitarbeiter angelegt</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {employees.map(emp => (
              <div key={emp.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#4F772D]/10 text-sm font-semibold text-[#4F772D]">
                    {emp.first_name[0]}{emp.last_name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{emp.first_name} {emp.last_name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {emp.contact_email && <span className="flex items-center gap-1 text-xs text-gray-400"><Mail className="h-3 w-3" strokeWidth={1.5} />{emp.contact_email}</span>}
                      {emp.contact_phone && <span className="flex items-center gap-1 text-xs text-gray-400"><Phone className="h-3 w-3" strokeWidth={1.5} />{emp.contact_phone}</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{emp.employment_type} · {emp.hours_per_week}h/Woche</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      <Calendar className="h-3 w-3 text-gray-300" strokeWidth={1.5} />
                      <span className="text-[10px] text-gray-400">
                        seit {format(parseISO(emp.entry_date), "MMM yyyy", { locale: de })}
                      </span>
                    </div>
                  </div>
                  {isAdminUser && (
                    <button
                      onClick={() => { viewAs(emp); router.push("/dashboard"); }}
                      className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition"
                      title="Dashboard aus Sicht dieses Mitarbeiters anzeigen"
                    >
                      <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Ansicht
                    </button>
                  )}
                  <Link href={`/admin/employees/${emp.id}`}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition">
                    Details →
                  </Link>
                  <button onClick={() => openEdit(emp)}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition">
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Bearbeiten
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none focus:ring-2 focus:ring-[#4F772D]/20";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
