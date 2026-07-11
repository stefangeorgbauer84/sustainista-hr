import { createServerSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/permissions";

/**
 * Server-side RBAC-enforced payroll data endpoint.
 * Manager-Rolle erhält niemals brutto/pfaendung — Supabase RLS allein reicht nicht,
 * da custom_fields ein JSONB-Blob ist der nicht row-level selektiv ist.
 */
export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 403 });
  }

  if (!hasPermission(profile.role, "view:payroll")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canSeeSalary = hasPermission(profile.role, "view:brutto");

  // Never ship SVNR/tax_id/IBAN via payroll export endpoint
  const selectCols = [
    "id",
    "employee_number",
    "first_name",
    "last_name",
    "employment_type",
    "cost_center_id",
    "kv_id",
    "is_active",
    "custom_fields",
  ].join(",");

  const { data, error: empErr } = await supabase
    .from("employees")
    .select(selectCols)
    .eq("company_id", profile.company_id)
    .eq("is_active", true)
    .order("last_name")
    .limit(500);

  if (empErr) {
    return NextResponse.json({ error: empErr.message }, { status: 500 });
  }

  type RowType = {
    id: string;
    employee_number: string | null;
    first_name: string;
    last_name: string;
    employment_type: string;
    cost_center_id: string | null;
    kv_id: string | null;
    is_active: boolean;
    custom_fields: Record<string, unknown> | null;
  };

  const employees = ((data ?? []) as unknown as RowType[]).map((emp) => {
    if (canSeeSalary) return emp;
    const cf = { ...(emp.custom_fields ?? {}) };
    delete cf["brutto"];
    delete cf["pfaendung"];
    delete cf["pfaendung_betrag"];
    delete cf["pfaendung_glaeubiger"];
    return { ...emp, custom_fields: cf };
  });

  return NextResponse.json({ data: employees });
}
