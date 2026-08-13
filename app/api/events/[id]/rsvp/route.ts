import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { publicEvent, updateDb } from "@/lib/db";
import { toggleEventRsvpPrisma } from "@/lib/prisma-direct-community";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to RSVP." }, { status: 401 });
  const { id } = await params;
  if (process.env.DATA_DRIVER !== "json") {
    const event = await toggleEventRsvpPrisma(id, user);
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    return NextResponse.json({ event });
  }

  const event = await updateDb((db) => {
    const found = db.events.find((item) => item.id === id);
    if (!found) return null;
    if (found.attendeeIds.includes(user.id)) found.attendeeIds = found.attendeeIds.filter((attendeeId) => attendeeId !== user.id);
    else found.attendeeIds.push(user.id);
    return publicEvent(found, db.users, user.id);
  });
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  return NextResponse.json({ event });
}
