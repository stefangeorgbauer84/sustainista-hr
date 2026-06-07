"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { account, databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { Query } from "appwrite";
import type { Employee } from "@/types";
import { toast } from "sonner";
import { Leaf, Check, ChevronRight, User, Phone, CreditCard, ClipboardCheck } from "lucide-react";

// ─── Step schemas ────────────────────────────────────────────────────────────

const personalSchema = z.object({
  firstName: z.string().min(1, "Pflichtfeld"),
  lastName: z.string().min(1, "Pflichtfeld"),
  birthDate: z.string().min(1, "Pflichtfeld"),
});

const contactSchema = z.object({
  phone: z.string().min(5, "Pflichtfeld"),
  address: z.string().min(5, "Pflichtfeld"),
  emergencyContact: z.string().optional(),
});

const bankSchema = z.object({
  bankAccount: z.string()
    .regex(/^AT\d{2}\d{16}$|^[A-Z]{2}\d{2}[A-Z0-9]{4,}$/, "Ungültige IBAN")
    .or(z.string().length(0))
    .optional(),
  svNumber: z.string().optional(),
});

type PersonalForm = z.infer<typeof personalSchema>;
type ContactForm = z.infer<typeof contactSchema>;
type BankForm = z.infer<typeof bankSchema>;

const STEPS = [
  { id: "personal", label: "Persönliches", icon: User },
  { id: "contact", label: "Kontakt", icon: Phone },
  { id: "bank", label: "Bankdaten", icon: CreditCard },
  { id: "confirm", label: "Bestätigung", icon: ClipboardCheck },
];

const inp = "w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-[#4F772D] focus:outline-none focus:ring-2 focus:ring-[#4F772D]/20";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [collected, setCollected] = useState<{
    personal?: PersonalForm;
    contact?: ContactForm;
    bank?: BankForm;
  }>({});

  const personalForm = useForm<PersonalForm>({ resolver: zodResolver(personalSchema) });
  const contactForm = useForm<ContactForm>({ resolver: zodResolver(contactSchema) });
  const bankForm = useForm<BankForm>({ resolver: zodResolver(bankSchema) });

  useEffect(() => {
    async function load() {
      try {
        const user = await account.get();
        const res = await databases.listDocuments(DB_ID, COLLECTIONS.EMPLOYEES, [
          Query.equal("userId", user.$id), Query.limit(1),
        ]);
        const emp = res.documents[0] as unknown as Employee;
        if (!emp) { router.replace("/login"); return; }
        if (emp.status === "active") { router.replace("/dashboard"); return; }
        if (emp.status === "rejected") { router.replace("/pending"); return; }
        setEmployee(emp);
        // Pre-fill if returning
        if (emp.firstName) personalForm.setValue("firstName", emp.firstName);
        if (emp.lastName) personalForm.setValue("lastName", emp.lastName);
        if (emp.phone) contactForm.setValue("phone", emp.phone);
        if (emp.address) contactForm.setValue("address", emp.address);
        if (emp.bankAccount) bankForm.setValue("bankAccount", emp.bankAccount);
      } catch {
        router.replace("/login");
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitAll(bank: BankForm) {
    if (!employee) return;
    setSaving(true);
    try {
      await databases.updateDocument(DB_ID, COLLECTIONS.EMPLOYEES, employee.$id, {
        firstName: collected.personal?.firstName ?? employee.firstName,
        lastName: collected.personal?.lastName ?? employee.lastName,
        phone: collected.contact?.phone ?? "",
        address: collected.contact?.address ?? "",
        bankAccount: bank.bankAccount ?? "",
        onboardingStep: "submitted",
      });
      toast.success("Daten wurden erfolgreich übermittelt!");
      router.replace("/pending");
    } catch {
      toast.error("Fehler beim Speichern. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  function onPersonal(data: PersonalForm) {
    setCollected(c => ({ ...c, personal: data }));
    setStep(1);
  }

  function onContact(data: ContactForm) {
    setCollected(c => ({ ...c, contact: data }));
    setStep(2);
  }

  function onBank(data: BankForm) {
    setCollected(c => ({ ...c, bank: data }));
    setStep(3);
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 px-4 py-12">
      {/* Logo */}
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4F772D]">
          <Leaf className="h-6 w-6 text-white" strokeWidth={1.5} />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Willkommen bei Sustainista</h1>
          <p className="mt-1 text-sm text-gray-500">Bitte ergänze deine Informationen, damit wir dein Konto freischalten können.</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="mb-8 flex items-center gap-0">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < step;
          const active = i === step;
          return (
            <div key={s.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all ${
                  done ? "border-[#4F772D] bg-[#4F772D]" :
                  active ? "border-[#4F772D] bg-white" :
                  "border-gray-200 bg-white"
                }`}>
                  {done
                    ? <Check className="h-4 w-4 text-white" strokeWidth={2.5} />
                    : <Icon className={`h-4 w-4 ${active ? "text-[#4F772D]" : "text-gray-300"}`} strokeWidth={1.5} />
                  }
                </div>
                <span className={`mt-1 text-[10px] font-medium ${active ? "text-[#4F772D]" : done ? "text-gray-500" : "text-gray-300"}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`mb-4 h-px w-16 mx-1 transition-colors ${i < step ? "bg-[#4F772D]" : "bg-gray-200"}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="w-full max-w-lg">
        {/* Step 0 — Persönliches */}
        {step === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <h2 className="mb-6 text-base font-semibold text-gray-900">Persönliche Daten</h2>
            <form onSubmit={personalForm.handleSubmit(onPersonal)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Vorname</label>
                  <input {...personalForm.register("firstName")} className={inp} />
                  {personalForm.formState.errors.firstName && (
                    <p className="mt-1 text-xs text-red-500">{personalForm.formState.errors.firstName.message}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Nachname</label>
                  <input {...personalForm.register("lastName")} className={inp} />
                  {personalForm.formState.errors.lastName && (
                    <p className="mt-1 text-xs text-red-500">{personalForm.formState.errors.lastName.message}</p>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Geburtsdatum</label>
                <input {...personalForm.register("birthDate")} type="date" className={inp} />
                {personalForm.formState.errors.birthDate && (
                  <p className="mt-1 text-xs text-red-500">{personalForm.formState.errors.birthDate.message}</p>
                )}
              </div>
              <StepFooter step={step} setStep={setStep} />
            </form>
          </div>
        )}

        {/* Step 1 — Kontakt */}
        {step === 1 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <h2 className="mb-6 text-base font-semibold text-gray-900">Kontaktdaten</h2>
            <form onSubmit={contactForm.handleSubmit(onContact)} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Telefonnummer</label>
                <input {...contactForm.register("phone")} className={inp} placeholder="+43 664 123 456" />
                {contactForm.formState.errors.phone && (
                  <p className="mt-1 text-xs text-red-500">{contactForm.formState.errors.phone.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Wohnadresse</label>
                <input {...contactForm.register("address")} className={inp} placeholder="Musterstraße 1, 1010 Wien" />
                {contactForm.formState.errors.address && (
                  <p className="mt-1 text-xs text-red-500">{contactForm.formState.errors.address.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Notfallkontakt (optional)</label>
                <input {...contactForm.register("emergencyContact")} className={inp} placeholder="Name, +43 664 …" />
              </div>
              <StepFooter step={step} setStep={setStep} />
            </form>
          </div>
        )}

        {/* Step 2 — Bankdaten */}
        {step === 2 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <h2 className="mb-6 text-base font-semibold text-gray-900">Bankverbindung & Sozialversicherung</h2>
            <p className="mb-4 text-xs text-gray-400">Diese Daten werden ausschließlich für die Gehaltsauszahlung und Anmeldung verwendet.</p>
            <form onSubmit={bankForm.handleSubmit(onBank)} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">IBAN (optional)</label>
                <input {...bankForm.register("bankAccount")} className={inp} placeholder="AT12 3456 7890 1234 5678" />
                {bankForm.formState.errors.bankAccount && (
                  <p className="mt-1 text-xs text-red-500">{bankForm.formState.errors.bankAccount.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">SV-Nummer (optional)</label>
                <input {...bankForm.register("svNumber")} className={inp} placeholder="1234 010190" />
              </div>
              <StepFooter step={step} setStep={setStep} saving={saving} isLast />
            </form>
          </div>
        )}

        {/* Step 3 — Bestätigung */}
        {step === 3 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#4F772D]/10">
              <ClipboardCheck className="h-8 w-8 text-[#4F772D]" strokeWidth={1.5} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Alles bereit!</h2>
            <p className="mt-2 text-sm text-gray-500">
              Deine Daten wurden vollständig erfasst. Klicke auf „Absenden", um sie an die HR-Abteilung zu übermitteln.
              Du erhältst eine Benachrichtigung, sobald dein Konto freigeschaltet wurde.
            </p>
            <div className="mt-6 rounded-lg bg-gray-50 p-4 text-left text-sm space-y-1">
              <p className="text-gray-700"><span className="font-medium">Name:</span> {collected.personal?.firstName} {collected.personal?.lastName}</p>
              <p className="text-gray-700"><span className="font-medium">Telefon:</span> {collected.contact?.phone}</p>
              <p className="text-gray-700"><span className="font-medium">Adresse:</span> {collected.contact?.address}</p>
              {collected.bank?.bankAccount && (
                <p className="text-gray-700"><span className="font-medium">IBAN:</span> {collected.bank.bankAccount}</p>
              )}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                Zurück
              </button>
              <button
                onClick={() => submitAll(collected.bank ?? {})}
                disabled={saving}
                className="flex-1 rounded-lg bg-[#4F772D] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60"
              >
                {saving ? "Wird gesendet…" : "Absenden"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepFooter({
  step, setStep, saving = false, isLast = false,
}: {
  step: number;
  setStep: (n: number) => void;
  saving?: boolean;
  isLast?: boolean;
}) {
  return (
    <div className="flex justify-between pt-2">
      {step > 0 ? (
        <button
          type="button"
          onClick={() => setStep(step - 1)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Zurück
        </button>
      ) : <div />}
      <button
        type="submit"
        disabled={saving}
        className="flex items-center gap-2 rounded-lg bg-[#4F772D] px-5 py-2 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60"
      >
        {isLast ? (saving ? "Speichert…" : "Weiter") : "Weiter"}
        <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}
