import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { databases } from "@/lib/appwrite";

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state"); // employeeId

  if (!code) return NextResponse.redirect(new URL("/dashboard?gcal=error", req.url));

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const { tokens } = await oauth2Client.getToken(code);

  if (state) {
    await databases.updateDocument(DB_ID, "employees", state, {
      googleRefreshToken: tokens.refresh_token ?? null,
      googleCalendarConnected: true,
    });
  }

  return NextResponse.redirect(new URL("/dashboard?gcal=connected", req.url));
}
