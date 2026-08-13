import { prisma } from "./prisma";
import { prismaUserToUser } from "./prisma-direct-auth";
import { id, isBlockedBetween } from "./db";
import type { User } from "./types";

const parse = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};
const json = (value: unknown, fallback: unknown) => JSON.stringify(value ?? fallback);
const iso = (value: Date | string | null | undefined) => new Date(value || Date.now()).toISOString();
const toSafeUser = (user: User) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safe } = user;
  return safe;
};

function publicMessage(message: any, users: User[]) {
  const sender = users.find((user) => user.id === message.senderId);
  const recipient = users.find((user) => user.id === message.recipientId);
  return {
    id: message.id,
    senderId: message.senderId,
    recipientId: message.recipientId,
    text: message.text,
    read: Boolean(message.read),
    createdAt: iso(message.createdAt),
    sender: sender ? toSafeUser(sender) : null,
    recipient: recipient ? toSafeUser(recipient) : null
  };
}

function publicConversation(conversation: any, messages: any[], users: User[], currentUserId: string) {
  const participantIds = parse<string[]>(conversation.participantIds, []);
  const participants = participantIds
    .map((participantId) => users.find((user) => user.id === participantId))
    .filter(Boolean)
    .map((user) => toSafeUser(user!));
  const otherUser = participants.find((user) => user.id !== currentUserId) ?? participants[0] ?? null;
  const unreadCount = messages.filter((message) => message.recipientId === currentUserId && !message.read).length;
  return {
    id: conversation.id,
    participantIds,
    updatedAt: iso(conversation.updatedAt),
    createdAt: iso(conversation.createdAt),
    participants,
    otherUser,
    unreadCount,
    messages: messages
      .slice()
      .sort((a, b) => Date.parse(iso(a.createdAt)) - Date.parse(iso(b.createdAt)))
      .map((message) => publicMessage(message, users))
  };
}

export async function listConversationsPrisma(currentUser: User) {
  const db = prisma();
  const rawConversations = await db.conversation.findMany({
    where: { participantIds: { contains: currentUser.id } },
    orderBy: { updatedAt: "desc" },
    include: { messages: true }
  });

  const conversations = rawConversations.filter((conversation) => parse<string[]>(conversation.participantIds, []).includes(currentUser.id));
  const conversationIds = conversations.map((conversation) => conversation.id);

  if (conversationIds.length) {
    await db.message.updateMany({
      where: { conversationId: { in: conversationIds }, recipientId: currentUser.id, read: false },
      data: { read: true }
    });
  }

  const freshConversations = conversationIds.length
    ? await db.conversation.findMany({
        where: { id: { in: conversationIds } },
        orderBy: { updatedAt: "desc" },
        include: { messages: true }
      })
    : [];

  const userIds = Array.from(new Set(freshConversations.flatMap((conversation) => parse<string[]>(conversation.participantIds, []))));
  const users = (await db.user.findMany({ where: { id: { in: userIds } } })).map(prismaUserToUser);

  return freshConversations.map((conversation) => publicConversation(conversation, conversation.messages, users, currentUser.id));
}

export async function getUnreadMessageCountPrisma(currentUserId: string) {
  return prisma().message.count({ where: { recipientId: currentUserId, read: false } });
}

export async function sendMessagePrisma({ sender, recipientId, text }: { sender: User; recipientId: string; text: string }) {
  const db = prisma();
  const recipientRaw = await db.user.findUnique({ where: { id: recipientId } });
  if (!recipientRaw) return null;
  const recipient = prismaUserToUser(recipientRaw);

  if (isBlockedBetween(sender, recipient)) throw new Error("You cannot message this user.");
  if (recipient.settings.allowMessagesFrom === "none") throw new Error("This user is not accepting messages.");
  if (recipient.settings.allowMessagesFrom === "friends" && !(sender.friends.includes(recipient.id) && recipient.friends.includes(sender.id))) {
    throw new Error("This user only accepts messages from friends.");
  }

  const rawConversations = await db.conversation.findMany({
    where: { AND: [{ participantIds: { contains: sender.id } }, { participantIds: { contains: recipientId } }] },
    include: { messages: true }
  });
  let conversation = rawConversations.find((item) => {
    const participants = parse<string[]>(item.participantIds, []);
    return participants.includes(sender.id) && participants.includes(recipientId);
  });

  const now = new Date();
  if (!conversation) {
    conversation = await db.conversation.create({
      data: { id: id("conv"), participantIds: json([sender.id, recipientId], []), createdAt: now, updatedAt: now },
      include: { messages: true }
    });
  }

  await db.message.create({
    data: { id: id("msg"), conversationId: conversation.id, senderId: sender.id, recipientId, text, read: false, createdAt: now }
  });
  await db.conversation.update({ where: { id: conversation.id }, data: { updatedAt: now } });

  if (recipient.settings.notifyMessages) {
    await db.notification.create({
      data: { id: id("notif"), recipientId, actorId: sender.id, type: "message", read: false, createdAt: now }
    });
  }

  const fresh = await db.conversation.findUniqueOrThrow({ where: { id: conversation.id }, include: { messages: true } });
  return publicConversation(fresh, fresh.messages, [sender, recipient], sender.id);
}
