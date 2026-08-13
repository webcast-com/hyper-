import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { publicFriendRequest, readDb, toSafeUser } from "@/lib/db";
import { friendsPrisma } from "@/lib/prisma-direct-users";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view friends." }, { status: 401 });

  if (process.env.DATA_DRIVER !== "json") return NextResponse.json(await friendsPrisma(user));

  const db = await readDb();
  const me = db.users.find((item) => item.id === user.id)!;
  const friends = db.users.filter((candidate) => me.friends.includes(candidate.id)).map(toSafeUser);
  const incoming = db.friendRequests
    .filter((request) => request.recipientId === user.id && request.status === "pending")
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((request) => publicFriendRequest(request, db.users));
  const outgoing = db.friendRequests
    .filter((request) => request.senderId === user.id && request.status === "pending")
    .map((request) => publicFriendRequest(request, db.users));
  const excluded = new Set([user.id, ...me.friends, ...incoming.map((r) => r.senderId), ...outgoing.map((r) => r.recipientId)]);
  const suggestions = db.users
    .filter((candidate) => !excluded.has(candidate.id))
    .sort((a, b) => b.followers.length - a.followers.length)
    .slice(0, 6)
    .map(toSafeUser);

  return NextResponse.json({ friends, incoming, outgoing, suggestions });
}
