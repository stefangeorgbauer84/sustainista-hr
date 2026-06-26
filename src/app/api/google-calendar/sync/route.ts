import { NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"
import { createServerSupabase } from "@/lib/supabase-server"

const TYPE_LABELS: Record<string, string> = {
  urlaub: "Urlaub",
  krankenstand: "Krankenstand",
  unbezahlt: "Unbezahlter Urlaub",
  sonderurlaub: "Sonderurlaub",
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { employeeId } = await req.json() as { employeeId: string }
  if (!employeeId) return NextResponse.json({ error: "Missing params" }, { status: 400 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("employee_id")
    .eq("id", user.id)
    .single()

  if (!profile || profile.employee_id !== employeeId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Look up refresh token server-side — never accept from client
  const { data: emp } = await supabase
    .from("employees")
    .select("custom_fields")
    .eq("id", employeeId)
    .single()

  const refreshToken = (emp?.custom_fields as Record<string, string> | null)?.googleRefreshToken
  if (!refreshToken) return NextResponse.json({ error: "Calendar not connected" }, { status: 400 })

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
  oauth2Client.setCredentials({ refresh_token: refreshToken })
  const calendar = google.calendar({ version: "v3", auth: oauth2Client })

  const { data: absences } = await supabase
    .from("absences")
    .select("*, absence_types(code, name)")
    .eq("employee_id", employeeId)
    .eq("status", "approved")
    .limit(100)

  let synced = 0
  await Promise.all((absences ?? []).map(async (a) => {
    const code = (a.absence_types as { code: string } | null)?.code ?? ""
    try {
      await calendar.events.insert({
        calendarId: "primary",
        requestBody: {
          summary: `${TYPE_LABELS[code] ?? code} — HR`,
          start: { date: a.start_date },
          end: { date: a.end_date },
          description: a.reason ?? "",
          transparency: "transparent",
          visibility: "private",
          extendedProperties: { private: { source: "sustainista-hr", employeeId } },
        },
      })
      synced++
    } catch (e) {
      console.error("Event insert failed:", e)
    }
  }))

  return NextResponse.json({ synced })
}
