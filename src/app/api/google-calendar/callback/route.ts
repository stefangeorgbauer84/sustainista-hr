import { NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"
import { createServerSupabase } from "@/lib/supabase-server"

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  const state = req.nextUrl.searchParams.get("state") // employee_id

  if (!code) return NextResponse.redirect(new URL("/dashboard?gcal=error", req.url))
  if (!state) return NextResponse.redirect(new URL("/dashboard?error=invalid_state", req.url))

  const supabase = await createServerSupabase()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.redirect(new URL("/auth/login", req.url))

  // Verify employee belongs to authenticated user
  const { data: profile } = await supabase
    .from("profiles")
    .select("employee_id")
    .eq("id", user.id)
    .single()

  if (!profile || profile.employee_id !== state) {
    return NextResponse.redirect(new URL("/dashboard?error=forbidden", req.url))
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )

  let refreshToken: string | null = null
  try {
    const tokenResponse = await oauth2Client.getToken(code)
    refreshToken = (tokenResponse as { tokens?: { refresh_token?: string | null } }).tokens?.refresh_token ?? null
  } catch {
    return NextResponse.redirect(new URL("/dashboard?error=calendar_auth_failed", req.url))
  }

  await supabase
    .from("employees")
    .update({ custom_fields: { googleRefreshToken: refreshToken, googleCalendarConnected: true } })
    .eq("id", state)

  return NextResponse.redirect(new URL("/dashboard?gcal=connected", req.url))
}
