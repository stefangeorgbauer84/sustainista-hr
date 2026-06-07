"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { account } from "@/lib/appwrite";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Leaf } from "lucide-react";

const schema = z.object({
  password: z.string().min(8, "Mindestens 8 Zeichen"),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, {
  message: "Passwörter stimmen nicht überein",
  path: ["confirm"],
});

type FormData = z.infer<typeof schema>;

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const userId = params.get("userId") ?? "";
  const secret = params.get("secret") ?? "";
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    if (!userId || !secret) {
      toast.error("Ungültiger Reset-Link");
      return;
    }
    setLoading(true);
    try {
      await account.updateRecovery(userId, secret, data.password);
      toast.success("Passwort erfolgreich geändert!");
      router.replace("/login");
    } catch {
      toast.error("Link ungültig oder abgelaufen. Bitte erneut anfordern.");
    } finally {
      setLoading(false);
    }
  }

  const inp = "w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-[#4F772D] focus:outline-none focus:ring-2 focus:ring-[#4F772D]/20";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Neues Passwort</label>
        <input {...register("password")} type="password" className={inp} placeholder="••••••••" />
        {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Passwort bestätigen</label>
        <input {...register("confirm")} type="password" className={inp} placeholder="••••••••" />
        {errors.confirm && <p className="mt-1 text-xs text-red-500">{errors.confirm.message}</p>}
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[#4F772D] py-2.5 text-sm font-medium text-white hover:bg-[#31572C] disabled:opacity-60 transition"
      >
        {loading ? "Wird gespeichert…" : "Passwort setzen"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#4F772D]">
            <Leaf className="h-7 w-7 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Neues Passwort setzen</h1>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <Suspense fallback={<p className="text-sm text-gray-400 text-center">Wird geladen…</p>}>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
