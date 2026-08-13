import { promises as fs } from "fs";
import path from "path";
import { prisma } from "./prisma";
import { readDb, writeDb } from "./db";
import { auditLog } from "./audit";

type MaintenanceOptions = {
  dryRun?: boolean;
  auditRetentionDays?: number;
  notificationRetentionDays?: number;
};

type MaintenanceResult = {
  dryRun: boolean;
  expiredStories: number;
  oldReadNotifications: number;
  oldAuditLogs: number;
  orphanedLocalFiles: string[];
  deletedLocalFiles: string[];
  checkedAt: string;
};

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

async function localUploadFiles() {
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  try {
    const files = await fs.readdir(uploadDir);
    return { uploadDir, files };
  } catch {
    return { uploadDir, files: [] as string[] };
  }
}

async function cleanLocalFiles(knownFilenames: Set<string>, dryRun: boolean) {
  const { uploadDir, files } = await localUploadFiles();
  const orphaned = files.filter((file) => !knownFilenames.has(file));
  const deleted: string[] = [];
  if (!dryRun) {
    for (const file of orphaned) {
      try {
        await fs.unlink(path.join(uploadDir, file));
        deleted.push(file);
      } catch {
        // Ignore file races.
      }
    }
  }
  return { orphaned, deleted };
}

export async function runMaintenance(options: MaintenanceOptions = {}): Promise<MaintenanceResult> {
  const dryRun = Boolean(options.dryRun);
  const auditRetentionDays = options.auditRetentionDays ?? 90;
  const notificationRetentionDays = options.notificationRetentionDays ?? 90;
  const checkedAt = new Date().toISOString();

  let expiredStories = 0;
  let oldReadNotifications = 0;
  let oldAuditLogs = 0;
  let knownLocalFilenames = new Set<string>();

  if (process.env.DATA_DRIVER !== "json") {
    const db = prisma();
    const now = new Date();
    const notificationCutoff = daysAgo(notificationRetentionDays);
    const auditCutoff = daysAgo(auditRetentionDays);

    const [expiredStoryCount, oldNotificationCount, oldAuditCount, localAssets] = await Promise.all([
      db.story.count({ where: { expiresAt: { lt: now } } }),
      db.notification.count({ where: { read: true, createdAt: { lt: notificationCutoff } } }),
      db.auditLog.count({ where: { createdAt: { lt: auditCutoff } } }),
      db.mediaAsset.findMany({ where: { provider: "local" }, select: { filename: true } })
    ]);

    expiredStories = expiredStoryCount;
    oldReadNotifications = oldNotificationCount;
    oldAuditLogs = oldAuditCount;
    knownLocalFilenames = new Set(localAssets.map((asset) => asset.filename));

    if (!dryRun) {
      await db.$transaction([
        db.story.deleteMany({ where: { expiresAt: { lt: now } } }),
        db.notification.deleteMany({ where: { read: true, createdAt: { lt: notificationCutoff } } }),
        db.auditLog.deleteMany({ where: { createdAt: { lt: auditCutoff } } })
      ]);
    }
  } else {
    const db: any = await readDb();
    const now = Date.now();
    const notificationCutoff = daysAgo(notificationRetentionDays).getTime();
    const auditCutoff = daysAgo(auditRetentionDays).getTime();
    const beforeStories = db.stories?.length || 0;
    const beforeNotifications = db.notifications?.length || 0;
    const beforeAudit = db.auditLogs?.length || 0;

    const nextStories = (db.stories || []).filter((story: any) => Date.parse(story.expiresAt) >= now);
    const nextNotifications = (db.notifications || []).filter((notification: any) => !(notification.read && Date.parse(notification.createdAt) < notificationCutoff));
    const nextAuditLogs = (db.auditLogs || []).filter((log: any) => Date.parse(log.createdAt) >= auditCutoff);

    expiredStories = beforeStories - nextStories.length;
    oldReadNotifications = beforeNotifications - nextNotifications.length;
    oldAuditLogs = beforeAudit - nextAuditLogs.length;
    knownLocalFilenames = new Set((db.mediaAssets || []).filter((asset: any) => asset.provider === "local").map((asset: any) => asset.filename));

    if (!dryRun) {
      db.stories = nextStories;
      db.notifications = nextNotifications;
      db.auditLogs = nextAuditLogs;
      await writeDb(db);
    }
  }

  const { orphaned, deleted } = await cleanLocalFiles(knownLocalFilenames, dryRun);

  const result: MaintenanceResult = {
    dryRun,
    expiredStories,
    oldReadNotifications,
    oldAuditLogs,
    orphanedLocalFiles: orphaned,
    deletedLocalFiles: deleted,
    checkedAt
  };

  if (!dryRun) {
    await auditLog({ action: "system.maintenance", targetType: "system", metadata: result });
  }

  return result;
}
