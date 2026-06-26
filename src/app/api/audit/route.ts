import { createServerSupabase } from "@/lib/supabase-server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { action, target_id, metadata } = await request.json()
  if (!action) return NextResponse.json({ error: "Missing action" }, { status: 400 })

  const supabase = await createServerSupabase()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single()

  await supabase.from("audit_log").insert({
    company_id: profile?.company_id ?? null,
    actor_user_id: user.id,
    action,
    target_id: target_id ?? null,
    metadata: metadata ?? null,
  })

  return NextResponse.json({ ok: true })
}
