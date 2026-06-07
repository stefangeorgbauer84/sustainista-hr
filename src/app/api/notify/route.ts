import { NextRequest, NextResponse } from "next/server";
import { Client, Messaging } from "node-appwrite";

const serverClient = new Client()
  .setEndpoint("https://cloud.appwrite.io/v1")
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const messaging = new Messaging(serverClient);

export async function POST(req: NextRequest) {
  const { to, subject, body } = await req.json() as {
    to: string[];
    subject: string;
    body: string;
  };

  if (!to?.length || !subject || !body) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  try {
    await messaging.createEmail(
      "unique()",
      subject,
      body,
      [],    // topics
      to,    // userIds
      [],    // targets
      [],    // cc
      [],    // bcc
      [],    // attachments
      false, // draft
      true   // html
    );
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
