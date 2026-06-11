import { NextRequest, NextResponse } from "next/server";

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
const PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
const SESSION_COOKIE = "appwrite-session";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "E-Mail und Passwort erforderlich" }, { status: 400 });
  }

  const sessionRes = await fetch(`${ENDPOINT}/account/sessions/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Appwrite-Project": PROJECT },
    body: JSON.stringify({ email, password }),
  });

  if (!sessionRes.ok) {
    const err = await sessionRes.json().catch(() => ({}));
    return NextResponse.json({ error: err.message ?? "Login fehlgeschlagen" }, { status: 401 });
  }

  // The real session token lives in X-Fallback-Cookies header as JSON
  const fallbackCookies = sessionRes.headers.get("x-fallback-cookies");
  let sessionToken: string | null = null;
  if (fallbackCookies) {
    try {
      const parsed = JSON.parse(fallbackCookies);
      sessionToken = parsed[`a_session_${PROJECT}`] ?? null;
    } catch { /* ignore */ }
  }

  if (!sessionToken) {
    return NextResponse.json({ error: "Session konnte nicht erstellt werden" }, { status: 500 });
  }

  // Fetch user to determine admin role using the session token
  const userRes = await fetch(`${ENDPOINT}/account`, {
    headers: {
      "X-Appwrite-Project": PROJECT,
      "X-Fallback-Cookies": JSON.stringify({ [`a_session_${PROJECT}`]: sessionToken }),
    },
  });

  const user = userRes.ok ? await userRes.json() : null;
  const isAdmin = Array.isArray(user?.labels) && user.labels.includes("admin");

  const maxAge = 60 * 60 * 24 * 30;
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };

  const res = NextResponse.json({ success: true, isAdmin, sessionToken, projectId: PROJECT });
  res.cookies.set(SESSION_COOKIE, sessionToken, cookieOpts);
  res.cookies.set("appwrite-role", isAdmin ? "admin" : "employee", cookieOpts);
  return res;
}
