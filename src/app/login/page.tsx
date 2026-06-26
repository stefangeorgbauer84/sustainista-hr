"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { login, loginWithGoogle, loginWithMicrosoft } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { LogIn, Leaf } from "lucide-react";
import { Suspense } from "react";

const schema = z.object({
  email: z.string().email("Bitte eine gültige E-Mail eingeben"),
  password: z.string().min(8, "Mindestens 8 Zeichen"),
});
type FormData = z.infer<typeof schema>;

// ─── Google Icon ─────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// ─── Microsoft Icon ──────────────────────────────────────────────────────────
function MicrosoftIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11.4 2H2v9.4h9.4V2z" fill="#F25022"/>
      <path d="M22 2h-9.4v9.4H22V2z" fill="#7FBA00"/>
      <path d="M11.4 12.6H2V22h9.4v-9.4z" fill="#00A4EF"/>
      <path d="M22 12.6h-9.4V22H22v-9.4z" fill="#FFB900"/>
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh, isAdminUser, employee } = useAuth();
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "microsoft" | null>(null);

  const oauthError = params.get("error");

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      await login(data.email, data.password);
      toast.success("Willkommen zurück!");
      window.location.href = "/dashboard";
    } catch {
      toast.error("Login fehlgeschlagen. Bitte E-Mail und Passwort prüfen.");
      setLoading(false);
    }
  }

  function handleGoogle() {
    setOauthLoading("google");
    loginWithGoogle(window.location.origin);
  }

  function handleMicrosoft() {
    setOauthLoading("microsoft");
    loginWithMicrosoft(window.location.origin);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
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
          {/* OAuth error banner */}
          {oauthError && (
            <div className="mb-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              Social Login fehlgeschlagen. Bitte erneut versuchen oder mit E-Mail anmelden.
            </div>
          )}

          {/* Social Buttons */}
          <div className="space-y-2.5 mb-6">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={oauthLoading !== null}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
            >
              {oauthLoading === "google" ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
              ) : <GoogleIcon />}
              Mit Google anmelden
            </button>

            <button
              type="button"
              onClick={handleMicrosoft}
              disabled={oauthLoading !== null}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
            >
              {oauthLoading === "microsoft" ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
              ) : <MicrosoftIcon />}
              Mit Microsoft anmelden
            </button>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-gray-400">oder mit E-Mail</span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">E-Mail</label>
              <input
                {...register("email")}
                id="email"
                type="email"
                autoComplete="email"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#4F772D] focus:ring-2 focus:ring-[#4F772D]/20"
                placeholder="name@sustainista.net"
              />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">Passwort</label>
              <input
                {...register("password")}
                id="password"
                type="password"
                autoComplete="current-password"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#4F772D] focus:ring-2 focus:ring-[#4F772D]/20"
                placeholder="••••••••"
              />
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading || oauthLoading !== null}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#4F772D] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#31572C] disabled:opacity-60"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <LogIn className="h-4 w-4" strokeWidth={1.5} />
              )}
              {loading ? "Wird angemeldet…" : "Anmelden"}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between">
            <Link href="/forgot-password" className="text-xs text-gray-400 hover:text-[#4F772D] transition">
              Passwort vergessen?
            </Link>
            <Link href="/register" className="text-xs font-medium text-[#4F772D] hover:underline">
              Jetzt registrieren →
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Sustainista GmbH · HR-System · DSGVO-konform
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#4F772D] border-t-transparent" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
