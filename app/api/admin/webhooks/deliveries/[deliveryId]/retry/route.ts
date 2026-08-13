import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { retryWebhookDelivery } from "@/lib/webhooks";
import { auditLog } from "@/lib/audit";
import { requireFeature } from "@/lib/feature-flags";

export const runtime = "nodejs";
type Params = { params: Promise<{ deliveryId: string }> };

export async function POST(request: Request, { params }: Params) {
  const feature = await requireFeature("webhooks");
  if (feature) return NextResponse.json(feature, { status: 403 });
  const user = await getCurrentUser();
  if (!hasPermission(user, "admin:system")) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const { deliveryId } = await params;
  const result = await retryWebhookDelivery(deliveryId);
  if (!result) return NextResponse.json({ error: "Webhook delivery not found." }, { status: 404 });
  await auditLog({ actorId: user!.id, action: "webhook.delivery_retry", targetType: "webhook_delivery", targetId: deliveryId, metadata: result, request });
  return NextResponse.json({ ok: true, result });
}
