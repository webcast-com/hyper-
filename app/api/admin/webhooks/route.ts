import { NextResponse } from "next/server";
import crypto from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { webhookDeliveryStats } from "@/lib/webhooks";
import { requireFeature } from "@/lib/feature-flags";

export const runtime = "nodejs";

export async function GET() {
  const feature = await requireFeature("webhooks");
  if (feature) return NextResponse.json(feature, { status: 403 });
  const user = await getCurrentUser();
  if (!hasPermission(user, "admin:system")) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const endpoints = await prisma().webhookEndpoint.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { deliveries: true } } } });
  const stats = await webhookDeliveryStats();
  return NextResponse.json({ endpoints: endpoints.map((e) => ({ ...e, secret: "[redacted]", events: JSON.parse(e.events || "[]") })), stats });
}

export async function POST(request: Request) {
  const feature = await requireFeature("webhooks");
  if (feature) return NextResponse.json(feature, { status: 403 });
  const user = await getCurrentUser();
  if (!hasPermission(user, "admin:system")) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const body = await request.json();
  const url = String(body.url || "").trim();
  if (!/^https?:\/\//.test(url)) return NextResponse.json({ error: "Valid webhook URL is required." }, { status: 400 });
  const events = Array.isArray(body.events) ? body.events.map(String) : [];
  const endpoint = await prisma().webhookEndpoint.create({ data: { id: `wh_${crypto.randomBytes(8).toString("hex")}`, url, description: String(body.description || "").slice(0, 200), secret: crypto.randomBytes(24).toString("base64url"), events: JSON.stringify(events), active: body.active !== false } });
  await auditLog({ actorId: user!.id, action: "webhook.endpoint_create", targetType: "webhook", targetId: endpoint.id, metadata: { url, events }, request });
  return NextResponse.json({ endpoint: { ...endpoint, secret: endpoint.secret, events } }, { status: 201 });
}
