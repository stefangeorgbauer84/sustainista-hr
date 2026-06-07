import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { databases } from "@/lib/appwrite";
import { Query } from "appwrite";

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const TYPE_LABELS: Record<string, string> = {
  vacation: "Urlaub",
  sick: "Krankenstand",
  unpaid: "Unbezahlter Urlaub",
  special: "Sonderurlaub",
};

export async function POST(req: NextRequest) {
  const { employeeId, refreshToken } = await req.json() as {
    employeeId: string;
    refreshToken: string;
  };

  if (!employeeId || !refreshToken) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  // Alle genehmigten Abwesenheiten dieses Mitarbeiters holen
  const res = await databases.listDocuments(DB_ID, "leave_requests", [
    Query.equal("employeeId", employeeId),
    Query.equal("status", "approved"),
    Query.limit(100),
  ]);

  let synced = 0;
  for (const leave of res.documents) {
    const l = leave as unknown as {
      type: string; startDate: string; endDate: string; reason?: string;
    };
    await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: `${TYPE_LABELS[l.type] ?? l.type} — Sustainista HR`,
        start: { date: l.startDate },
        end: { date: l.endDate },
        description: l.reason ?? "",
        transparency: "transparent",
        visibility: "private",
        extendedProperties: {
          private: { source: "sustainista-hr", employeeId },
        },
      },
    });
    synced++;
  }

  return NextResponse.json({ synced });
}
