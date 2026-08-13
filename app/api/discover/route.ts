import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readDb, toSafeUser } from "@/lib/db";
import { discoverUsersPrisma } from "@/lib/prisma-direct-discovery";

export const runtime = "nodejs";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (process.env.DATA_DRIVER !== "json") {
    const users = await discoverUsersPrisma(currentUser);
    return NextResponse.json({ users });
  }

  const db = await readDb();
  const users = db.users
    .filter((user) => user.settings?.profileDiscoverable || currentUser?.id === user.id)
    .map(toSafeUser)
    .sort((a, b) => b.followers.length - a.followers.length)
    .map((user) => ({
      ...user,
      isFollowing: currentUser ? currentUser.following.includes(user.id) : false,
      isMe: currentUser?.id === user.id
    }));
  return NextResponse.json({ users });
}
