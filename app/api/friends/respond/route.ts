import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addNotification, now, publicFriendRequest, updateDb } from "@/lib/db";
import { respondFriendRequestPrisma } from "@/lib/prisma-direct-users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to respond to requests." }, { status: 401 });
  const body = await request.json();
  const requestId = String(body.requestId || "");
  const action = body.action === "decline" ? "declined" : "accepted";

  if (process.env.DATA_DRIVER !== "json") {
    const result = await respondFriendRequestPrisma(user, requestId, action);
    if (!result) return NextResponse.json({ error: "Friend request not found." }, { status: 404 });
    return NextResponse.json({ request: result });
  }

  const result = await updateDb((db) => {
    const friendRequest = db.friendRequests.find((item) => item.id === requestId && item.recipientId === user.id && item.status === "pending");
    if (!friendRequest) return null;
    friendRequest.status = action;
    friendRequest.respondedAt = now();
    if (action === "accepted") {
      const sender = db.users.find((item) => item.id === friendRequest.senderId);
      const recipient = db.users.find((item) => item.id === friendRequest.recipientId);
      if (sender && recipient) {
        if (!sender.friends.includes(recipient.id)) sender.friends.push(recipient.id);
        if (!recipient.friends.includes(sender.id)) recipient.friends.push(sender.id);
        addNotification(db, { recipientId: sender.id, actorId: recipient.id, type: "friend_accept" });
      }
    }
    return publicFriendRequest(friendRequest, db.users);
  });

  if (!result) return NextResponse.json({ error: "Friend request not found." }, { status: 404 });
  return NextResponse.json({ request: result });
}
