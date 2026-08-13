import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { runNotificationDigests } from "@/lib/digests";

export const runtime = "nodejs";

function hasCronSecret(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("x-cron-secret") === secret || new URL(request.url).searchParams.get("secret") === secret;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const cronAccess = hasCronSecret(request);
  if (!cronAccess && !hasPermission(user, "admin:system")) return NextResponse.json({ error: "Admin or cron access required." }, { status: 403 });
  const frequency = new URL(request.url).searchParams.get("frequency") === "weekly" ? "weekly" : "daily";
  return NextResponse.json({ ok: true, result: await runNotificationDigests(frequency) });
}
