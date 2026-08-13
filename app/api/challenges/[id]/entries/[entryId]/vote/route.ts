import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { publicChallengeEntry, updateDb } from "@/lib/db";
import { voteChallengeEntryPrisma } from "@/lib/prisma-direct-challenges";
import { requireFeature } from "@/lib/feature-flags";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string; entryId: string }> };

export async function POST(_request: Request, { params }: Params) {
  const feature = await requireFeature("challenges");
  if (feature) return NextResponse.json(feature, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to vote." }, { status: 401 });
  const { id: challengeId, entryId } = await params;

  if (process.env.DATA_DRIVER !== "json") {
    const entry = await voteChallengeEntryPrisma(challengeId, entryId, user).catch((err) => ({ error: err.message } as const));
    if (!entry) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    if ("error" in entry) return NextResponse.json({ error: entry.error }, { status: 400 });
    return NextResponse.json({ entry });
  }

  const entry = await updateDb((db) => {
    const challenge = db.challenges.find((item) => item.id === challengeId);
    const found = db.challengeEntries.find((item) => item.id === entryId && item.challengeId === challengeId);
    if (!challenge || !found) return null;
    if (Date.parse(challenge.endsAt) < Date.now()) throw new Error("Voting has ended.");
    if (found.authorId === user.id) throw new Error("You cannot vote for your own entry.");
    if (found.votes.includes(user.id)) found.votes = found.votes.filter((id) => id !== user.id);
    else found.votes.push(user.id);
    return publicChallengeEntry(found, db.users, user.id);
  }).catch((err) => ({ error: err.message } as const));

  if (!entry) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  if ("error" in entry) return NextResponse.json({ error: entry.error }, { status: 400 });
  return NextResponse.json({ entry });
}
