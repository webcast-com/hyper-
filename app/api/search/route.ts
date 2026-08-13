import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canViewPost, publicPost, readDb, toSafeUser } from "@/lib/db";
import { searchPrisma } from "@/lib/prisma-direct-discovery";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const viewer = await getCurrentUser();

  if (!q) return NextResponse.json({ users: [], posts: [] });
  if (process.env.DATA_DRIVER !== "json") return NextResponse.json(await searchPrisma(q, viewer));

  const db = await readDb();

  const users = db.users
    .filter((user) => user.settings?.profileDiscoverable || viewer?.id === user.id)
    .filter((user) => [user.name, user.username, user.bio, user.niche].some((value) => value.toLowerCase().includes(q)))
    .slice(0, 12)
    .map(toSafeUser);

  const posts = db.posts
    .filter((post) => canViewPost(post, viewer, db.users) && (post.body.toLowerCase().includes(q) || post.tags.some((tag) => tag.toLowerCase().includes(q.replace(/^#/, "")))))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 20)
    .map((post) => publicPost(post, db.users));

  return NextResponse.json({ users, posts });
}
