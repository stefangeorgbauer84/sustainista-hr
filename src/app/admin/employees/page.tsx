"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { Query, ID } from "appwrite";
import type { Employee } from "@/types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, X, Pencil, Users, Mail, Phone, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["admin", "employee"]),
  department: z.string().min(1),
  position: z.string().min(1),
  startDate: z.string().min(1),
  vacationDaysTotal: z.number().min(0).max(365),
  vacationDaysUsed: z.number().min(0).max(365),
  phone: z.string().optional(),
  address: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function EmployeesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["all-employees"],
    queryFn: async () => {
      const res = await databases.listDocuments(DB_ID, COLLECTIONS.EMPLOYEES, [
        Query.orderAsc("lastName"), Query.limit(100),
      ]);
      return res.documents as unknown as Employee[];
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { vacationDaysTotal: 25, vacationDaysUsed: 0, role: "employee" },
  });

  function openEdit(emp: Employee) {
    setEditing(emp);
    reset({
      firstName: emp.firstName, lastName: emp.lastName, email: emp.email,
      role: emp.role, department: emp.department, position: emp.position,
      startDate: emp.startDate, vacationDaysTotal: emp.vacationDaysTotal,
      vacationDaysUsed: emp.vacationDaysUsed, phone: emp.phone ?? "",
      address: emp.address ?? "",
    });
    setShowForm(true);
  }

  function openNew() {
    setEditing(null);
    reset({ vacationDaysTotal: 25, vacationDaysUsed: 0, role: "employee" });
    setShowForm(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (editing) {
        return databases.updateDocument(DB_ID, COLLECTIONS.EMPLOYEES, editing.$id, data);
      }
      return databases.createDocument(DB_ID, COLLECTIONS.EMPLOYEES, ID.unique(), {
        ...data, userId: "pending",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-employees"] });
      toast.success(editing ? "Gespeichert" : "Mitarbeiter angelegt");
      setShowForm(false);
      setEditing(null);
    },
    onError: () => toast.error("Fehler beim Speichern"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Mitarbeiter</h1>
          <p className="mt-0.5 text-sm text-gray-500">{employees.length} aktive Mitarbeiter</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] transition"
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          Mitarbeiter anlegen
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              {editing ? `${editing.firstName} ${editing.lastName} bearbeiten` : "Neuer Mitarbeiter"}
            </h2>
            <button onClick={() => setShowForm(false)}>
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" strokeWidth={1.5} />
            </button>
          </div>
          <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="grid grid-cols-2 gap-4">
            <Field label="Vorname" error={errors.firstName?.message}>
              <input {...register("firstName")} className={inputCls} placeholder="Maria" />
            </Field>
            <Field label="Nachname" error={errors.lastName?.message}>
              <input {...register("lastName")} className={inputCls} placeholder="Muster" />
            </Field>
            <Field label="E-Mail" error={errors.email?.message}>
              <input {...register("email")} type="email" className={inputCls} placeholder="m.muster@sustainista.net" />
            </Field>
            <Field label="Telefon">
              <input {...register("phone")} className={inputCls} placeholder="+43 664 123 456" />
            </Field>
            <Field label="Abteilung" error={errors.department?.message}>
              <input {...register("department")} className={inputCls} placeholder="Marketing" />
            </Field>
            <Field label="Position" error={errors.position?.message}>
              <input {...register("position")} className={inputCls} placeholder="Junior Consultant" />
            </Field>
            <Field label="Eintrittsdatum" error={errors.startDate?.message}>
              <input {...register("startDate")} type="date" className={inputCls} />
            </Field>
            <Field label="Rolle">
              <select {...register("role")} className={inputCls}>
                <option value="employee">Mitarbeiter</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <Field label="Urlaubstage gesamt" error={errors.vacationDaysTotal?.message}>
              <input {...register("vacationDaysTotal", { valueAsNumber: true })} type="number" className={inputCls} />
            </Field>
            <Field label="Urlaubstage verbraucht" error={errors.vacationDaysUsed?.message}>
              <input {...register("vacationDaysUsed", { valueAsNumber: true })} type="number" className={inputCls} />
            </Field>
            <div className="col-span-2">
              <Field label="Adresse">
                <input {...register("address")} className={inputCls} placeholder="Musterstraße 1, 1010 Wien" />
              </Field>
            </div>
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
              <div key={emp.$id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#4F772D]/10 text-sm font-semibold text-[#4F772D]">
                    {emp.firstName[0]}{emp.lastName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{emp.firstName} {emp.lastName}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Mail className="h-3 w-3" strokeWidth={1.5} />{emp.email}
                      </span>
                      {emp.phone && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Phone className="h-3 w-3" strokeWidth={1.5} />{emp.phone}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{emp.position} · {emp.department}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {emp.vacationDaysTotal - emp.vacationDaysUsed}/{emp.vacationDaysTotal} Urlaubstage
                    </p>
                    <div className="flex items-center gap-1.5 justify-end mt-0.5">
                      <Calendar className="h-3 w-3 text-gray-300" strokeWidth={1.5} />
                      <span className="text-[10px] text-gray-400">
                        seit {format(parseISO(emp.startDate), "MMM yyyy", { locale: de })}
                      </span>
                    </div>
                    <span className={`text-[10px] rounded-full px-2 py-0.5 ${emp.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                      {emp.role === "admin" ? "Admin" : "Mitarbeiter"}
                    </span>
                  </div>
                  <Link
                    href={`/admin/employees/${emp.$id}`}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition"
                  >
                    Details →
                  </Link>
                  <button
                    onClick={() => openEdit(emp)}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition"
                  >
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
