import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { id, now, publicChallenge, readDb, updateDb } from "@/lib/db";
import { createChallengePrisma, listChallengesPrisma } from "@/lib/prisma-direct-challenges";
import { requireFeature } from "@/lib/feature-flags";

export const runtime = "nodejs";

export async function GET() {
  const feature = await requireFeature("challenges");
  if (feature) return NextResponse.json(feature, { status: 403 });
  if (process.env.DATA_DRIVER !== "json") {
    const challenges = await listChallengesPrisma();
    return NextResponse.json({ challenges });
  }

  const db = await readDb();
  const challenges = db.challenges
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((challenge) => publicChallenge(challenge, db.users, db.challengeEntries));
  return NextResponse.json({ challenges });
}

export async function POST(request: Request) {
  const feature = await requireFeature("challenges");
  if (feature) return NextResponse.json(feature, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to create challenges." }, { status: 401 });

  const body = await request.json();
  const title = String(body.title || "").trim().slice(0, 80);
  const description = String(body.description || "").trim().slice(0, 240);
  const theme = String(body.theme || "Open creativity").trim().slice(0, 80);
  const prize = String(body.prize || "Community spotlight").trim().slice(0, 120);
  if (!title) return NextResponse.json({ error: "Challenge title is required." }, { status: 400 });

  if (process.env.DATA_DRIVER !== "json") {
    const challenge = await createChallengePrisma(user, { title, description, theme, prize });
    return NextResponse.json({ challenge }, { status: 201 });
  }

  const challenge = await updateDb((db) => {
    const created = {
      id: id("chl"),
      title,
      description,
      theme,
      prize,
      startsAt: now(),
      endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      hostId: user.id,
      createdAt: now()
    };
    db.challenges.push(created);
    return publicChallenge(created, db.users, db.challengeEntries);
  });

  return NextResponse.json({ challenge }, { status: 201 });
}
