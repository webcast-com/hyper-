import crypto from "crypto";
import { id } from "./db";
import { prisma } from "./prisma";
import { auditLog } from "./audit";
import { createAdminAlert } from "./admin-alerts";

export type WebhookEvent =
  | "user.created"
  | "post.created"
  | "report.created"
  | "marketplace.inquiry"
  | "admin.report_status"
  | "admin.user_suspend_toggle";

type EmitInput = {
  event: WebhookEvent;
  payload: Record<string, unknown>;
  actorId?: string;
};

function sign(secret: string, body: string) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

function parseEvents(value: string) {
  try { return JSON.parse(value || "[]") as string[]; } catch { return []; }
}

async function deliver(endpoint: any, event: WebhookEvent, payload: Record<string, unknown>) {
  const body = JSON.stringify({ event, payload, createdAt: new Date().toISOString() });
  const deliveryId = id("whdel");
  const signature = sign(endpoint.secret, body);

  await prisma().webhookDelivery.create({
    data: { id: deliveryId, endpointId: endpoint.id, event, payload: body, status: "pending", attempts: 1 }
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Creator-Connect-Event": event,
        "X-Creator-Connect-Delivery": deliveryId,
        "X-Creator-Connect-Signature": `sha256=${signature}`
      },
      body,
      signal: controller.signal
    });
    const text = (await res.text()).slice(0, 1000);
    await prisma().webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: res.ok ? "delivered" : "failed",
        statusCode: res.status,
        response: text,
        deliveredAt: res.ok ? new Date() : null,
        nextAttemptAt: res.ok ? null : new Date(Date.now() + 5 * 60 * 1000)
      }
    });
    if (!res.ok) await createAdminAlert({ type: "webhook.failed", severity: "warning", title: "Webhook delivery failed", message: `Delivery to ${endpoint.url} returned HTTP ${res.status}`, source: "webhooks", metadata: { endpointId: endpoint.id, event, statusCode: res.status }, dedupeKey: `webhook:${endpoint.id}:${event}` });
  } catch (error) {
    await prisma().webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: "failed", response: (error as Error).message, nextAttemptAt: new Date(Date.now() + 5 * 60 * 1000) }
    });
    await createAdminAlert({ type: "webhook.failed", severity: "warning", title: "Webhook delivery failed", message: `Delivery to ${endpoint.url} failed: ${(error as Error).message}`, source: "webhooks", metadata: { endpointId: endpoint.id, event }, dedupeKey: `webhook:${endpoint.id}:${event}` });
  } finally {
    clearTimeout(timeout);
  }
}

export async function emitWebhook(input: EmitInput) {
  if (process.env.DATA_DRIVER === "json") return;
  try {
    const endpoints = await prisma().webhookEndpoint.findMany({ where: { active: true } });
    const matching = endpoints.filter((endpoint) => {
      const events = parseEvents(endpoint.events);
      return events.length === 0 || events.includes(input.event);
    });
    await Promise.all(matching.map((endpoint) => deliver(endpoint, input.event, input.payload)));
  } catch (error) {
    await auditLog({ actorId: input.actorId, action: "webhook.emit_failed", targetType: "webhook", metadata: { event: input.event, error: (error as Error).message } });
  }
}

export async function retryFailedWebhookDeliveries(limit = 25) {
  const deliveries = await prisma().webhookDelivery.findMany({
    where: { status: "failed", attempts: { lt: 5 }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }] },
    include: { endpoint: true },
    orderBy: { createdAt: "asc" },
    take: limit
  });
  for (const delivery of deliveries) {
    await prisma().webhookDelivery.update({ where: { id: delivery.id }, data: { attempts: { increment: 1 }, status: "retrying" } });
    const payload = JSON.parse(delivery.payload || "{}");
    await deliver(delivery.endpoint, delivery.event as WebhookEvent, payload.payload || payload);
  }
  return deliveries.length;
}

export async function retryWebhookDelivery(deliveryId: string) {
  const delivery = await prisma().webhookDelivery.findUnique({ where: { id: deliveryId }, include: { endpoint: true } });
  if (!delivery) return null;
  await prisma().webhookDelivery.update({ where: { id: delivery.id }, data: { attempts: { increment: 1 }, status: "retrying" } });
  const payload = JSON.parse(delivery.payload || "{}");
  await deliver(delivery.endpoint, delivery.event as WebhookEvent, payload.payload || payload);
  return { deliveryId, event: delivery.event, endpointId: delivery.endpointId };
}

export async function webhookDeliveryStats(endpointId?: string) {
  const where = endpointId ? { endpointId } : {};
  const [total, delivered, failed, pending, retrying] = await Promise.all([
    prisma().webhookDelivery.count({ where }),
    prisma().webhookDelivery.count({ where: { ...where, status: "delivered" } }),
    prisma().webhookDelivery.count({ where: { ...where, status: "failed" } }),
    prisma().webhookDelivery.count({ where: { ...where, status: "pending" } }),
    prisma().webhookDelivery.count({ where: { ...where, status: "retrying" } })
  ]);
  return { total, delivered, failed, pending, retrying };
}
