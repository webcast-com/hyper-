import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { requireFeature } from "@/lib/feature-flags";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const feature = await requireFeature("webhooks");
  if (feature) return NextResponse.json(feature, { status: 403 });
  const user = await getCurrentUser();
  if (!hasPermission(user, "admin:system")) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  const data: any = {};
  if (typeof body.url === "string") data.url = body.url.trim();
  if (typeof body.description === "string") data.description = body.description.slice(0, 200);
  if (Array.isArray(body.events)) data.events = JSON.stringify(body.events.map(String));
  if (typeof body.active === "boolean") data.active = body.active;
  const endpoint = await prisma().webhookEndpoint.update({ where: { id }, data }).catch(() => null);
  if (!endpoint) return NextResponse.json({ error: "Webhook endpoint not found." }, { status: 404 });
  await auditLog({ actorId: user!.id, action: "webhook.endpoint_update", targetType: "webhook", targetId: id, metadata: data, request });
  return NextResponse.json({ endpoint: { ...endpoint, secret: "[redacted]", events: JSON.parse(endpoint.events || "[]") } });
}

export async function DELETE(request: Request, { params }: Params) {
  const feature = await requireFeature("webhooks");
  if (feature) return NextResponse.json(feature, { status: 403 });
  const user = await getCurrentUser();
  if (!hasPermission(user, "admin:system")) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reason = String(body.reason || "").trim().slice(0, 500);
  await prisma().webhookEndpoint.delete({ where: { id } }).catch(() => null);
  await auditLog({ actorId: user!.id, action: "webhook.endpoint_delete", targetType: "webhook", targetId: id, metadata: { reason }, request });
  return NextResponse.json({ ok: true });
}
