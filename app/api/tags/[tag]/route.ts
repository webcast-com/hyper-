import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canViewPost, publicPost, readDb } from "@/lib/db";

export const runtime = "nodejs";

type Params = { params: Promise<{ tag: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { tag } = await params;
  const cleanTag = decodeURIComponent(tag).replace(/^#/, "").toLowerCase();
  const [db, viewer] = await Promise.all([readDb(), getCurrentUser()]);
  const posts = db.posts
    .filter((post) => canViewPost(post, viewer, db.users) && post.tags.some((item) => item.toLowerCase() === cleanTag))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((post) => publicPost(post, db.users));
  return NextResponse.json({ tag: cleanTag, posts });
}
