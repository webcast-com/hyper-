import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readDb, toSafeUser } from "@/lib/db";
import { getSafetyPrisma } from "@/lib/prisma-direct-users";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view safety settings." }, { status: 401 });

  if (process.env.DATA_DRIVER !== "json") return NextResponse.json(await getSafetyPrisma(user));

  const db = await readDb();
  const me = db.users.find((item) => item.id === user.id);
  if (!me) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const blockedUsers = db.users.filter((candidate) => me.blockedUsers.includes(candidate.id)).map(toSafeUser);
  const mutedUsers = db.users.filter((candidate) => me.mutedUsers.includes(candidate.id)).map(toSafeUser);

  return NextResponse.json({ blockedUsers, mutedUsers });
}
