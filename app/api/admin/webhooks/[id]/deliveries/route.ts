import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireFeature } from "@/lib/feature-flags";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const feature = await requireFeature("webhooks");
  if (feature) return NextResponse.json(feature, { status: 403 });
  const user = await getCurrentUser();
  if (!hasPermission(user, "admin:system")) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const { id } = await params;
  const deliveries = await prisma().webhookDelivery.findMany({ where: { endpointId: id }, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ deliveries: deliveries.map((d) => ({ ...d, payload: JSON.parse(d.payload || "{}"), createdAt: d.createdAt.toISOString(), deliveredAt: d.deliveredAt?.toISOString() || null, nextAttemptAt: d.nextAttemptAt?.toISOString() || null })) });
}
