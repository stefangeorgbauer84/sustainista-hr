"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import {
  Briefcase, Plus, X, Users, Mail,
  Phone, Calendar, CheckCircle,
} from "lucide-react";

type JobPosting = {
  id: string; title: string; status: string; department_id: string | null;
  employment_type: string; salary_range_min: number | null; salary_range_max: number | null;
  closes_at: string | null; created_at: string;
};

type Application = {
  id: string; job_posting_id: string | null; first_name: string; last_name: string;
  email: string; phone: string | null; status: string; source: string | null;
  cover_letter: string | null; applied_at: string;
  job_postings?: { title: string } | null;
};

const PIPELINE_STAGES: { key: string; label: string; color: string; bg: string }[] = [
  { key: "received",   label: "Beworben",    color: "text-blue-600",   bg: "bg-blue-50 border-blue-200" },
  { key: "screening",  label: "Screening",   color: "text-violet-600", bg: "bg-violet-50 border-violet-200" },
  { key: "interview",  label: "Interview",   color: "text-amber-600",  bg: "bg-amber-50 border-amber-200" },
  { key: "offer",      label: "Angebot",     color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
  { key: "hired",      label: "Eingestellt", color: "text-green-600",  bg: "bg-green-50 border-green-200" },
  { key: "rejected",   label: "Abgesagt",    color: "text-gray-500",   bg: "bg-gray-50 border-gray-200" },
];

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  vollzeit: "Vollzeit", teilzeit: "Teilzeit", geringfügig: "Geringfügig",
  freelance: "Freelance", praktikum: "Praktikum",
};

const inp = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#4F772D] focus:outline-none focus:ring-2 focus:ring-[#4F772D]/20";

export default function RecruitingPage() {
  const qc = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<string>("all");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [showNewJob, setShowNewJob] = useState(false);
  const [showNewApp, setShowNewApp] = useState(false);
  const [newJob, setNewJob] = useState({ title: "", employment_type: "vollzeit", salary_range_min: "", salary_range_max: "", closes_at: "" });
  const [newApp, setNewApp] = useState({ first_name: "", last_name: "", email: "", phone: "", source: "", job_posting_id: "" });

  const { data: jobs = [] } = useQuery<JobPosting[]>({
    queryKey: ["job-postings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_postings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as JobPosting[];
    },
  });

  const { data: applications = [], isLoading } = useQuery<Application[]>({
    queryKey: ["applications", selectedJob],
    queryFn: async () => {
      let query = supabase
        .from("applications")
        .select("*, job_postings(title)")
        .order("applied_at", { ascending: false })
        .limit(200);
      if (selectedJob !== "all") query = query.eq("job_posting_id", selectedJob);
      const { data, error } = await query;
      if (error) throw error;
      return data as Application[];
    },
  });

  const moveStage = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("applications")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["applications"] });
      setSelectedApp(prev => prev ? { ...prev, status: variables.status } : null);
      toast.success("Status aktualisiert");
    },
    onError: () => toast.error("Fehler"),
  });

  const createJob = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("job_postings").insert({
        title: newJob.title,
        employment_type: newJob.employment_type,
        salary_range_min: newJob.salary_range_min ? Number(newJob.salary_range_min) : null,
        salary_range_max: newJob.salary_range_max ? Number(newJob.salary_range_max) : null,
        closes_at: newJob.closes_at || null,
        status: "published",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-postings"] });
      toast.success("Stelle erstellt");
      setShowNewJob(false);
      setNewJob({ title: "", employment_type: "vollzeit", salary_range_min: "", salary_range_max: "", closes_at: "" });
    },
    onError: () => toast.error("Fehler beim Erstellen"),
  });

  const createApp = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("applications").insert({
        first_name: newApp.first_name,
        last_name: newApp.last_name,
        email: newApp.email,
        phone: newApp.phone || null,
        source: newApp.source || null,
        job_posting_id: newApp.job_posting_id || null,
        status: "received",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications"] });
      toast.success("Bewerbung erfasst");
      setShowNewApp(false);
      setNewApp({ first_name: "", last_name: "", email: "", phone: "", source: "", job_posting_id: "" });
    },
    onError: () => toast.error("Fehler beim Erfassen"),
  });

  const byStage = Object.fromEntries(
    PIPELINE_STAGES.map(s => [s.key, applications.filter(a => a.status === s.key)])
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Recruiting-Pipeline</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {applications.length} Bewerbungen · {jobs.filter(j => j.status === "published").length} offene Stellen
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowNewApp(true)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Bewerbung
          </button>
          <button
            onClick={() => setShowNewJob(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#4F772D] px-3 py-2 text-sm font-medium text-white hover:bg-[#31572C] transition"
          >
            <Briefcase className="h-4 w-4" strokeWidth={1.5} />
            Neue Stelle
          </button>
        </div>
      </div>

      {/* Job-Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedJob("all")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            selectedJob === "all" ? "bg-[#4F772D] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Alle Stellen
        </button>
        {jobs.map(j => (
          <button
            key={j.id}
            onClick={() => setSelectedJob(j.id)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
              selectedJob === j.id ? "bg-[#4F772D] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {j.title}
            {j.closes_at && new Date(j.closes_at) < new Date() && (
              <span className="ml-0.5 text-red-400">· abgelaufen</span>
            )}
          </button>
        ))}
      </div>

      {/* Kanban */}
      {isLoading ? (
        <p className="py-12 text-center text-sm text-gray-400">Wird geladen…</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map(stage => (
            <div key={stage.key} className="flex-shrink-0 w-56">
              <div className={`mb-3 flex items-center justify-between rounded-lg border px-3 py-2 ${stage.bg}`}>
                <span className={`text-xs font-semibold ${stage.color}`}>{stage.label}</span>
                <span className={`text-xs font-bold ${stage.color}`}>{byStage[stage.key]?.length ?? 0}</span>
              </div>
              <div className="space-y-2">
                {(byStage[stage.key] ?? []).map(app => (
                  <button
                    key={app.id}
                    onClick={() => setSelectedApp(app)}
                    className="w-full rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm hover:shadow-md transition hover:border-[#4F772D]/30"
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">{app.first_name} {app.last_name}</p>
                    {app.job_postings?.title && (
                      <p className="mt-0.5 text-[10px] text-gray-400 truncate">{app.job_postings.title}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">
                        {format(parseISO(app.applied_at), "d. MMM", { locale: de })}
                      </span>
                      {app.source && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] text-gray-500">{app.source}</span>
                      )}
                    </div>
                  </button>
                ))}
                {(byStage[stage.key] ?? []).length === 0 && (
                  <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center">
                    <p className="text-[10px] text-gray-400">Keine Bewerbungen</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail-Panel */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40">
          <div className="h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {selectedApp.first_name} {selectedApp.last_name}
                </h3>
                {selectedApp.job_postings?.title && (
                  <p className="text-xs text-gray-400">{selectedApp.job_postings.title}</p>
                )}
              </div>
              <button onClick={() => setSelectedApp(null)} className="rounded-lg p-1.5 hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kontakt</p>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Mail className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                  <a href={`mailto:${selectedApp.email}`} className="hover:text-[#4F772D]">{selectedApp.email}</a>
                </div>
                {selectedApp.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Phone className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                    <a href={`tel:${selectedApp.phone}`} className="hover:text-[#4F772D]">{selectedApp.phone}</a>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Calendar className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                  Beworben: {format(parseISO(selectedApp.applied_at), "d. MMMM yyyy", { locale: de })}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pipeline-Status</p>
                <div className="grid grid-cols-2 gap-2">
                  {PIPELINE_STAGES.map(s => (
                    <button
                      key={s.key}
                      onClick={() => moveStage.mutate({ id: selectedApp.id, status: s.key })}
                      disabled={moveStage.isPending}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        selectedApp.status === s.key
                          ? `${s.bg} ${s.color} border-current`
                          : "border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {selectedApp.status === s.key && <CheckCircle className="h-3 w-3" strokeWidth={2} />}
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {selectedApp.cover_letter && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Anschreiben</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedApp.cover_letter}</p>
                </div>
              )}

              <div className="border-t border-gray-100 pt-4 flex gap-2">
                <a
                  href={`mailto:${selectedApp.email}?subject=Ihre Bewerbung bei Bäckerei Bauer`}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  <Mail className="h-3.5 w-3.5" strokeWidth={1.5} />
                  E-Mail schreiben
                </a>
                {(selectedApp.status === "offer" || selectedApp.status === "hired") && (
                  <button
                    onClick={() => toast.info("Onboarding-Flow: Bewerbung wird als Mitarbeiter angelegt")}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#4F772D] px-3 py-2 text-xs font-medium text-white hover:bg-[#31572C] transition"
                  >
                    <Users className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Zu Mitarbeiter
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Neue Stelle */}
      {showNewJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Neue Stelle ausschreiben</h3>
              <button onClick={() => setShowNewJob(false)} className="rounded-lg p-1.5 hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Stellenbezeichnung *</label>
                <input value={newJob.title} onChange={e => setNewJob(p => ({ ...p, title: e.target.value }))}
                  placeholder="z.B. Bäcker (m/w/d)" className={inp} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Beschäftigungsart</label>
                <select value={newJob.employment_type} onChange={e => setNewJob(p => ({ ...p, employment_type: e.target.value }))} className={inp}>
                  {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Gehalt von (€)</label>
                  <input type="number" value={newJob.salary_range_min}
                    onChange={e => setNewJob(p => ({ ...p, salary_range_min: e.target.value }))}
                    placeholder="2000" className={inp} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Gehalt bis (€)</label>
                  <input type="number" value={newJob.salary_range_max}
                    onChange={e => setNewJob(p => ({ ...p, salary_range_max: e.target.value }))}
                    placeholder="2800" className={inp} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Bewerbungsfrist</label>
                <input type="date" value={newJob.closes_at}
                  onChange={e => setNewJob(p => ({ ...p, closes_at: e.target.value }))} className={inp} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowNewJob(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Abbrechen
              </button>
              <button
                onClick={() => createJob.mutate()}
                disabled={!newJob.title || createJob.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60 transition"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                {createJob.isPending ? "Wird erstellt…" : "Stelle erstellen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Bewerbung */}
      {showNewApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Bewerbung erfassen</h3>
              <button onClick={() => setShowNewApp(false)} className="rounded-lg p-1.5 hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Vorname *</label>
                  <input value={newApp.first_name} onChange={e => setNewApp(p => ({ ...p, first_name: e.target.value }))}
                    placeholder="Max" className={inp} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Nachname *</label>
                  <input value={newApp.last_name} onChange={e => setNewApp(p => ({ ...p, last_name: e.target.value }))}
                    placeholder="Mustermann" className={inp} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">E-Mail *</label>
                <input type="email" value={newApp.email} onChange={e => setNewApp(p => ({ ...p, email: e.target.value }))}
                  placeholder="max@beispiel.at" className={inp} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Telefon</label>
                <input value={newApp.phone} onChange={e => setNewApp(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+43 660 …" className={inp} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Stelle</label>
                <select value={newApp.job_posting_id} onChange={e => setNewApp(p => ({ ...p, job_posting_id: e.target.value }))} className={inp}>
                  <option value="">— Spontanbewerbung —</option>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Quelle</label>
                <select value={newApp.source} onChange={e => setNewApp(p => ({ ...p, source: e.target.value }))} className={inp}>
                  <option value="">— unbekannt —</option>
                  <option value="Empfehlung">Empfehlung</option>
                  <option value="Website">Website</option>
                  <option value="AMS">AMS</option>
                  <option value="Karriere.at">Karriere.at</option>
                  <option value="Willhaben">Willhaben</option>
                  <option value="Walk-in">Walk-in</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowNewApp(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Abbrechen
              </button>
              <button
                onClick={() => createApp.mutate()}
                disabled={!newApp.first_name || !newApp.last_name || !newApp.email || createApp.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60 transition"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                {createApp.isPending ? "Wird erfasst…" : "Bewerbung speichern"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
