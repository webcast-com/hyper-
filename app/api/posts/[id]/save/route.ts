import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canViewPost, publicPost, updateDb } from "@/lib/db";
import { savePostPrisma } from "@/lib/prisma-direct-interactions";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to save posts." }, { status: 401 });
  const { id } = await params;

  if (process.env.DATA_DRIVER !== "json") {
    const result = await savePostPrisma(id, user).catch((err) => ({ error: err.message } as const));
    if (!result) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  const result = await updateDb((db) => {
    const me = db.users.find((candidate) => candidate.id === user.id);
    const post = db.posts.find((item) => item.id === id);
    if (!me || !post) return null;
    if (!canViewPost(post, me, db.users)) throw new Error("You cannot save this post.");
    const isSaved = me.savedPosts.includes(id);
    if (isSaved) me.savedPosts = me.savedPosts.filter((postId) => postId !== id);
    else me.savedPosts.unshift(id);
    return { post: publicPost(post, db.users), isSaved: !isSaved, savedPosts: me.savedPosts };
  }).catch((err) => ({ error: err.message } as const));

  if (!result) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
