"use client";

import { Leaf, Zap, Heart, TrendingUp, Users, Globe, Lightbulb, RefreshCw, Target, Eye } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const VALUES = [
  {
    icon: Globe,
    color: "bg-green-50 text-green-700 border-green-100",
    title: "Nachhaltigkeit ist kein Kompromiss",
    desc: "Wir glauben, dass wirtschaftlicher Erfolg und ökologische Verantwortung keine Gegensätze sind. Jede Entscheidung — intern wie extern — denken wir durch die Nachhaltigkeitslinse.",
  },
  {
    icon: Zap,
    color: "bg-amber-50 text-amber-700 border-amber-100",
    title: "Wirkung über Aktivität",
    desc: "Wir messen uns nicht an geleisteten Stunden, sondern an dem, was wir erschaffen. Was wurde besser? Was hat sich für Kunden, das Team oder die Welt verändert?",
  },
  {
    icon: Heart,
    color: "bg-rose-50 text-rose-700 border-rose-100",
    title: "Menschen zuerst",
    desc: "Psychologische Sicherheit ist die Basis. Jeder kann Fehler ansprechen, Ideen einbringen und Grenzen setzen — ohne Angst vor Konsequenzen.",
  },
  {
    icon: Lightbulb,
    color: "bg-blue-50 text-blue-700 border-blue-100",
    title: "Neugier als Haltung",
    desc: "Wir fragen 'warum?' bevor wir 'wie?' fragen. Lernen ist kein Event — es ist Teil des Alltags. Jeder bringt Ideen mit, die größer sind als seine Jobbeschreibung.",
  },
  {
    icon: Users,
    color: "bg-purple-50 text-purple-700 border-purple-100",
    title: "Zusammenarbeit schlägt Solo-Performances",
    desc: "Wir feiern Teamleistungen. Erfolge werden geteilt, Rückschläge gemeinsam analysiert. Kein 'das ist nicht mein Problem'.",
  },
  {
    icon: Eye,
    color: "bg-gray-50 text-gray-700 border-gray-200",
    title: "Transparenz als Standard",
    desc: "Wir teilen Zahlen, Entscheidungen und Kontext — auch wenn es unbequem ist. Informationen horten bremst das ganze Team.",
  },
];

const LEAN_PRINCIPLES = [
  {
    num: "01",
    title: "Wert definieren",
    desc: "Was will der Kunde wirklich? Alles andere ist Verschwendung. Wir starten jede Initiative mit dieser Frage.",
  },
  {
    num: "02",
    title: "Wertstrom sehen",
    desc: "Den gesamten Prozess visualisieren — von Anfang bis zum Kunden. Wo staut es sich? Wo wartet jemand auf jemanden?",
  },
  {
    num: "03",
    title: "Fluss erzeugen",
    desc: "Arbeit soll fließen, nicht stauen. Kleine Batches, klare Übergaben, keine unnötigen Genehmigungsschleifen.",
  },
  {
    num: "04",
    title: "Pull statt Push",
    desc: "Wir starten Arbeit erst, wenn sie gebraucht wird — nicht weil ein Plan es sagt. Kapazität und Nachfrage im Gleichgewicht.",
  },
  {
    num: "05",
    title: "Perfektion anstreben",
    desc: "Kaizen — kontinuierliche Verbesserung. Nicht einmalig optimieren, sondern jeden Tag ein bisschen besser werden. Das ist keine Phrase.",
  },
];

const RITUALS = [
  { title: "Wöchentlicher Check-in", desc: "Jeden Montag 3 Fragen: Energie, Priorität, Blocker. Keine Meetings, 60 Sekunden.", cadence: "Wöchentlich" },
  { title: "Win-Feed", desc: "Was hast du erschaffen? Fortschritt sichtbar machen — für dich und das Team.", cadence: "Laufend" },
  { title: "Kaizen-Board", desc: "Jeder kann Verbesserungen vorschlagen. Kein Vorschlag ist zu klein.", cadence: "Laufend" },
  { title: "OKR-Quartalsplanung", desc: "Gemeinsam Ziele setzen, quartalsweise reviewen. Ehrlich über Fortschritt.", cadence: "Quartalsweise" },
  { title: "Performance-Gespräch", desc: "Kein Jahresgespräch, das einmal kommt. Halbjährlich, mit Selbstreflexion und offenem Dialog.", cadence: "Halbjährlich" },
];

export default function CulturePage() {
  const { company } = useAuth();
  const companyName = company?.name ?? "HR Tool";
  return (
    <div className="space-y-10 pb-10">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-[#31572C] to-[#4F772D] p-8 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
            <Leaf className="h-5 w-5 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">{companyName}</p>
            <h1 className="text-xl font-bold">Kultur & Werte</h1>
          </div>
        </div>
        <p className="text-sm text-white/80 leading-relaxed max-w-xl">
          Wir glauben an eine Arbeitskultur, die Menschen wachsen lässt, Wirkung erzeugt und die Welt ein bisschen besser hinterlässt als wir sie vorgefunden haben.
          Diese Seite ist kein Poster — sie ist eine lebendige Referenz.
        </p>
      </div>

      {/* Werte */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-gray-900">Unsere 6 Werte</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {VALUES.map((v) => {
            const Icon = v.icon;
            return (
              <div key={v.title} className={`rounded-xl border p-5 ${v.color.split(" ").slice(2).join(" ")}`}>
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${v.color.split(" ").slice(0, 2).join(" ")}`}>
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{v.title}</p>
                    <p className="mt-1 text-xs text-gray-600 leading-relaxed">{v.desc}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Lean Thinking */}
      <section>
        <div className="mb-4 flex items-center gap-3">
          <RefreshCw className="h-5 w-5 text-[#4F772D]" strokeWidth={1.5} />
          <h2 className="text-base font-semibold text-gray-900">Lean Thinking bei {companyName}</h2>
        </div>
        <p className="mb-5 text-sm text-gray-500 leading-relaxed">
          Lean Thinking kommt aus der Produktion — Toyota hat es erfunden. Heute ist es ein universelles Prinzip:
          Verschwendung reduzieren, Wert maximieren, kontinuierlich lernen. Das leben wir im Alltag.
        </p>
        <div className="space-y-3">
          {LEAN_PRINCIPLES.map(p => (
            <div key={p.num} className="flex gap-5 rounded-xl border border-gray-200 bg-white p-5">
              <span className="text-2xl font-black text-[#4F772D]/20 flex-shrink-0 leading-none">{p.num}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{p.title}</p>
                <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Rituale */}
      <section>
        <div className="mb-4 flex items-center gap-3">
          <Target className="h-5 w-5 text-[#4F772D]" strokeWidth={1.5} />
          <h2 className="text-base font-semibold text-gray-900">Unsere Rituale</h2>
        </div>
        <p className="mb-5 text-sm text-gray-500">Kultur entsteht durch Wiederholung. Diese Rituale machen unsere Werte sichtbar.</p>
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-50">
          {RITUALS.map(r => (
            <div key={r.title} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{r.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
              </div>
              <span className="flex-shrink-0 rounded-full bg-[#4F772D]/10 px-2.5 py-1 text-xs font-medium text-[#4F772D]">
                {r.cadence}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="rounded-xl bg-gray-50 border border-gray-200 px-5 py-4 text-center">
        <p className="text-xs text-gray-500">
          Diese Seite ist lebendig — sie wird gemeinsam weiterentwickelt. Hast du Feedback oder Ergänzungen?
          Reiche einen Kaizen-Vorschlag ein.
        </p>
      </div>
    </div>
  );
}
