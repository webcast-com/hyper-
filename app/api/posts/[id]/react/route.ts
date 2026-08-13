import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addNotification, publicPost, reactionTypes, updateDb } from "@/lib/db";
import type { ReactionType } from "@/lib/types";
import { reactPostPrisma } from "@/lib/prisma-direct-interactions";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to react." }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const reaction = String(body.reaction || "like") as ReactionType;
  if (!reactionTypes.includes(reaction)) return NextResponse.json({ error: "Unsupported reaction." }, { status: 400 });

  if (process.env.DATA_DRIVER !== "json") {
    const post = await reactPostPrisma(id, user, reaction).catch((err) => ({ error: err.message } as const));
    if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    if ("error" in post) return NextResponse.json({ error: post.error }, { status: 400 });
    return NextResponse.json({ post });
  }

  const post = await updateDb((db) => {
    const found = db.posts.find((item) => item.id === id);
    if (!found) return null;
    if (!found.reactions) found.reactions = {};
    reactionTypes.forEach((type) => {
      found.reactions[type] = (found.reactions[type] || []).filter((userId) => userId !== user.id);
    });
    found.reactions[reaction] = [...(found.reactions[reaction] || []), user.id];
    if (reaction === "like" && !found.likes.includes(user.id)) found.likes.push(user.id);
    addNotification(db, { recipientId: found.authorId, actorId: user.id, type: "like", postId: found.id });
    return publicPost(found, db.users);
  });

  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  return NextResponse.json({ post });
}
