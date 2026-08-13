import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { id, now, publicEvent, readDb, updateDb } from "@/lib/db";
import { createEventPrisma, listEventsPrisma } from "@/lib/prisma-direct-community";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (process.env.DATA_DRIVER !== "json") {
    const events = await listEventsPrisma(user?.id);
    return NextResponse.json({ events });
  }

  const db = await readDb();
  const events = db.events
    .slice()
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .map((event) => publicEvent(event, db.users, user?.id));
  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to create events." }, { status: 401 });
  const body = await request.json();
  const title = String(body.title || "").trim().slice(0, 80);
  const description = String(body.description || "").trim().slice(0, 220);
  const location = String(body.location || "Online").trim().slice(0, 80);
  const startsAt = body.startsAt ? new Date(body.startsAt).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  if (!title) return NextResponse.json({ error: "Event title is required." }, { status: 400 });
  if (process.env.DATA_DRIVER !== "json") {
    const event = await createEventPrisma(user, { title, description, location, startsAt });
    return NextResponse.json({ event }, { status: 201 });
  }

  const event = await updateDb((db) => {
    const created = { id: id("evt"), title, description, location, startsAt, hostId: user.id, attendeeIds: [user.id], cover: "linear-gradient(135deg,#16a34a,#0ea5e9)", createdAt: now() };
    db.events.push(created);
    return publicEvent(created, db.users, user.id);
  });
  return NextResponse.json({ event }, { status: 201 });
}
