"use client";

import { useState } from "react";
import { account } from "@/lib/appwrite";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Link from "next/link";
import { Leaf, Mail, ArrowLeft, CheckCircle } from "lucide-react";

const schema = z.object({
  email: z.string().email("Bitte eine gültige E-Mail eingeben"),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      await account.createRecovery(
        data.email,
        `${window.location.origin}/reset-password`
      );
      setSent(true);
    } catch {
      toast.error("Fehler beim Senden. Bitte E-Mail-Adresse prüfen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#4F772D]">
            <Leaf className="h-7 w-7 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Passwort zurücksetzen</h1>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
                <CheckCircle className="h-7 w-7 text-green-500" strokeWidth={1.5} />
              </div>
              <h2 className="text-base font-semibold text-gray-900">E-Mail gesendet</h2>
              <p className="mt-2 text-sm text-gray-500">
                Falls ein Account mit dieser E-Mail existiert, hast du in wenigen Minuten eine E-Mail mit einem Reset-Link.
              </p>
              <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm text-[#4F772D] hover:underline">
                <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
                Zurück zum Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <p className="text-sm text-gray-500">
                Gib deine E-Mail-Adresse ein. Du bekommst einen Link zum Zurücksetzen deines Passworts.
              </p>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">E-Mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" strokeWidth={1.5} />
                  <input
                    {...register("email")}
                    type="email"
                    className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3.5 text-sm focus:border-[#4F772D] focus:outline-none focus:ring-2 focus:ring-[#4F772D]/20"
                    placeholder="name@sustainista.net"
                  />
                </div>
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#4F772D] py-2.5 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60 transition"
              >
                {loading ? "Wird gesendet…" : "Reset-Link senden"}
              </button>
              <Link href="/login" className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700">
                <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
                Zurück zum Login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
