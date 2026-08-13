import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { updateDb } from "@/lib/db";
import { toggleMutePrisma } from "@/lib/prisma-direct-users";
import { auditLog } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to mute users." }, { status: 401 });
  const { userId } = await request.json();
  const targetId = String(userId || "");
  if (!targetId || targetId === user.id) return NextResponse.json({ error: "Choose another user." }, { status: 400 });

  if (process.env.DATA_DRIVER !== "json") {
    const result = await toggleMutePrisma(user, targetId);
    if (!result) return NextResponse.json({ error: "User not found." }, { status: 404 });
    return NextResponse.json(result);
  }

  const result = await updateDb((db) => {
    const me = db.users.find((item) => item.id === user.id);
    const target = db.users.find((item) => item.id === targetId);
    if (!me || !target) return null;
    if (me.blockedUsers.includes(targetId)) return { muted: false, blocked: true };
    const muted = me.mutedUsers.includes(targetId);
    if (muted) me.mutedUsers = me.mutedUsers.filter((id) => id !== targetId);
    else me.mutedUsers.push(targetId);
    return { muted: !muted, blocked: false };
  });

  if (!result) return NextResponse.json({ error: "User not found." }, { status: 404 });
  await auditLog({ actorId: user.id, action: "safety.mute_toggle", targetType: "user", targetId, metadata: result, request });
  return NextResponse.json(result);
}
