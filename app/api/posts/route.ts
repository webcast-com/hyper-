import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addNotification, canViewPost, extractMentionedUsers, id, now, publicPost, readDb, updateDb } from "@/lib/db";
import type { PostVisibility } from "@/lib/types";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { createPostPrisma, listPostsPrisma } from "@/lib/prisma-direct-posts";
import { createPostSchema, parseJson } from "@/lib/validation";
import { emitWebhook } from "@/lib/webhooks";
import { checkModeration, createModerationFlags } from "@/lib/moderation";

export const runtime = "nodejs";

const VISIBILITY = new Set(["public", "followers", "friends", "only_me"]);

function engagementScore(post: { likes: string[]; comments: unknown[]; shares?: number; reactions?: Record<string, string[] | undefined>; createdAt: string }) {
  const reactionCount = Object.values(post.reactions || {}).reduce((sum, users) => sum + (users?.length || 0), 0);
  const engagement = post.likes.length + post.comments.length * 2 + (post.shares || 0) * 3 + reactionCount;
  const ageHours = Math.max((Date.now() - Date.parse(post.createdAt)) / 36e5, 1);
  return engagement / Math.pow(ageHours, 0.45);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 8), 1), 25);
  const cursor = searchParams.get("cursor");
  const feed = searchParams.get("feed") || "latest";
  const viewer = await getCurrentUser();

  if (process.env.DATA_DRIVER !== "json") {
    const data = await listPostsPrisma({ limit, cursor, feed, viewer });
    return NextResponse.json(data);
  }

  const db = await readDb();
  let visible = db.posts.filter((post) => canViewPost(post, viewer, db.users));

  if (feed === "following" && viewer) {
    visible = visible.filter((post) => post.authorId === viewer.id || viewer.following.includes(post.authorId));
  } else if (feed === "friends" && viewer) {
    visible = visible.filter((post) => post.authorId === viewer.id || viewer.friends.includes(post.authorId));
  } else if (feed === "communities") {
    visible = visible.filter((post) => post.groupId || post.eventId);
  }

  const sorted = visible.sort((a, b) => {
    if (feed === "trending") return engagementScore(b) - engagementScore(a);
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });

  const filtered = cursor
    ? sorted.filter((post) => {
        if (feed === "trending") return engagementScore(post) < Number(cursor);
        return Date.parse(post.createdAt) < Date.parse(cursor);
      })
    : sorted;

  const page = filtered.slice(0, limit);
  const nextCursor = filtered.length > limit
    ? feed === "trending"
      ? String(engagementScore(page[page.length - 1]))
      : page[page.length - 1]?.createdAt ?? null
    : null;
  const posts = page.map((post) => publicPost(post, db.users, db.groups, db.events));

  return NextResponse.json({ posts, nextCursor, hasMore: Boolean(nextCursor), feed });
}

export async function POST(request: Request) {
  const limited = await rateLimit(request, "posts:create", 20, 60000);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429, headers: rateLimitHeaders(limited) });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to post." }, { status: 401 });

  const parsed = await parseJson(request, createPostSchema);
  if ("response" in parsed) return parsed.response;
  const body = parsed.data;
  const text = body.body;
  const imageUrl = body.imageUrl;
  const visibility = body.visibility && VISIBILITY.has(body.visibility) ? (body.visibility as PostVisibility) : user.settings.defaultPostVisibility;
  const pollQuestion = body.pollQuestion;
  const pollOptions = body.pollOptions
    .split("\n")
    .map((option) => option.trim())
    .filter(Boolean)
    .slice(0, 5);
  const poll = pollQuestion && pollOptions.length >= 2
    ? {
        question: pollQuestion,
        allowMultiple: Boolean(body.pollAllowMultiple),
        options: pollOptions.map((text, index) => ({ id: id("opt"), text: text.slice(0, 80), votes: [] as string[] }))
      }
    : undefined;
  const tags = String(body.tags || "")
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, "").toLowerCase())
    .filter(Boolean)
    .slice(0, 5);

  if (!text && !imageUrl && !poll) {
    return NextResponse.json({ error: "Post text, an image URL, or a poll is required." }, { status: 400 });
  }

  if (pollQuestion && pollOptions.length < 2) {
    return NextResponse.json({ error: "Polls need a question and at least two options." }, { status: 400 });
  }
  const moderation = await checkModeration(text, "post");
  if (!moderation.allowed) return NextResponse.json({ error: "Content blocked by moderation rules." }, { status: 400 });

  if (process.env.DATA_DRIVER !== "json") {
    const post = await createPostPrisma({ user, text, imageUrl, poll, tags, visibility });
    await createModerationFlags({ text, targetType: "post", targetId: post.id, actorId: user.id });
  await emitWebhook({ event: "post.created", actorId: user.id, payload: { postId: post.id, authorId: user.id } });
  return NextResponse.json({ post }, { status: 201 });
  }

  const post = await updateDb((db) => {
    const newPost = {
      id: id("post"),
      authorId: user.id,
      body: text,
      imageUrl,
      poll,
      tags,
      visibility,
      likes: [],
      reactions: {},
      shares: 0,
      comments: [],
      createdAt: now()
    };
    db.posts.push(newPost);
    extractMentionedUsers(text, db.users).forEach((mentioned) => {
      addNotification(db, { recipientId: mentioned.id, actorId: user.id, type: "mention", postId: newPost.id });
    });
    return publicPost(newPost, db.users);
  });

  await createModerationFlags({ text, targetType: "post", targetId: post.id, actorId: user.id });
  await emitWebhook({ event: "post.created", actorId: user.id, payload: { postId: post.id, authorId: user.id } });
  return NextResponse.json({ post }, { status: 201 });
}
