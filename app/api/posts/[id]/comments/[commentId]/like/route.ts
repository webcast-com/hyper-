import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addNotification, isBlockedBetween, publicPost, updateDb } from "@/lib/db";
import { likeCommentPrisma } from "@/lib/prisma-direct-interactions";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string; commentId: string }> };

export async function POST(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to like comments." }, { status: 401 });
  const { id: postId, commentId } = await params;

  if (process.env.DATA_DRIVER !== "json") {
    const post = await likeCommentPrisma(postId, commentId, user).catch((err) => ({ error: err.message } as const));
    if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    if ("error" in post) return NextResponse.json({ error: post.error }, { status: 400 });
    return NextResponse.json({ post });
  }

  const post = await updateDb((db) => {
    const found = db.posts.find((p) => p.id === postId);
    if (!found) return null;
    const author = db.users.find((item) => item.id === found.authorId);
    if (isBlockedBetween(author, user)) throw new Error("You cannot interact with this comment.");
    const comment = found.comments.find((item) => item.id === commentId);
    if (!comment) throw new Error("Comment not found.");
    if (!Array.isArray(comment.likes)) comment.likes = [];
    if (comment.likes.includes(user.id)) comment.likes = comment.likes.filter((id) => id !== user.id);
    else {
      comment.likes.push(user.id);
      addNotification(db, { recipientId: comment.userId, actorId: user.id, type: "like", postId: found.id, commentId: comment.id });
    }
    return publicPost(found, db.users, db.groups, db.events);
  }).catch((err) => ({ error: err.message } as const));

  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  if ("error" in post) return NextResponse.json({ error: post.error }, { status: 400 });
  return NextResponse.json({ post });
}
