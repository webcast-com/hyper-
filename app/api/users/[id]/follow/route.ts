import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addNotification, isBlockedBetween, toSafeUser, updateDb } from "@/lib/db";
import { toggleFollowPrisma } from "@/lib/prisma-direct-users";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Sign in to follow creators." }, { status: 401 });
  const { id } = await params;
  if (id === currentUser.id) return NextResponse.json({ error: "You cannot follow yourself." }, { status: 400 });

  if (process.env.DATA_DRIVER !== "json") {
    const result = await toggleFollowPrisma(currentUser, id).catch((err) => ({ error: err.message } as const));
    if (!result) return NextResponse.json({ error: "Creator not found." }, { status: 404 });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  const result = await updateDb((db) => {
    const me = db.users.find((user) => user.id === currentUser.id);
    const target = db.users.find((user) => user.id === id);
    if (!me || !target) return null;
    if (isBlockedBetween(me, target)) throw new Error("You cannot follow this user.");
    const following = me.following.includes(id);
    if (following) {
      me.following = me.following.filter((uid) => uid !== id);
      target.followers = target.followers.filter((uid) => uid !== me.id);
    } else {
      me.following.push(id);
      target.followers.push(me.id);
      addNotification(db, { recipientId: target.id, actorId: me.id, type: "follow" });
    }
    return { user: toSafeUser(target), isFollowing: !following };
  });

  if (!result) return NextResponse.json({ error: "Creator not found." }, { status: 404 });
  return NextResponse.json(result);
}
