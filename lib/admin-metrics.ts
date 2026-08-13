import { id, readDb, writeDb } from "./db";
import { prisma } from "./prisma";
import { auditLog } from "./audit";
import { createAdminAlert } from "./admin-alerts";

const dayKey = (date = new Date()) => date.toISOString().slice(0, 10);
const startOfDay = (date = new Date()) => new Date(`${dayKey(date)}T00:00:00.000Z`);

export async function currentAdminMetrics() {
  if (process.env.DATA_DRIVER !== "json") {
    const db = prisma();
    const today = startOfDay();
    const [users, posts, comments, messages, reports, openReports, moderationFlags, openModerationFlags, marketplaceListings, groups, events, challenges, auditLogs] = await Promise.all([
      db.user.count(),
      db.post.count(),
      db.comment.count(),
      db.message.count(),
      db.report.count(),
      db.report.count({ where: { status: "open" } }),
      db.moderationFlag.count(),
      db.moderationFlag.count({ where: { status: "open" } }),
      db.marketplaceListing.count({ where: { active: true } }),
      db.group.count(),
      db.event.count(),
      db.challenge.count(),
      db.auditLog.count({ where: { createdAt: { gte: today } } })
    ]);
    return { users, posts, comments, messages, reports, openReports, moderationFlags, openModerationFlags, marketplaceListings, groups, events, challenges, auditLogsToday: auditLogs };
  }

  const db: any = await readDb();
  return {
    users: db.users?.length || 0,
    posts: db.posts?.length || 0,
    comments: (db.posts || []).reduce((sum: number, post: any) => sum + (post.comments?.length || 0), 0),
    messages: (db.conversations || []).reduce((sum: number, conv: any) => sum + (conv.messages?.length || 0), 0),
    reports: db.reports?.length || 0,
    openReports: (db.reports || []).filter((r: any) => r.status === "open").length,
    moderationFlags: db.moderationFlags?.length || 0,
    openModerationFlags: (db.moderationFlags || []).filter((f: any) => f.status === "open").length,
    marketplaceListings: (db.marketplaceListings || []).filter((l: any) => l.active).length,
    groups: db.groups?.length || 0,
    events: db.events?.length || 0,
    challenges: db.challenges?.length || 0,
    auditLogsToday: 0
  };
}

export async function createAdminMetricSnapshot(actorId?: string) {
  const date = dayKey();
  const metrics = await currentAdminMetrics();
  if (metrics.openReports >= Number(process.env.ALERT_OPEN_REPORTS_THRESHOLD || 25)) await createAdminAlert({ type: "reports.high_open_count", severity: "warning", title: "High open report count", message: `${metrics.openReports} reports are currently open.`, source: "metrics", metadata: { openReports: metrics.openReports }, dedupeKey: "reports.high_open_count" });
  if (metrics.openModerationFlags >= Number(process.env.ALERT_OPEN_MOD_FLAGS_THRESHOLD || 25)) await createAdminAlert({ type: "moderation.high_open_flags", severity: "warning", title: "High moderation flag count", message: `${metrics.openModerationFlags} moderation flags are currently open.`, source: "metrics", metadata: { openModerationFlags: metrics.openModerationFlags }, dedupeKey: "moderation.high_open_flags" });

  if (process.env.DATA_DRIVER !== "json") {
    const snapshot = await prisma().adminMetricSnapshot.upsert({
      where: { date },
      create: { id: id("metric"), date, metrics: JSON.stringify(metrics) },
      update: { metrics: JSON.stringify(metrics) }
    });
    await auditLog({ actorId, action: "admin.metrics_snapshot", targetType: "metrics", targetId: snapshot.id, metadata: { date } });
    return { id: snapshot.id, date: snapshot.date, metrics: JSON.parse(snapshot.metrics), createdAt: snapshot.createdAt.toISOString() };
  }
  const db: any = await readDb();
  if (!Array.isArray(db.adminMetricSnapshots)) db.adminMetricSnapshots = [];
  let snapshot = db.adminMetricSnapshots.find((s: any) => s.date === date);
  if (!snapshot) { snapshot = { id: id("metric"), date, createdAt: new Date().toISOString() }; db.adminMetricSnapshots.push(snapshot); }
  snapshot.metrics = metrics;
  await writeDb(db);
  await auditLog({ actorId, action: "admin.metrics_snapshot", targetType: "metrics", targetId: snapshot.id, metadata: { date } });
  return snapshot;
}

export async function listAdminMetricSnapshots(limit = 30) {
  if (process.env.DATA_DRIVER !== "json") {
    const snapshots = await prisma().adminMetricSnapshot.findMany({ orderBy: { date: "desc" }, take: Math.min(Math.max(limit, 1), 365) });
    return snapshots.map((s) => ({ id: s.id, date: s.date, metrics: JSON.parse(s.metrics), createdAt: s.createdAt.toISOString() }));
  }
  const db: any = await readDb();
  return (db.adminMetricSnapshots || []).sort((a: any, b: any) => b.date.localeCompare(a.date)).slice(0, limit);
}
