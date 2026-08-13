import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { getUnreadMessageCountPrisma } from "@/lib/prisma-direct-messages";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view unread messages." }, { status: 401 });

  if (process.env.DATA_DRIVER !== "json") {
    const unreadCount = await getUnreadMessageCountPrisma(user.id);
    return NextResponse.json({ unreadCount });
  }

  const db = await readDb();
  const unreadCount = db.conversations.reduce((count, conversation) => {
    if (!conversation.participantIds.includes(user.id)) return count;
    return count + conversation.messages.filter((message) => message.recipientId === user.id && !message.read).length;
  }, 0);

  return NextResponse.json({ unreadCount });
}
