import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addNotification, id, isBlockedBetween, now, publicConversation, updateDb } from "@/lib/db";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { listConversationsPrisma, sendMessagePrisma } from "@/lib/prisma-direct-messages";
import { messageSchema, parseJson } from "@/lib/validation";
import { checkModeration, createModerationFlags } from "@/lib/moderation";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view messages." }, { status: 401 });

  if (process.env.DATA_DRIVER !== "json") {
    const conversations = await listConversationsPrisma(user);
    return NextResponse.json({ conversations });
  }

  const conversations = await updateDb((db) => {
    db.conversations.forEach((conversation) => {
      if (conversation.participantIds.includes(user.id)) {
        conversation.messages.forEach((message) => {
          if (message.recipientId === user.id) message.read = true;
        });
      }
    });
    return db.conversations
      .filter((conversation) => conversation.participantIds.includes(user.id))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .map((conversation) => publicConversation(conversation, db.users, user.id));
  });

  return NextResponse.json({ conversations });
}

export async function POST(request: Request) {
  const limited = await rateLimit(request, "messages:send", 40, 60000);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429, headers: rateLimitHeaders(limited) });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to send messages." }, { status: 401 });

  const parsed = await parseJson(request, messageSchema);
  if ("response" in parsed) return parsed.response;
  const { recipientId, text } = parsed.data;
  if (recipientId === user.id) return NextResponse.json({ error: "You cannot message yourself." }, { status: 400 });
  const moderation = await checkModeration(text, "message");
  if (!moderation.allowed) return NextResponse.json({ error: "Message blocked by moderation rules." }, { status: 400 });

  if (process.env.DATA_DRIVER !== "json") {
    const result = await sendMessagePrisma({ sender: user, recipientId, text }).catch((err) => ({ error: err.message } as const));
    if (!result) return NextResponse.json({ error: "Recipient not found." }, { status: 404 });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    await createModerationFlags({ text, targetType: "message", targetId: result.id || "conversation", actorId: user.id });
  return NextResponse.json({ conversation: result }, { status: 201 });
  }

  const result = await updateDb((db) => {
    const recipient = db.users.find((candidate) => candidate.id === recipientId);
    if (!recipient) return null;
    const me = db.users.find((candidate) => candidate.id === user.id);
    if (isBlockedBetween(me, recipient)) throw new Error("You cannot message this user.");
    if (recipient.settings.allowMessagesFrom === "none") throw new Error("This user is not accepting messages.");
    if (recipient.settings.allowMessagesFrom === "friends" && !(me?.friends.includes(recipient.id) && recipient.friends.includes(me.id))) {
      throw new Error("This user only accepts messages from friends.");
    }
    let conversation = db.conversations.find((item) => item.participantIds.includes(user.id) && item.participantIds.includes(recipientId));
    const timestamp = now();
    if (!conversation) {
      conversation = { id: id("conv"), participantIds: [user.id, recipientId], messages: [], createdAt: timestamp, updatedAt: timestamp };
      db.conversations.push(conversation);
    }
    conversation.messages.push({ id: id("msg"), senderId: user.id, recipientId, text, read: false, createdAt: timestamp });
    conversation.updatedAt = timestamp;
    addNotification(db, { recipientId, actorId: user.id, type: "message" });
    return publicConversation(conversation, db.users, user.id);
  });

  if (!result) return NextResponse.json({ error: "Recipient not found." }, { status: 404 });
  await createModerationFlags({ text, targetType: "message", targetId: result.id || "conversation", actorId: user.id });
  return NextResponse.json({ conversation: result }, { status: 201 });
}
