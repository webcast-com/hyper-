import { id } from "./db";
import { prisma } from "./prisma";
import { prismaUserToUser } from "./prisma-direct-auth";
import { sendMail } from "./mail";
import { auditLog } from "./audit";
import { createAdminAlert } from "./admin-alerts";

const parse = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};

function sinceFor(frequency: "daily" | "weekly") {
  const days = frequency === "weekly" ? 7 : 1;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function notificationLine(notification: any) {
  const actor = notification.actor?.name || "A creator";
  if (notification.type === "like") return `${actor} liked something you posted.`;
  if (notification.type === "comment") return `${actor} commented or replied.`;
  if (notification.type === "follow") return `${actor} followed you.`;
  if (notification.type === "friend_request") return `${actor} sent a friend request.`;
  if (notification.type === "friend_accept") return `${actor} accepted your friend request.`;
  if (notification.type === "message") return `${actor} sent you a message.`;
  if (notification.type === "mention") return `${actor} mentioned you.`;
  return `${actor} interacted with you.`;
}

export async function runNotificationDigests(frequency: "daily" | "weekly" = "daily") {
  if (process.env.DATA_DRIVER === "json") return { processed: 0, sent: 0, failed: 0, skipped: 0 };
  const db = prisma();
  const users = (await db.user.findMany()).map(prismaUserToUser).filter((user) => user.settings.digestFrequency === frequency);
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const since = sinceFor(frequency);

  for (const user of users) {
    const alreadySent = await db.notificationDigest.findFirst({
      where: { userId: user.id, frequency, createdAt: { gte: since }, status: "sent" }
    });
    if (alreadySent) { skipped += 1; continue; }

    const notifications = await db.notification.findMany({
      where: { recipientId: user.id, createdAt: { gte: since } },
      include: { actor: true, post: true },
      orderBy: { createdAt: "desc" },
      take: 25
    });
    if (!notifications.length) { skipped += 1; continue; }

    const subject = `Your ${frequency} Creator Connect digest`;
    const lines = notifications.map(notificationLine);
    const digest = await db.notificationDigest.create({
      data: { id: id("digest"), userId: user.id, frequency, subject, itemCount: notifications.length, status: "pending" }
    });

    try {
      await sendMail({
        to: user.email,
        subject,
        text: `Hi ${user.name}, here is your ${frequency} digest:\n\n${lines.map((line) => `• ${line}`).join("\n")}\n\nOpen Creator Connect: ${process.env.APP_URL || "http://localhost:3000"}`,
        html: `<h1>Your ${frequency} Creator Connect digest</h1><p>Hi ${user.name}, here are your latest updates:</p><ul>${lines.map((line) => `<li>${line}</li>`).join("")}</ul><p><a href="${process.env.APP_URL || "http://localhost:3000"}">Open Creator Connect</a></p>`,
        category: `notification_digest_${frequency}`,
        userId: user.id
      });
      await db.notificationDigest.update({ where: { id: digest.id }, data: { status: "sent", sentAt: new Date() } });
      sent += 1;
    } catch (error) {
      await db.notificationDigest.update({ where: { id: digest.id }, data: { status: "failed", error: (error as Error).message } });
      await createAdminAlert({ type: "digest.failed", severity: "warning", title: "Notification digest failed", message: `Digest for ${user.email} failed: ${(error as Error).message}`, source: "digests", metadata: { userId: user.id, frequency }, dedupeKey: `digest:${user.id}:${frequency}` });
      failed += 1;
    }
  }

  await auditLog({ action: "notification_digest.run", targetType: "system", metadata: { frequency, processed: users.length, sent, failed, skipped } });
  return { processed: users.length, sent, failed, skipped };
}

export async function listNotificationDigests(limit = 100) {
  if (process.env.DATA_DRIVER === "json") return [];
  const digests = await prisma().notificationDigest.findMany({ orderBy: { createdAt: "desc" }, take: Math.min(Math.max(limit, 1), 250) });
  return digests.map((digest) => ({ ...digest, sentAt: digest.sentAt?.toISOString() || null, createdAt: digest.createdAt.toISOString() }));
}
