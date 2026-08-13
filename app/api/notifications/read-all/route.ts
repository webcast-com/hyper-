import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { updateDb } from "@/lib/db";
import { markAllNotificationsReadPrisma } from "@/lib/prisma-direct-notifications";

export const runtime = "nodejs";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to update notifications." }, { status: 401 });

  if (process.env.DATA_DRIVER !== "json") {
    const marked = await markAllNotificationsReadPrisma(user.id);
    return NextResponse.json({ ok: true, marked });
  }

  const unreadCount = await updateDb((db) => {
    let marked = 0;
    db.notifications.forEach((notification) => {
      if (notification.recipientId === user.id && !notification.read) {
        notification.read = true;
        marked += 1;
      }
    });
    return marked;
  });

  return NextResponse.json({ ok: true, marked: unreadCount });
}
