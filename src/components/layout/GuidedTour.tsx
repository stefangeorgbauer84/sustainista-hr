"use client";

import { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";

const STEPS = [
  {
    title: "Willkommen bei Sustainista HR",
    description:
      "Dieses kurze Tutorial zeigt dir die wichtigsten Funktionen deines HR-Systems. Du kannst die Tour jederzeit beenden und später über den Button unten in der Sidebar neu starten.",
    icon: "🌿",
  },
  {
    title: "Admin-Dashboard",
    description:
      "Die Übersicht zeigt dir auf einen Blick: Anzahl der Mitarbeiter, offene Urlaubsanträge, wer heute im Büro ist und wer bald abwesend sein wird.",
    icon: "📊",
  },
  {
    title: "Mitarbeiterverwaltung",
    description:
      "Unter 'Mitarbeiter' findest du alle Personaldaten: Stammdaten, Dokumente, Abwesenheitshistorie und Zeitkonto. Klicke auf einen Mitarbeiter für die Detailansicht.",
    icon: "👥",
  },
  {
    title: "Urlaubsanträge genehmigen",
    description:
      "Neue Urlaubsanträge erscheinen unter 'Urlaubsanträge'. Du kannst Anträge direkt genehmigen oder mit einer Begründung ablehnen. Abgelehnte Anträge werden dem Mitarbeiter mit deiner Notiz angezeigt.",
    icon: "📅",
  },
  {
    title: "Zeiterfassung",
    description:
      "Die Zeiterfassung zeigt alle gestempelten Zeiten deiner Mitarbeiter. Korrekturen kannst du direkt vornehmen. Pausen werden separat erfasst und zum bestehenden Pausenwert addiert.",
    icon: "⏱️",
  },
  {
    title: "Reports & Kalender",
    description:
      "Im Reiter 'Reports' siehst du den Urlaubskalender aller Mitarbeiter farbkodiert nach Abwesenheitstyp. Du kannst Zeitberichte und Urlaubslisten als CSV exportieren.",
    icon: "📋",
  },
  {
    title: "Dokumente",
    description:
      "Lade Dokumente (Verträge, Lohnzettel, Zertifikate) für jeden Mitarbeiter hoch. Diese sind in der Mitarbeiter-Detailansicht abrufbar und können direkt heruntergeladen werden.",
    icon: "📁",
  },
  {
    title: "Tour abgeschlossen!",
    description:
      "Du kennst jetzt alle wichtigen Bereiche. Bei Fragen findest du rechts oben im Dashboard immer den aktuellen Status deines Teams. Viel Erfolg mit Sustainista HR!",
    icon: "✅",
  },
];

const STORAGE_KEY = "sustainista-hr-tour-done";

interface GuidedTourProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export default function GuidedTour({ forceOpen, onClose }: GuidedTourProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (forceOpen) {
      setStep(0);
      setVisible(true);
      return;
    }
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) setVisible(true);
  }, [forceOpen]);

  function close() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
    onClose?.();
  }

  function next() {
    if (step >= STEPS.length - 1) {
      close();
    } else {
      setStep(step + 1);
    }
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <button
          onClick={close}
          className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          aria-label="Tour beenden"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>

        <div className="h-1 w-full rounded-t-2xl bg-gray-100 overflow-hidden">
          <div
            className="h-1 bg-[#4F772D] transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-3xl">{current.icon}</span>
            <span className="text-xs text-gray-400 font-medium">
              {step + 1} / {STEPS.length}
            </span>
          </div>

          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {current.title}
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            {current.description}
          </p>

          <div className="flex items-center justify-center gap-1.5 mb-6">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === step
                    ? "w-6 bg-[#4F772D]"
                    : "w-1.5 bg-gray-200 hover:bg-gray-300"
                }`}
                aria-label={`Schritt ${i + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={prev}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
                Zurück
              </button>
            )}
            <button
              onClick={next}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#4F772D] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d5e23] transition"
            >
              {isLast ? "Tour beenden" : "Weiter"}
              {!isLast && <ChevronRight className="h-4 w-4" strokeWidth={1.5} />}
            </button>
          </div>

          {!isLast && (
            <button
              onClick={close}
              className="mt-3 w-full text-center text-xs text-gray-400 hover:text-gray-600 transition"
            >
              Tour überspringen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function TourStartButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => {
          localStorage.removeItem(STORAGE_KEY);
          setOpen(true);
        }}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
      >
        <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
        App-Tour starten
      </button>
      {open && <GuidedTour forceOpen onClose={() => setOpen(false)} />}
    </>
  );
}
