import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { id, now, publicPost, updateDb } from "@/lib/db";
import { createGroupPostPrisma } from "@/lib/prisma-direct-community";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to post in groups." }, { status: 401 });

  const { id: groupId } = await params;
  const body = await request.json();
  const text = String(body.body || "").trim();
  const imageUrl = String(body.imageUrl || "").trim();
  const tags = String(body.tags || "")
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, "").toLowerCase())
    .filter(Boolean)
    .slice(0, 5);

  if (!text && !imageUrl) return NextResponse.json({ error: "Post text or image is required." }, { status: 400 });

  if (process.env.DATA_DRIVER !== "json") {
    const post = await createGroupPostPrisma(groupId, user, { body: text, imageUrl, tags }).catch((err) => ({ error: err.message } as const));
    if (!post) return NextResponse.json({ error: "Group not found." }, { status: 404 });
    if ("error" in post) return NextResponse.json({ error: post.error }, { status: 400 });
    return NextResponse.json({ post }, { status: 201 });
  }

  const post = await updateDb((db) => {
    const group = db.groups.find((item) => item.id === groupId);
    if (!group) return null;
    if (!group.memberIds.includes(user.id)) throw new Error("Join this group before posting.");
    const created = {
      id: id("post"),
      authorId: user.id,
      groupId,
      body: text,
      imageUrl,
      tags,
      visibility: "public" as const,
      likes: [],
      reactions: {},
      shares: 0,
      comments: [],
      createdAt: now()
    };
    db.posts.push(created);
    return publicPost(created, db.users, db.groups);
  }).catch((err) => ({ error: err.message } as const));

  if (!post) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  if ("error" in post) return NextResponse.json({ error: post.error }, { status: 400 });
  return NextResponse.json({ post }, { status: 201 });
}
