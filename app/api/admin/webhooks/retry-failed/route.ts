import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { retryFailedWebhookDeliveries } from "@/lib/webhooks";
import { auditLog } from "@/lib/audit";
import { requireFeature } from "@/lib/feature-flags";

export const runtime = "nodejs";

function hasCronSecret(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("x-cron-secret") === secret || new URL(request.url).searchParams.get("secret") === secret;
}

export async function POST(request: Request) {
  const feature = await requireFeature("webhooks");
  if (feature) return NextResponse.json(feature, { status: 403 });
  const user = await getCurrentUser();
  const cronAccess = hasCronSecret(request);
  if (!cronAccess && !hasPermission(user, "admin:system")) {
    return NextResponse.json({ error: "Admin or cron access required." }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 25), 1), 100);
  const retried = await retryFailedWebhookDeliveries(limit);
  await auditLog({ actorId: user?.id, action: "webhook.retry_failed", targetType: "webhook", metadata: { retried, limit, cronAccess }, request });
  return NextResponse.json({ ok: true, retried });
}
