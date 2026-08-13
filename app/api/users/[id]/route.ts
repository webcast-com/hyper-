import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canViewPost, publicPost, readDb, toSafeUser } from "@/lib/db";
import { getUserProfilePrisma } from "@/lib/prisma-direct-users";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (process.env.DATA_DRIVER !== "json") {
    const result = await getUserProfilePrisma(id, currentUser);
    if (!result) return NextResponse.json({ error: "Creator not found." }, { status: 404 });
    return NextResponse.json(result);
  }

  const db = await readDb();
  const user = db.users.find((u) => u.id === id || u.username === id);
  if (!user) return NextResponse.json({ error: "Creator not found." }, { status: 404 });
  const posts = db.posts
    .filter((post) => post.authorId === user.id && canViewPost(post, currentUser, db.users))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((post) => publicPost(post, db.users));
  return NextResponse.json({
    user: { ...toSafeUser(user), isFollowing: currentUser ? currentUser.following.includes(user.id) : false },
    posts
  });
}
