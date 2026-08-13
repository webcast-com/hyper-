import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { publicPost, updateDb } from "@/lib/db";
import { sharePostPrisma } from "@/lib/prisma-direct-interactions";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to share posts." }, { status: 401 });
  const { id } = await params;
  if (process.env.DATA_DRIVER !== "json") {
    const post = await sharePostPrisma(id, user).catch((err) => ({ error: err.message } as const));
    if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    if ("error" in post) return NextResponse.json({ error: post.error }, { status: 400 });
    return NextResponse.json({ post });
  }
  const post = await updateDb((db) => {
    const found = db.posts.find((item) => item.id === id);
    if (!found) return null;
    found.shares = (found.shares || 0) + 1;
    return publicPost(found, db.users);
  });
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  return NextResponse.json({ post });
}
