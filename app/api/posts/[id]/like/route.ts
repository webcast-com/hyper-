import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addNotification, isBlockedBetween, publicPost, updateDb } from "@/lib/db";
import { likePostPrisma } from "@/lib/prisma-direct-interactions";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to like posts." }, { status: 401 });
  const { id } = await params;

  if (process.env.DATA_DRIVER !== "json") {
    const post = await likePostPrisma(id, user).catch((err) => ({ error: err.message } as const));
    if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    if ("error" in post) return NextResponse.json({ error: post.error }, { status: 400 });
    return NextResponse.json({ post });
  }

  const post = await updateDb((db) => {
    const found = db.posts.find((p) => p.id === id);
    if (!found) return null;
    const author = db.users.find((item) => item.id === found.authorId);
    if (isBlockedBetween(author, user)) throw new Error("You cannot interact with this post.");
    if (found.likes.includes(user.id)) {
      found.likes = found.likes.filter((like) => like !== user.id);
    } else {
      found.likes.push(user.id);
      addNotification(db, { recipientId: found.authorId, actorId: user.id, type: "like", postId: found.id });
    }
    return publicPost(found, db.users);
  });

  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  return NextResponse.json({ post });
}
