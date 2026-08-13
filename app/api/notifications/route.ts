import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { publicNotification, readDb } from "@/lib/db";
import { listNotificationsPrisma } from "@/lib/prisma-direct-notifications";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view notifications." }, { status: 401 });

  if (process.env.DATA_DRIVER !== "json") {
    return NextResponse.json(await listNotificationsPrisma(user.id));
  }

  const db = await readDb();
  const notifications = db.notifications
    .filter((notification) => notification.recipientId === user.id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 30)
    .map((notification) => publicNotification(notification, db.users, db.posts));

  const unreadCount = db.notifications.filter((notification) => notification.recipientId === user.id && !notification.read).length;

  return NextResponse.json({ notifications, unreadCount });
}
