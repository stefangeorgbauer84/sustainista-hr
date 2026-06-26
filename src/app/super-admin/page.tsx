"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Building2, Globe, Leaf, Users, ArrowRight, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { Company } from "@/types";

interface CompanyWithStats extends Company {
  employeeCount: number;
}

function CompanyIcon({ icon }: { icon?: string }) {
  const cls = "h-5 w-5 text-white";
  if (icon === "building") return <Building2 className={cls} strokeWidth={1.5} />;
  if (icon === "globe") return <Globe className={cls} strokeWidth={1.5} />;
  return <Leaf className={cls} strokeWidth={1.5} />;
}

export default function SuperAdminPage() {
  const { company: myCompany } = useAuth();
  const [companies, setCompanies] = useState<CompanyWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: comps } = await supabase
        .from("companies")
        .select("id, name, slug, legal_name, brand_config, settings, subscription_tier, is_active, created_at, updated_at")
        .order("name");

      if (!comps) { setLoading(false); return; }

      const withStats = await Promise.all(
        comps.map(async (c) => {
          const { count } = await supabase
            .from("employees")
            .select("id", { count: "exact", head: true })
            .eq("company_id", c.id)
            .eq("is_active", true);
          return { ...c, employeeCount: count ?? 0 } as CompanyWithStats;
        })
      );

      setCompanies(withStats);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Alle Unternehmen</h1>
        <p className="text-sm text-gray-500 mt-1">{companies.length} Unternehmen im System</p>
      </div>

      <div className="space-y-3">
        {companies.map((c) => {
          const color = c.brand_config?.primaryColor ?? "#6366F1";
          return (
            <div
              key={c.id}
              className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 hover:shadow-sm transition"
            >
              <div
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: color }}
              >
                <CompanyIcon icon={c.brand_config?.icon} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 truncate">{c.name}</p>
                  {c.is_active ? (
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" strokeWidth={1.5} />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" strokeWidth={1.5} />
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  <span className="font-mono">{c.slug}</span> · {c.subscription_tier}
                </p>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" strokeWidth={1.5} />
                  <span>{c.employeeCount}</span>
                </div>
                {c.id === myCompany?.id ? (
                  <Link
                    href="/admin"
                    className="flex items-center gap-1 text-xs font-medium rounded-lg px-3 py-1.5 border border-gray-200 hover:bg-gray-50 transition"
                  >
                    Admin
                    <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
                  </Link>
                ) : (
                  <span className="text-xs text-gray-300 px-3 py-1.5">
                    anderes Unternehmen
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
