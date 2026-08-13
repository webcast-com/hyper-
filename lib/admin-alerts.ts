import { id, readDb, writeDb } from "./db";
import { prisma } from "./prisma";
import { auditLog } from "./audit";

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus = "open" | "acknowledged" | "resolved";

type AlertInput = {
  type: string;
  severity?: AlertSeverity;
  title: string;
  message: string;
  source?: string;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
};

const iso = (value?: Date | string | null) => new Date(value || Date.now()).toISOString();
const parse = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};

export async function createAdminAlert(input: AlertInput) {
  const severity = input.severity || "warning";
  const metadata = { ...(input.metadata || {}), ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}) };

  if (process.env.DATA_DRIVER !== "json") {
    if (input.dedupeKey) {
      const existing = await prisma().adminAlert.findFirst({
        where: { status: { in: ["open", "acknowledged"] }, metadata: { contains: input.dedupeKey } },
        orderBy: { createdAt: "desc" }
      });
      if (existing) return existing;
    }
    return prisma().adminAlert.create({
      data: {
        id: id("alert"),
        type: input.type,
        severity,
        title: input.title,
        message: input.message,
        source: input.source,
        metadata: JSON.stringify(metadata)
      }
    });
  }

  const db: any = await readDb();
  if (!Array.isArray(db.adminAlerts)) db.adminAlerts = [];
  if (input.dedupeKey) {
    const existing = db.adminAlerts.find((a: any) => ["open", "acknowledged"].includes(a.status) && JSON.stringify(a.metadata || {}).includes(input.dedupeKey!));
    if (existing) return existing;
  }
  const alert = { id: id("alert"), type: input.type, severity, title: input.title, message: input.message, status: "open", source: input.source, metadata, createdAt: iso(), updatedAt: iso() };
  db.adminAlerts.push(alert);
  await writeDb(db);
  return alert;
}

export async function listAdminAlerts(status = "open", limit = 100) {
  if (process.env.DATA_DRIVER !== "json") {
    const alerts = await prisma().adminAlert.findMany({
      where: status === "all" ? {} : { status },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 250)
    });
    return alerts.map((a) => ({ ...a, metadata: parse(a.metadata, {}), createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString(), resolvedAt: a.resolvedAt?.toISOString() || null }));
  }
  const db: any = await readDb();
  return (db.adminAlerts || []).filter((a: any) => status === "all" || a.status === status).sort((a: any,b: any)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).slice(0, limit);
}

export async function updateAdminAlert(alertId: string, status: AlertStatus, actorId?: string, reason?: string) {
  if (process.env.DATA_DRIVER !== "json") {
    const alert = await prisma().adminAlert.update({
      where: { id: alertId },
      data: { status, resolvedAt: status === "resolved" ? new Date() : null, resolvedBy: status === "resolved" ? actorId : null }
    }).catch(() => null);
    if (!alert) return null;
    await auditLog({ actorId, action: "admin.alert_status", targetType: "admin_alert", targetId: alertId, metadata: { status, reason } });
    return { ...alert, metadata: parse(alert.metadata, {}), createdAt: alert.createdAt.toISOString(), updatedAt: alert.updatedAt.toISOString(), resolvedAt: alert.resolvedAt?.toISOString() || null };
  }
  const db: any = await readDb();
  const alert = (db.adminAlerts || []).find((a: any) => a.id === alertId);
  if (!alert) return null;
  alert.status = status; alert.updatedAt = iso();
  if (status === "resolved") { alert.resolvedAt = iso(); alert.resolvedBy = actorId; }
  await writeDb(db);
  await auditLog({ actorId, action: "admin.alert_status", targetType: "admin_alert", targetId: alertId, metadata: { status, reason } });
  return alert;
}
