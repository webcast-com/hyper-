import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { id, now, publicStory, readDb, updateDb } from "@/lib/db";
import { createStoryPrisma, listStoriesPrisma } from "@/lib/prisma-direct-personal";

export const runtime = "nodejs";

export async function GET() {
  if (process.env.DATA_DRIVER !== "json") {
    const stories = await listStoriesPrisma();
    return NextResponse.json({ stories });
  }

  const db = await readDb();
  const active = db.stories
    .filter((story) => Date.parse(story.expiresAt) > Date.now())
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((story) => publicStory(story, db.users));
  return NextResponse.json({ stories: active });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to create stories." }, { status: 401 });
  const body = await request.json();
  const text = String(body.body || "").trim().slice(0, 180);
  const imageUrl = String(body.imageUrl || "").trim();
  if (!text && !imageUrl) return NextResponse.json({ error: "Story text or image is required." }, { status: 400 });
  if (process.env.DATA_DRIVER !== "json") {
    const story = await createStoryPrisma(user, { body: text, imageUrl });
    return NextResponse.json({ story }, { status: 201 });
  }

  const story = await updateDb((db) => {
    const createdAt = now();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const created = { id: id("story"), authorId: user.id, body: text, imageUrl, views: [], createdAt, expiresAt };
    db.stories.push(created);
    return publicStory(created, db.users);
  });
  return NextResponse.json({ story }, { status: 201 });
}
