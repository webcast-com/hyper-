import { id, updateDb } from "./db";
import { prisma } from "./prisma";

export type AuditInput = {
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  request?: Request;
};

function requestMeta(request?: Request) {
  if (!request) return { ip: null, userAgent: null };
  return {
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null,
    userAgent: request.headers.get("user-agent") || null
  };
}

export async function auditLog(input: AuditInput) {
  const { ip, userAgent } = requestMeta(input.request);
  const entry = {
    id: id("audit"),
    actorId: input.actorId || null,
    action: input.action,
    targetType: input.targetType || null,
    targetId: input.targetId || null,
    metadata: input.metadata || {},
    ip,
    userAgent,
    createdAt: new Date().toISOString()
  };

  try {
    if (process.env.DATA_DRIVER !== "json") {
      await prisma().auditLog.create({
        data: { ...entry, metadata: JSON.stringify(entry.metadata), createdAt: new Date(entry.createdAt) }
      });
    } else {
      await updateDb((db: any) => {
        if (!Array.isArray(db.auditLogs)) db.auditLogs = [];
        db.auditLogs.push(entry);
        return entry;
      });
    }
  } catch (error) {
    console.error("auditLog failed", error);
  }
}

export async function listAuditLogs({ limit = 100, action }: { limit?: number; action?: string }) {
  if (process.env.DATA_DRIVER !== "json") {
    const logs = await prisma().auditLog.findMany({
      where: action && action !== "all" ? { action } : {},
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 250)
    });
    return logs.map((log) => ({ ...log, metadata: JSON.parse(log.metadata || "{}"), createdAt: log.createdAt.toISOString() }));
  }
  const { readDb } = await import("./db");
  const db: any = await readDb();
  return (db.auditLogs || [])
    .filter((log: any) => !action || action === "all" || log.action === action)
    .sort((a: any, b: any) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit);
}
