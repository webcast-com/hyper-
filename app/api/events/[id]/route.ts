import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canViewPost, publicEvent, publicPost, readDb } from "@/lib/db";
import { getEventPrisma } from "@/lib/prisma-direct-community";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (process.env.DATA_DRIVER !== "json") {
    const result = await getEventPrisma(id, user);
    if (!result) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    return NextResponse.json(result);
  }

  const db = await readDb();
  const event = db.events.find((item) => item.id === id);
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const posts = db.posts
    .filter((post) => post.eventId === event.id && canViewPost(post, user, db.users))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((post) => publicPost(post, db.users, db.groups, db.events));

  return NextResponse.json({ event: publicEvent(event, db.users, user?.id), posts });
}
