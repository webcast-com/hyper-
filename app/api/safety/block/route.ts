import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { updateDb } from "@/lib/db";
import { toggleBlockPrisma } from "@/lib/prisma-direct-users";
import { auditLog } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to block users." }, { status: 401 });
  const { userId } = await request.json();
  const targetId = String(userId || "");
  if (!targetId || targetId === user.id) return NextResponse.json({ error: "Choose another user." }, { status: 400 });

  if (process.env.DATA_DRIVER !== "json") {
    const result = await toggleBlockPrisma(user, targetId);
    if (!result) return NextResponse.json({ error: "User not found." }, { status: 404 });
    return NextResponse.json(result);
  }

  const result = await updateDb((db) => {
    const me = db.users.find((item) => item.id === user.id);
    const target = db.users.find((item) => item.id === targetId);
    if (!me || !target) return null;
    const blocked = me.blockedUsers.includes(targetId);
    if (blocked) {
      me.blockedUsers = me.blockedUsers.filter((id) => id !== targetId);
    } else {
      me.blockedUsers.push(targetId);
      me.mutedUsers = me.mutedUsers.filter((id) => id !== targetId);
      me.friends = me.friends.filter((id) => id !== targetId);
      target.friends = target.friends.filter((id) => id !== me.id);
      me.following = me.following.filter((id) => id !== targetId);
      target.followers = target.followers.filter((id) => id !== me.id);
      db.friendRequests = db.friendRequests.filter((request) => !([me.id, targetId].includes(request.senderId) && [me.id, targetId].includes(request.recipientId)));
    }
    return { blocked: !blocked };
  });

  if (!result) return NextResponse.json({ error: "User not found." }, { status: 404 });
  await auditLog({ actorId: user.id, action: "safety.block_toggle", targetType: "user", targetId, metadata: result, request });
  return NextResponse.json(result);
}
