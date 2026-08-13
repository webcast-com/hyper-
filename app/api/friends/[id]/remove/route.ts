import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { updateDb } from "@/lib/db";
import { removeFriendPrisma } from "@/lib/prisma-direct-users";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage friends." }, { status: 401 });
  const { id } = await params;
  if (process.env.DATA_DRIVER !== "json") {
    const ok = await removeFriendPrisma(user, id);
    if (!ok) return NextResponse.json({ error: "Friend not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  const ok = await updateDb((db) => {
    const me = db.users.find((item) => item.id === user.id);
    const friend = db.users.find((item) => item.id === id);
    if (!me || !friend) return false;
    me.friends = me.friends.filter((friendId) => friendId !== id);
    friend.friends = friend.friends.filter((friendId) => friendId !== me.id);
    return true;
  });
  if (!ok) return NextResponse.json({ error: "Friend not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
