import { NextRequest, NextResponse } from "next/server";

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
const PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
const SESSION_COOKIE = "appwrite-session";

export async function GET(req: NextRequest) {
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionToken) {
    return NextResponse.json(null, { status: 401 });
  }

  const res = await fetch(`${ENDPOINT}/account`, {
    headers: {
      "X-Appwrite-Project": PROJECT,
      "X-Fallback-Cookies": JSON.stringify({ [`a_session_${PROJECT}`]: sessionToken }),
    },
  });

  if (!res.ok) return NextResponse.json(null, { status: 401 });
  const user = await res.json();
  return NextResponse.json({ ...user, _sessionToken: sessionToken, _projectId: PROJECT });
}
