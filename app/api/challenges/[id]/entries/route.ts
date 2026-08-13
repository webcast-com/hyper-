import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { id, now, publicChallengeEntry, readDb, updateDb } from "@/lib/db";
import { createChallengeEntryPrisma, listChallengeEntriesPrisma } from "@/lib/prisma-direct-challenges";
import { requireFeature } from "@/lib/feature-flags";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const feature = await requireFeature("challenges");
  if (feature) return NextResponse.json(feature, { status: 403 });
  const { id: challengeId } = await params;
  const user = await getCurrentUser();
  if (process.env.DATA_DRIVER !== "json") {
    const entries = await listChallengeEntriesPrisma(challengeId, user?.id);
    return NextResponse.json({ entries });
  }

  const db = await readDb();
  const entries = db.challengeEntries
    .filter((entry) => entry.challengeId === challengeId)
    .sort((a, b) => b.votes.length - a.votes.length || Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((entry) => publicChallengeEntry(entry, db.users, user?.id));
  return NextResponse.json({ entries });
}

export async function POST(request: Request, { params }: Params) {
  const feature = await requireFeature("challenges");
  if (feature) return NextResponse.json(feature, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to enter challenges." }, { status: 401 });
  const { id: challengeId } = await params;
  const body = await request.json();
  const title = String(body.title || "").trim().slice(0, 80);
  const text = String(body.body || "").trim().slice(0, 500);
  const imageUrl = String(body.imageUrl || "").trim();
  if (!title || (!text && !imageUrl)) return NextResponse.json({ error: "Entry title and content are required." }, { status: 400 });

  if (process.env.DATA_DRIVER !== "json") {
    const entry = await createChallengeEntryPrisma(challengeId, user, { title, body: text, imageUrl }).catch((err) => ({ error: err.message } as const));
    if (!entry) return NextResponse.json({ error: "Challenge not found." }, { status: 404 });
    if ("error" in entry) return NextResponse.json({ error: entry.error }, { status: 400 });
    return NextResponse.json({ entry }, { status: 201 });
  }

  const entry = await updateDb((db) => {
    const challenge = db.challenges.find((item) => item.id === challengeId);
    if (!challenge) return null;
    if (Date.parse(challenge.endsAt) < Date.now()) throw new Error("This challenge has ended.");
    const created = { id: id("entry"), challengeId, authorId: user.id, title, body: text, imageUrl, votes: [], createdAt: now() };
    db.challengeEntries.push(created);
    return publicChallengeEntry(created, db.users, user.id);
  }).catch((err) => ({ error: err.message } as const));

  if (!entry) return NextResponse.json({ error: "Challenge not found." }, { status: 404 });
  if ("error" in entry) return NextResponse.json({ error: entry.error }, { status: 400 });
  return NextResponse.json({ entry }, { status: 201 });
}
