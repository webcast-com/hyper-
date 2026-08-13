import { prisma } from "./prisma";
import { prismaUserToUser } from "./prisma-direct-auth";
import type { User } from "./types";

const parse = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};
const iso = (value: Date | string | null | undefined) => new Date(value || Date.now()).toISOString();
const toSafeUser = (user: User) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safe } = user;
  return safe;
};

function publicNotification(notification: any, users: User[]) {
  const actor = users.find((user) => user.id === notification.actorId);
  const post = notification.post;
  return {
    id: notification.id,
    recipientId: notification.recipientId,
    actorId: notification.actorId,
    type: notification.type,
    postId: notification.postId || undefined,
    commentId: notification.commentId || undefined,
    read: notification.read,
    createdAt: iso(notification.createdAt),
    actor: actor ? toSafeUser(actor) : null,
    post: post ? {
      id: post.id,
      body: post.body,
      imageUrl: post.imageUrl || "",
      authorId: post.authorId,
      tags: parse<string[]>(post.tags, []),
      likes: parse<string[]>(post.likes, []),
      shares: post.shares || 0
    } : null
  };
}

export async function listNotificationsPrisma(userId: string) {
  const db = prisma();
  const [notifications, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { post: true }
    }),
    db.notification.count({ where: { recipientId: userId, read: false } })
  ]);

  const actorIds = Array.from(new Set(notifications.map((notification) => notification.actorId)));
  const users = actorIds.length
    ? (await db.user.findMany({ where: { id: { in: actorIds } } })).map(prismaUserToUser)
    : [];

  return {
    notifications: notifications.map((notification) => publicNotification(notification, users)),
    unreadCount
  };
}

export async function markAllNotificationsReadPrisma(userId: string) {
  const result = await prisma().notification.updateMany({
    where: { recipientId: userId, read: false },
    data: { read: true }
  });
  return result.count;
}
