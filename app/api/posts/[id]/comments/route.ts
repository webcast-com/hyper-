import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addNotification, extractMentionedUsers, id, isBlockedBetween, now, publicPost, updateDb } from "@/lib/db";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { createCommentPrisma } from "@/lib/prisma-direct-interactions";
import { commentSchema, parseJson } from "@/lib/validation";
import { checkModeration, createModerationFlags } from "@/lib/moderation";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const limited = await rateLimit(request, "comments:create", 30, 60000);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429, headers: rateLimitHeaders(limited) });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to comment." }, { status: 401 });
  const { id: postId } = await params;
  const parsed = await parseJson(request, commentSchema);
  if ("response" in parsed) return parsed.response;
  const clean = parsed.data.text;
  const parentId = parsed.data.parentId;
  const moderation = await checkModeration(clean, "comment");
  if (!moderation.allowed) return NextResponse.json({ error: "Content blocked by moderation rules." }, { status: 400 });

  if (process.env.DATA_DRIVER !== "json") {
    const post = await createCommentPrisma(postId, user, clean, parentId).catch((err) => ({ error: err.message } as const));
    if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    if ("error" in post) return NextResponse.json({ error: post.error }, { status: 400 });
    const createdComment = post.comments?.[post.comments.length - 1];
  if (createdComment) await createModerationFlags({ text: clean, targetType: "comment", targetId: createdComment.id, actorId: user.id });
  return NextResponse.json({ post }, { status: 201 });
  }

  const post = await updateDb((db) => {
    const found = db.posts.find((p) => p.id === postId);
    if (!found) return null;
    const author = db.users.find((item) => item.id === found.authorId);
    if (isBlockedBetween(author, user)) throw new Error("You cannot comment on this post.");
    const parent = parentId ? found.comments.find((comment) => comment.id === parentId) : null;
    if (parentId && !parent) throw new Error("Parent comment not found.");
    const comment = { id: id("c"), userId: user.id, text: clean, parentId, likes: [], createdAt: now() };
    found.comments.push(comment);

    const recipientId = parent?.userId || found.authorId;
    addNotification(db, { recipientId, actorId: user.id, type: "comment", postId: found.id, commentId: comment.id });
    extractMentionedUsers(clean, db.users).forEach((mentioned) => {
      addNotification(db, { recipientId: mentioned.id, actorId: user.id, type: "mention", postId: found.id, commentId: comment.id });
    });
    return publicPost(found, db.users, db.groups, db.events);
  }).catch((err) => ({ error: err.message } as const));

  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  if ("error" in post) return NextResponse.json({ error: post.error }, { status: 400 });
  const createdComment = post.comments?.[post.comments.length - 1];
  if (createdComment) await createModerationFlags({ text: clean, targetType: "comment", targetId: createdComment.id, actorId: user.id });
  return NextResponse.json({ post }, { status: 201 });
}
