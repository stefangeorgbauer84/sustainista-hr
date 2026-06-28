"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Clock, Calendar, CalendarDays, FileText, Users,
  BarChart2, TrendingUp, UserCheck, Trophy, HeartPulse,
  Target, Lightbulb, ClipboardList, Globe, MapPin, Settings,
  Save, ToggleLeft, ToggleRight, Briefcase,
} from "lucide-react";

interface ModuleConfig {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  section: "admin" | "employee";
}

const ALL_MODULES: ModuleConfig[] = [
  // Admin
  { key: "leadership", label: "Leadership", description: "Führungskräfte-Dashboard mit Team-KPIs", icon: <TrendingUp strokeWidth={1.5} className="h-5 w-5" />, section: "admin" },
  { key: "onboarding", label: "Onboarding", description: "Neue Mitarbeiter einarbeiten und freischalten", icon: <UserCheck strokeWidth={1.5} className="h-5 w-5" />, section: "admin" },
  { key: "schedule", label: "Dienstplan", description: "Schichtplanung und Tauschbörse", icon: <CalendarDays strokeWidth={1.5} className="h-5 w-5" />, section: "admin" },
  { key: "time", label: "Zeiterfassung", description: "Arbeitszeiten erfassen und auswerten", icon: <Clock strokeWidth={1.5} className="h-5 w-5" />, section: "admin" },
  { key: "leave", label: "Urlaubsanträge", description: "Urlaubsanträge genehmigen und verwalten", icon: <Calendar strokeWidth={1.5} className="h-5 w-5" />, section: "admin" },
  { key: "pulse", label: "Team-Puls", description: "Stimmung und Wohlbefinden im Team messen", icon: <HeartPulse strokeWidth={1.5} className="h-5 w-5" />, section: "admin" },
  { key: "performance", label: "Performance", description: "Mitarbeiterbewertungen und Reviews", icon: <ClipboardList strokeWidth={1.5} className="h-5 w-5" />, section: "admin" },
  { key: "kaizen", label: "Kaizen-Board", description: "Kontinuierliche Verbesserungsvorschläge", icon: <Lightbulb strokeWidth={1.5} className="h-5 w-5" />, section: "admin" },
  { key: "reports", label: "Reports", description: "Auswertungen und Exports", icon: <BarChart2 strokeWidth={1.5} className="h-5 w-5" />, section: "admin" },
  { key: "documents", label: "Dokumente", description: "Dateiverwaltung für das Unternehmen", icon: <FileText strokeWidth={1.5} className="h-5 w-5" />, section: "admin" },
  { key: "locations", label: "Filialen", description: "Standorte und Filialen verwalten", icon: <MapPin strokeWidth={1.5} className="h-5 w-5" />, section: "admin" },
  { key: "recruiting", label: "Recruiting", description: "Bewerbungen und Stellenausschreibungen verwalten", icon: <Briefcase strokeWidth={1.5} className="h-5 w-5" />, section: "admin" },
  // Employee
  { key: "time", label: "Zeiterfassung", description: "Eigene Arbeitszeiten eintragen", icon: <Clock strokeWidth={1.5} className="h-5 w-5" />, section: "employee" },
  { key: "leave", label: "Urlaub & Abwesenheit", description: "Urlaubsanträge stellen und einsehen", icon: <Calendar strokeWidth={1.5} className="h-5 w-5" />, section: "employee" },
  { key: "calendar", label: "Teamkalender", description: "Abwesenheiten im Team im Überblick", icon: <Users strokeWidth={1.5} className="h-5 w-5" />, section: "employee" },
  { key: "documents", label: "Meine Dokumente", description: "Eigene Dokumente abrufen", icon: <FileText strokeWidth={1.5} className="h-5 w-5" />, section: "employee" },
  { key: "zeitkonto", label: "Zeitkonto", description: "Überstunden und Zeitguthaben einsehen", icon: <TrendingUp strokeWidth={1.5} className="h-5 w-5" />, section: "employee" },
  { key: "wins", label: "Meine Wins", description: "Erfolge dokumentieren und teilen", icon: <Trophy strokeWidth={1.5} className="h-5 w-5" />, section: "employee" },
  { key: "schedule", label: "Dienstplan", description: "Eigenen Dienstplan einsehen und tauschen", icon: <CalendarDays strokeWidth={1.5} className="h-5 w-5" />, section: "employee" },
  { key: "checkin", label: "Check-in", description: "Tägliches Wohlbefinden erfassen", icon: <HeartPulse strokeWidth={1.5} className="h-5 w-5" />, section: "employee" },
  { key: "okrs", label: "Meine OKRs", description: "Ziele und Key Results verfolgen", icon: <Target strokeWidth={1.5} className="h-5 w-5" />, section: "employee" },
  { key: "kaizen", label: "Kaizen-Board", description: "Verbesserungsvorschläge einreichen", icon: <Lightbulb strokeWidth={1.5} className="h-5 w-5" />, section: "employee" },
  { key: "review", label: "Performance Review", description: "Eigene Bewertungen einsehen", icon: <ClipboardList strokeWidth={1.5} className="h-5 w-5" />, section: "employee" },
  { key: "culture", label: "Kultur & Werte", description: "Unternehmenswerte und Leitbild", icon: <Globe strokeWidth={1.5} className="h-5 w-5" />, section: "employee" },
];

const ALL_KEYS = [...new Set(ALL_MODULES.map(m => m.key))];

function ModuleToggle({
  module,
  enabled,
  onToggle,
  color,
}: {
  module: ModuleConfig;
  enabled: boolean;
  onToggle: () => void;
  color: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-4 transition cursor-pointer select-none ${
        enabled ? "border-gray-200 bg-white" : "border-dashed border-gray-200 bg-gray-50 opacity-60"
      }`}
      onClick={onToggle}
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: enabled ? `${color}1A` : "#f3f4f6", color: enabled ? color : "#9ca3af" }}
      >
        {module.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{module.label}</p>
        <p className="text-xs text-gray-500 truncate">{module.description}</p>
      </div>
      <div className="flex-shrink-0">
        {enabled
          ? <ToggleRight strokeWidth={1.5} className="h-6 w-6" style={{ color }} />
          : <ToggleLeft strokeWidth={1.5} className="h-6 w-6 text-gray-300" />
        }
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  const { company, refresh } = useAuth();
  const primaryColor = company?.brand_config?.primaryColor ?? "#4F772D";
  const isFirstSetup = !company?.settings?.enabledModules;

  const [enabled, setEnabled] = useState<Set<string>>(
    () => new Set(company?.settings?.enabledModules ?? ALL_KEYS)
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEnabled(new Set(company?.settings?.enabledModules ?? ALL_KEYS));
  }, [company?.settings?.enabledModules]);

  function toggle(key: string) {
    setEnabled(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    if (!company) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({
          settings: { ...company.settings, enabledModules: [...enabled] },
        })
        .eq("id", company.id);
      if (error) throw error;
      await refresh();
      toast.success("Module gespeichert");
    } catch {
      toast.error("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  const adminModules = ALL_MODULES.filter(m => m.section === "admin");
  const employeeModules = ALL_MODULES.filter(m => m.section === "employee");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Settings strokeWidth={1.5} className="h-5 w-5 text-gray-400" />
            <h1 className="text-xl font-semibold text-gray-900">Module & Navigation</h1>
          </div>
          {isFirstSetup ? (
            <p className="text-sm text-gray-500">
              Wähle welche Funktionen für dein Team sichtbar sein sollen. Du kannst das jederzeit ändern.
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              Aktiviere oder deaktiviere Funktionen für Admin- und Mitarbeiter-Navigation.
            </p>
          )}
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
          style={{ backgroundColor: primaryColor }}
        >
          <Save strokeWidth={1.5} className="h-4 w-4" />
          {saving ? "Speichern..." : "Speichern"}
        </button>
      </div>

      {isFirstSetup && (
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{ backgroundColor: `${primaryColor}0D`, borderColor: `${primaryColor}33`, color: primaryColor }}
        >
          Erste Einrichtung — aktiviere nur die Module die du wirklich brauchst. Deaktivierte Module bleiben im System und können jederzeit wieder eingeschaltet werden.
        </div>
      )}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Admin-Navigation</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {adminModules.map(m => (
            <ModuleToggle
              key={`admin-${m.key}`}
              module={m}
              enabled={enabled.has(m.key)}
              onToggle={() => toggle(m.key)}
              color={primaryColor}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Mitarbeiter-Navigation</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {employeeModules.map(m => (
            <ModuleToggle
              key={`employee-${m.key}`}
              module={m}
              enabled={enabled.has(m.key)}
              onToggle={() => toggle(m.key)}
              color={primaryColor}
            />
          ))}
        </div>
      </section>

      <div className="flex justify-end pb-8">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition disabled:opacity-50"
          style={{ backgroundColor: primaryColor }}
        >
          <Save strokeWidth={1.5} className="h-4 w-4" />
          {saving ? "Speichern..." : "Einstellungen speichern"}
        </button>
      </div>
    </div>
  );
}
