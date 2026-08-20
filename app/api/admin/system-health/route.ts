import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { describeDataBackend, isJsonDriver } from "@/lib/data-driver";
import { readDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

function envStatus() {
  return {
    nodeEnv: process.env.NODE_ENV || "development",
    dataDriver: describeDataBackend().driver,
    dataStore: describeDataBackend().store,
    databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
    mediaProvider: process.env.MEDIA_PROVIDER || "local",
    mailProvider: process.env.MAIL_PROVIDER || "console",
    rateLimitDriver: process.env.RATE_LIMIT_DRIVER || "auto",
    upstashConfigured: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    cloudinaryConfigured: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_UPLOAD_PRESET),
    monitoringWebhookConfigured: Boolean(process.env.MONITORING_WEBHOOK_URL),
    cronSecretConfigured: Boolean(process.env.CRON_SECRET),
    sessionSecretConfigured: Boolean(process.env.SESSION_SECRET)
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!hasPermission(user, "admin:system")) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const startedAt = Date.now();
  const memory = process.memoryUsage();
  let database: Record<string, unknown> = { status: "unknown" };

  try {
    if (process.env.DATA_DRIVER !== "json") {
      const db = prisma();
      const [users, posts, reports, auditLogs, mediaAssets] = await Promise.all([
        db.user.count(),
        db.post.count(),
        db.report.count(),
        db.auditLog.count(),
        db.mediaAsset.count()
      ]);
      database = { status: "ok", driver: "prisma", counts: { users, posts, reports, auditLogs, mediaAssets } };
    } else {
      const db: any = await readDb();
      database = {
        status: "ok",
        driver: "json",
        counts: {
          users: db.users?.length || 0,
          posts: db.posts?.length || 0,
          reports: db.reports?.length || 0,
          auditLogs: db.auditLogs?.length || 0,
          mediaAssets: db.mediaAssets?.length || 0
        }
      };
    }
  } catch (error) {
    database = { status: "error", error: (error as Error).message };
  }

  const payload = {
    status: database.status === "ok" ? "ok" : "degraded",
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    uptimeSec: Math.round(process.uptime()),
    memory: {
      rss: memory.rss,
      heapTotal: memory.heapTotal,
      heapUsed: memory.heapUsed,
      external: memory.external
    },
    env: envStatus(),
    database
  };

  logger.info("admin system health checked", { actorId: user!.id, status: payload.status, latencyMs: payload.latencyMs });
  return NextResponse.json(payload, { status: payload.status === "ok" ? 200 : 503 });
}
