"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Employee, TimeRecord, Absence, Document, LeaveBalance } from "@/types";
import { calcWorkedMinutes, formatDuration } from "@/lib/time";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { use, useState, useMemo } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { canSeePfaendung, canSeeBrutto } from "@/lib/rbac";
import {
  ArrowLeft, Clock, Calendar, FileText,
  Mail, Phone, Building, CreditCard, Download,
  Pencil, X, Save, AlertTriangle, Baby, AlertCircle, ShieldOff,
} from "lucide-react";

const statusColors: Record<string, string> = {
  requested: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
};

type AbsenceWithType = Absence & { absence_types: { code: string; name: string } | null };

type CF = {
  brutto?: string;
  status?: string;
  notizen?: string;
  austritt_info?: string;
  naechste_gehaltsaenderung?: string;
  anrechnung_jahre?: string;
  kst_raw?: string;
  pfaendung?: string;
  pfaendung_betrag?: string;
  pfaendung_glaeubiger?: string;
};

type EditForm = {
  first_name: string;
  last_name: string;
  contact_email: string;
  contact_phone: string;
  employee_number: string;
  entry_date: string;
  employment_type: Employee["employment_type"];
  hours_per_week: number;
  kv_id: string;
  cost_center_id: string;
  bank_iban: string;
  cf_brutto: string;
  cf_status: string;
  cf_notizen: string;
  cf_austritt_info: string;
  cf_naechste_gehaltsaenderung: string;
  cf_anrechnung_jahre: string;
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  vollzeit: "Vollzeit", teilzeit: "Teilzeit", geringfuegig: "Geringfügig",
  lehrling: "Lehrling", freier_dienstnehmer: "Freier DN",
  praktikant: "Praktikant", werkvertrag: "Werkvertrag",
};

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none focus:ring-2 focus:ring-[#4F772D]/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}

function ReadRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1">
      <span className="w-44 shrink-0 text-xs text-gray-400">{label}</span>
      <span className="text-sm text-gray-800">{value || "—"}</span>
    </div>
  );
}

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, profile } = useAuth();
  const role = profile?.role;
  const showPfaendung = canSeePfaendung(role);
  const showBrutto = canSeeBrutto(role);
  const qc = useQueryClient();
  const now = new Date();
  const [editing, setEditing] = useState(false);

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

  const { data: employee, isLoading: empLoading } = useQuery<Employee>({
    queryKey: ["employee", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("id", id).single();
      if (error) throw error;
      return data as unknown as Employee;
    },
  });

  const { data: leaveBalance } = useQuery<LeaveBalance | null>({
    queryKey: ["leave-balance-detail", id, now.getFullYear()],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_balances").select("*").eq("employee_id", id).eq("year", now.getFullYear()).single();
      return data as LeaveBalance | null;
    },
    enabled: !!id,
  });

  const { data: timeEntries = [] } = useQuery<TimeRecord[]>({
    queryKey: ["time-entries-detail", id, now.getFullYear(), now.getMonth() + 1],
    queryFn: async () => {
      const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-31`;
      const { data, error } = await supabase
        .from("time_records").select("*").eq("employee_id", id)
        .gte("work_date", start).lte("work_date", end)
        .order("work_date", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as TimeRecord[];
    },
    enabled: !!id,
  });

  const { data: leaves = [] } = useQuery<AbsenceWithType[]>({
    queryKey: ["leaves-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("absences").select("*, absence_types(code, name)").eq("employee_id", id)
        .order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as AbsenceWithType[];
    },
    enabled: !!id,
  });

  const { data: docs = [] } = useQuery<Document[]>({
    queryKey: ["docs-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents").select("*").eq("employee_id", id)
        .order("uploaded_at", { ascending: false }).limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as Document[];
    },
    enabled: !!id,
  });

  const cf = useMemo<CF>(() => (employee?.custom_fields ?? {}) as CF, [employee]);
  const statusVal = (cf.status ?? "").trim().toLowerCase();
  const isKarenz = statusVal.includes("karenz");
  const isPfaendung = statusVal.includes("pfänd") || statusVal.includes("pfaend");

  const { register, handleSubmit, reset } = useForm<EditForm>();

  function startEdit() {
    if (!employee) return;
    reset({
      first_name: employee.first_name,
      last_name: employee.last_name,
      contact_email: employee.contact_email ?? "",
      contact_phone: employee.contact_phone ?? "",
      employee_number: employee.employee_number ?? "",
      entry_date: employee.entry_date,
      employment_type: employee.employment_type,
      hours_per_week: employee.hours_per_week,
      kv_id: employee.kv_id ?? "",
      cost_center_id: employee.cost_center_id ?? "",
      bank_iban: employee.bank_iban ?? "",
      cf_brutto: cf.brutto ?? "",
      cf_status: cf.status ?? "",
      cf_notizen: cf.notizen ?? "",
      cf_austritt_info: cf.austritt_info ?? "",
      cf_naechste_gehaltsaenderung: cf.naechste_gehaltsaenderung ?? "",
      cf_anrechnung_jahre: cf.anrechnung_jahre ?? "",
    });
    setEditing(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (form: EditForm) => {
      if (!employee) return;
      const newCf: CF = {
        ...((employee.custom_fields ?? {}) as CF),
        brutto: form.cf_brutto || undefined,
        status: form.cf_status || undefined,
        notizen: form.cf_notizen || undefined,
        austritt_info: form.cf_austritt_info || undefined,
        naechste_gehaltsaenderung: form.cf_naechste_gehaltsaenderung || undefined,
        anrechnung_jahre: form.cf_anrechnung_jahre || undefined,
      };
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        employee_number: form.employee_number || null,
        entry_date: form.entry_date,
        employment_type: form.employment_type,
        hours_per_week: form.hours_per_week,
        kv_id: form.kv_id || null,
        cost_center_id: form.cost_center_id || null,
        bank_iban: form.bank_iban || null,
        custom_fields: newCf,
      };
      const { error: updateErr } = await supabase.from("employees").update(payload).eq("id", id);
      if (updateErr) throw updateErr;
      const { error: histErr } = await supabase.from("employee_history").insert({
        employee_id: id,
        company_id: employee.company_id,
        changed_by: user?.id ?? null,
        change_type: "update",
        old_values: employee as unknown as Record<string, unknown>,
        new_values: { ...employee, ...payload } as unknown as Record<string, unknown>,
        change_note: "Stammdaten aktualisiert",
      });
      if (histErr) throw histErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee", id] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Gespeichert");
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Fehler beim Speichern"),
  });

  const [showDsgvo, setShowDsgvo] = useState(false);

  const dsgvoMutation = useMutation({
    mutationFn: async () => {
      if (!employee) return;
      // DSGVO: anonymize ALL personal data — extend this list when new PII fields are added
      const anonymizedCf: CF = {
        ...cf,
        brutto: undefined,
        notizen: undefined,
        pfaendung: undefined,
        pfaendung_betrag: undefined,
        pfaendung_glaeubiger: undefined,
        kst_raw: cf.kst_raw,
      };
      const { error } = await supabase.from("employees").update({
        contact_email: null,
        contact_phone: null,
        bank_iban: null,
        bank_bic: null,
        bank_name: null,
        birth_date: null,
        svnr: null,
        tax_id: null,
        tax_class: null,
        address: {},
        custom_fields: anonymizedCf,
      }).eq("id", id);
      if (error) throw error;
      await supabase.from("employee_history").insert({
        employee_id: id,
        company_id: employee.company_id,
        changed_by: user?.id ?? null,
        change_type: "anonymize",
        old_values: {},
        new_values: {},
        change_note: "DSGVO-Anonymisierung: Kontaktdaten, IBAN, Geburtsdatum und Lohndaten gelöscht",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee", id] });
      toast.success("Daten anonymisiert (DSGVO)");
      setShowDsgvo(false);
    },
    onError: () => toast.error("Fehler bei der Anonymisierung"),
  });

  const totalMins = timeEntries.filter(e => e.end_time !== null).reduce((s, e) => s + calcWorkedMinutes(e), 0);
  const overtime = totalMins - 160 * 60;
  const sickDaysThisYear = leaves
    .filter(l => l.absence_types?.code === "krankenstand" && l.status === "approved" && l.start_date.startsWith(String(now.getFullYear())))
    .reduce((s, l) => s + (l.working_days ?? 0), 0);
  const efzgWeeks = sickDaysThisYear <= 30 ? "Volle Entgeltfortzahlung" :
    sickDaysThisYear <= 50 ? "Halbe Entgeltfortzahlung (§ 8 EFZG)" : "Keine Entgeltfortzahlung";
  const vacationLeft = leaveBalance
    ? (leaveBalance.entitlement_days + (leaveBalance.carry_over_days ?? 0)) - (leaveBalance.taken_days ?? 0)
    : null;

  if (empLoading || !employee) return (
    <div className="flex h-full items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-4 border-[#4F772D] border-t-transparent" />
    </div>
  );

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Breadcrumb */}
      <Link href="/admin/employees" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Mitarbeiter
      </Link>

      {/* Status banners */}
      {isKarenz && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
          <Baby className="h-5 w-5 shrink-0 text-blue-500 mt-0.5" strokeWidth={1.5} />
          <div>
            <p className="text-sm font-semibold text-blue-800">In Karenz</p>
            {cf.austritt_info && <p className="mt-0.5 text-xs text-blue-600">{cf.austritt_info}</p>}
          </div>
        </div>
      )}
      {isPfaendung && showPfaendung && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" strokeWidth={1.5} />
          <div>
            <p className="text-sm font-semibold text-red-800">Pfändung aktiv</p>
            {cf.austritt_info && <p className="mt-0.5 text-xs text-red-600">{cf.austritt_info}</p>}
          </div>
        </div>
      )}
      {!isKarenz && !isPfaendung && cf.austritt_info && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" strokeWidth={1.5} />
          <div>
            <p className="text-sm font-semibold text-amber-800">Hinweis</p>
            <p className="mt-0.5 text-xs text-amber-700">{cf.austritt_info}</p>
          </div>
        </div>
      )}

      {/* Header card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#4F772D]/10 text-2xl font-bold text-[#4F772D]">
              {employee.first_name[0]}{employee.last_name[0]}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{employee.first_name} {employee.last_name}</h1>
              <p className="text-sm text-gray-500">
                DNR {employee.employee_number ?? "—"} · {EMPLOYMENT_LABELS[employee.employment_type]} · {employee.hours_per_week}h/Woche
              </p>
              <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-gray-400">
                {employee.contact_email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" strokeWidth={1.5} />{employee.contact_email}</span>}
                {employee.contact_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" strokeWidth={1.5} />{employee.contact_phone}</span>}
              </div>
            </div>
          </div>
          {!editing && (
            <button onClick={startEdit}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition">
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} /> Bearbeiten
            </button>
          )}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Eintrittsdatum" value={format(parseISO(employee.entry_date), "d. MMM yyyy", { locale: de })} icon={<Building className="h-4 w-4" strokeWidth={1.5} />} />
          <Stat label="Urlaubstage" value={vacationLeft !== null ? `${vacationLeft}/${leaveBalance!.entitlement_days + (leaveBalance!.carry_over_days ?? 0)}` : "—"} icon={<Calendar className="h-4 w-4" strokeWidth={1.5} />} />
          <Stat label="Diesen Monat" value={formatDuration(totalMins)} icon={<Clock className="h-4 w-4" strokeWidth={1.5} />} />
          <Stat label="Überstunden" value={overtime >= 0 ? `+${formatDuration(overtime)}` : `-${formatDuration(Math.abs(overtime))}`} icon={<Clock className="h-4 w-4" strokeWidth={1.5} />} warn={overtime > 10 * 60} />
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))}
          className="rounded-xl border border-[#4F772D]/30 bg-white p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Stammdaten bearbeiten</h2>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
                <X className="h-3.5 w-3.5" strokeWidth={1.5} /> Abbrechen
              </button>
              <button type="submit" disabled={saveMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-[#4F772D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#31572C] disabled:opacity-60">
                <Save className="h-3.5 w-3.5" strokeWidth={1.5} />
                {saveMutation.isPending ? "Speichert…" : "Speichern"}
              </button>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Stammdaten</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Vorname"><input {...register("first_name")} className={inputCls} /></Field>
              <Field label="Nachname"><input {...register("last_name")} className={inputCls} /></Field>
              <Field label="E-Mail"><input {...register("contact_email")} type="email" className={inputCls} /></Field>
              <Field label="Telefon"><input {...register("contact_phone")} className={inputCls} /></Field>
              <Field label="Dienstnehmer-Nr."><input {...register("employee_number")} className={inputCls} /></Field>
              <Field label="IBAN"><input {...register("bank_iban")} className={inputCls} placeholder="AT…" /></Field>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Beschäftigung</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Eintrittsdatum"><input {...register("entry_date")} type="date" className={inputCls} /></Field>
              <Field label="Beschäftigungsart">
                <select {...register("employment_type")} className={inputCls}>
                  {Object.entries(EMPLOYMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Stunden/Woche"><input {...register("hours_per_week", { valueAsNumber: true })} type="number" step="0.5" className={inputCls} /></Field>
              <Field label="Kollektivvertrag">
                <select {...register("kv_id")} className={inputCls}>
                  <option value="">— kein KV —</option>
                  {kvs.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
              </Field>
              <Field label="Filiale / Kostenstelle">
                <select {...register("cost_center_id")} className={inputCls}>
                  <option value="">— keine —</option>
                  {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Anrechnung Vordienstzeiten"><input {...register("cf_anrechnung_jahre")} className={inputCls} placeholder="z.B. 3 Jahre" /></Field>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Vergütung</h3>
            <div className="grid grid-cols-2 gap-4">
              {showBrutto && <Field label="Brutto (€)"><input {...register("cf_brutto")} className={inputCls} placeholder="2000.00" /></Field>}
              <Field label="Nächste Gehaltsänderung"><input {...register("cf_naechste_gehaltsaenderung")} type="date" className={inputCls} /></Field>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Status & Austritt</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Status (Karenz, Pfändung…)"><input {...register("cf_status")} className={inputCls} placeholder="z.B. Karenz" /></Field>
              <Field label="Austritt / Hinweis"><input {...register("cf_austritt_info")} className={inputCls} placeholder="z.B. 30.06.2026 - KD-DN" /></Field>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Notizen</h3>
            <textarea {...register("cf_notizen")} rows={3} className={inputCls} placeholder="Interne Notizen…" />
          </div>
        </form>
      )}

      {/* Read-only data sections */}
      {!editing && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Beschäftigung</h2>
            <ReadRow label="KV" value={employee.kv_id ? kvMap[employee.kv_id] : null} />
            <ReadRow label="Filiale" value={employee.cost_center_id ? kstMap[employee.cost_center_id] : null} />
            <ReadRow label="Eintrittsdatum" value={format(parseISO(employee.entry_date), "d. MMMM yyyy", { locale: de })} />
            <ReadRow label="Stunden/Woche" value={`${employee.hours_per_week}h`} />
            {cf.anrechnung_jahre && <ReadRow label="Anrechnung Vordienstzeit" value={cf.anrechnung_jahre} />}
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Vergütung</h2>
            <ReadRow label="Brutto" value={showBrutto
              ? (cf.brutto
                  ? `€ ${parseFloat(cf.brutto).toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : null)
              : "••••"} />
            <ReadRow label="Nächste Änderung" value={cf.naechste_gehaltsaenderung
              ? format(parseISO(cf.naechste_gehaltsaenderung), "d. MMMM yyyy", { locale: de })
              : null} />
            {employee.bank_iban && (
              <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                <CreditCard className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
                IBAN: <span className="font-mono font-medium text-gray-700">{employee.bank_iban}</span>
              </div>
            )}
            {cf.notizen && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Notizen</p>
                <p className="text-xs text-gray-700 whitespace-pre-wrap">{cf.notizen}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Krankenstand */}
      {sickDaysThisYear > 0 && (
        <div className={`rounded-xl border px-5 py-4 ${sickDaysThisYear > 30 ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"}`}>
          <p className="text-sm font-medium text-gray-900">Krankenstand {now.getFullYear()}</p>
          <p className="mt-0.5 text-xs text-gray-500">{sickDaysThisYear} Kranktage · <strong>{efzgWeeks}</strong></p>
          <div className="mt-2 h-2 rounded-full bg-gray-200">
            <div className="h-2 rounded-full bg-red-400 transition-all" style={{ width: `${Math.min(100, (sickDaysThisYear / 30) * 100)}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-gray-400">30 Arbeitstage = Ende der vollen Entgeltfortzahlung (§ 8 EFZG)</p>
        </div>
      )}

      {/* Zeit + Abwesenheiten */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
            <h2 className="text-sm font-medium text-gray-900">Zeiterfassung — {format(now, "MMMM", { locale: de })}</h2>
          </div>
          <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {timeEntries.length === 0 ? (
              <p className="px-5 py-6 text-center text-xs text-gray-400">Keine Einträge</p>
            ) : timeEntries.slice(0, 10).map(e => (
              <div key={e.id} className="flex items-center justify-between px-5 py-2.5">
                <div>
                  <p className="text-xs font-medium text-gray-900">{format(parseISO(e.work_date), "EEE d. MMM", { locale: de })}</p>
                  <p className="text-[10px] text-gray-400">{e.start_time} – {e.end_time ?? "läuft"}</p>
                </div>
                <p className="text-xs font-medium text-gray-700">{e.end_time ? formatDuration(calcWorkedMinutes(e)) : "—"}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
            <h2 className="text-sm font-medium text-gray-900">Abwesenheiten</h2>
          </div>
          <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {leaves.length === 0 ? (
              <p className="px-5 py-6 text-center text-xs text-gray-400">Keine Anträge</p>
            ) : leaves.map(l => (
              <div key={l.id} className="flex items-center justify-between px-5 py-2.5">
                <div>
                  <p className="text-xs font-medium text-gray-900">
                    {l.absence_types?.name ?? l.absence_type_id}
                    {l.working_days != null && ` · ${l.working_days} Tage`}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {format(parseISO(l.start_date), "d. MMM", { locale: de })} – {format(parseISO(l.end_date), "d. MMM yyyy", { locale: de })}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[l.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {l.status === "approved" ? "Genehmigt" : l.status === "requested" ? "Offen" : "Abgelehnt"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dokumente */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
          <h2 className="text-sm font-medium text-gray-900">Dokumente ({docs.length})</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {docs.length === 0 ? (
            <p className="px-5 py-6 text-center text-xs text-gray-400">Noch keine Dokumente</p>
          ) : docs.map(doc => {
            const { data: urlData } = supabase.storage.from("documents").getPublicUrl(doc.storage_path);
            return (
              <div key={doc.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm text-gray-900">{doc.title}</p>
                  <p className="text-xs text-gray-400">{doc.file_name}</p>
                </div>
                <a href={urlData.publicUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-lg bg-[#4F772D]/10 px-3 py-1.5 text-xs font-medium text-[#4F772D] hover:bg-[#4F772D]/20 transition">
                  <Download className="h-3.5 w-3.5" strokeWidth={1.5} /> Download
                </a>
              </div>
            );
          })}
        </div>
      </div>
      {/* DSGVO Anonymisierung — nur für ausgetretene MAs, nur payroll */}
      {!employee.is_active && showBrutto && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <ShieldOff className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">DSGVO-Datenlöschung</p>
              <p className="mt-0.5 text-xs text-red-600">
                Mitarbeiter ist ausgetreten. Gemäß DSGVO Art. 17 können personenbezogene Daten
                (Kontakt, IBAN, Geburtsdatum, Lohndaten) anonymisiert werden.
                Dieser Vorgang ist <strong>nicht rückgängig</strong> zu machen.
              </p>
              <button
                onClick={() => setShowDsgvo(true)}
                className="mt-3 flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition"
              >
                <ShieldOff className="h-3.5 w-3.5" strokeWidth={1.5} />
                Daten anonymisieren
              </button>
            </div>
          </div>
        </div>
      )}

      {showDsgvo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start gap-3">
              <ShieldOff className="h-5 w-5 text-red-500 mt-0.5" strokeWidth={1.5} />
              <div>
                <h3 className="text-sm font-semibold text-gray-900">DSGVO-Anonymisierung bestätigen</h3>
                <p className="mt-1 text-xs text-gray-500">
                  Folgende Daten werden unwiderruflich gelöscht:
                </p>
                <ul className="mt-2 space-y-0.5 text-xs text-gray-600 list-disc list-inside">
                  <li>E-Mail &amp; Telefon</li>
                  <li>IBAN</li>
                  <li>Geburtsdatum</li>
                  <li>Brutto &amp; Notizen</li>
                </ul>
                <p className="mt-2 text-xs text-red-500 font-medium">Nicht rückgängig zu machen!</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDsgvo(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={() => dsgvoMutation.mutate()}
                disabled={dsgvoMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60"
              >
                <ShieldOff className="h-4 w-4" strokeWidth={1.5} />
                {dsgvoMutation.isPending ? "Wird anonymisiert…" : "Jetzt anonymisieren"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon, warn }: { label: string; value: string; icon: React.ReactNode; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2.5">
      <div className={`mb-1 ${warn ? "text-amber-500" : "text-gray-400"}`}>{icon}</div>
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className={`text-sm font-semibold ${warn ? "text-amber-600" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}
