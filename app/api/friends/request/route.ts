import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addNotification, id, isBlockedBetween, now, publicFriendRequest, updateDb } from "@/lib/db";
import { sendFriendRequestPrisma } from "@/lib/prisma-direct-users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to send friend requests." }, { status: 401 });
  const body = await request.json();
  const recipientId = String(body.userId || body.recipientId || "");
  if (!recipientId || recipientId === user.id) return NextResponse.json({ error: "Choose another user." }, { status: 400 });

  if (process.env.DATA_DRIVER !== "json") {
    const request = await sendFriendRequestPrisma(user, recipientId).catch((err) => ({ error: err.message } as const));
    if (!request) return NextResponse.json({ error: "User not found." }, { status: 404 });
    if ("error" in request) return NextResponse.json({ error: request.error }, { status: 400 });
    return NextResponse.json({ request }, { status: 201 });
  }

  const friendRequest = await updateDb((db) => {
    const me = db.users.find((item) => item.id === user.id);
    const recipient = db.users.find((item) => item.id === recipientId);
    if (!me || !recipient) return null;
    if (isBlockedBetween(me, recipient)) throw new Error("You cannot send a friend request to this user.");
    if (me.friends.includes(recipientId)) throw new Error("You are already friends.");
    const existing = db.friendRequests.find((item) => item.status === "pending" && ((item.senderId === user.id && item.recipientId === recipientId) || (item.senderId === recipientId && item.recipientId === user.id)));
    if (existing) return existing;
    const created = { id: id("fr"), senderId: user.id, recipientId, status: "pending" as const, createdAt: now() };
    db.friendRequests.push(created);
    addNotification(db, { recipientId, actorId: user.id, type: "friend_request" });
    return publicFriendRequest(created, db.users);
  }).catch((err) => ({ error: err.message } as const));

  if (!friendRequest) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if ("error" in friendRequest) return NextResponse.json({ error: friendRequest.error }, { status: 400 });
  return NextResponse.json({ request: friendRequest }, { status: 201 });
}
