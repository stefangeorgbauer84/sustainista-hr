"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { login } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { LogIn, Leaf } from "lucide-react";

const schema = z.object({
  email: z.string().email("Bitte eine gültige E-Mail eingeben"),
  password: z.string().min(8, "Mindestens 8 Zeichen"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { refresh, isAdminUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      await login(data.email, data.password);
      await refresh();
      toast.success("Willkommen zurück!");
      router.replace(isAdminUser ? "/admin" : "/dashboard");
    } catch {
      toast.error("Login fehlgeschlagen. Bitte E-Mail und Passwort prüfen.");
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
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-gray-900">Sustainista HR</h1>
            <p className="mt-1 text-sm text-gray-500">Mitarbeiterverwaltung & Zeiterfassung</p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">E-Mail</label>
              <input
                {...register("email")}
                type="email"
                autoComplete="email"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#4F772D] focus:ring-2 focus:ring-[#4F772D]/20"
                placeholder="name@sustainista.net"
              />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Passwort</label>
              <input
                {...register("password")}
                type="password"
                autoComplete="current-password"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#4F772D] focus:ring-2 focus:ring-[#4F772D]/20"
                placeholder="••••••••"
              />
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#4F772D] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#31572C] disabled:opacity-60"
            >
              <LogIn className="h-4 w-4" strokeWidth={1.5} />
              {loading ? "Wird angemeldet…" : "Anmelden"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Sustainista GmbH · HR-System · DSGVO-konform
        </p>
      </div>
    </div>
  );
}
