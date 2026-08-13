import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runMaintenance } from "@/lib/maintenance";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

function hasCronSecret(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("x-cron-secret") === secret || new URL(request.url).searchParams.get("secret") === secret;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!hasPermission(user, "admin:maintenance") && !hasCronSecret(request)) {
    return NextResponse.json({ error: "Admin or cron access required." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get("dryRun") === "true";
  const auditRetentionDays = Number(searchParams.get("auditRetentionDays") || 90);
  const notificationRetentionDays = Number(searchParams.get("notificationRetentionDays") || 90);

  const result = await runMaintenance({ dryRun, auditRetentionDays, notificationRetentionDays });
  return NextResponse.json({ ok: true, result });
}
