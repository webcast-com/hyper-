import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readDb, toSafeUser } from "@/lib/db";
import { referralsPrisma } from "@/lib/prisma-direct-personal";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view referrals." }, { status: 401 });

  const url = new URL(request.url);
  const origin = url.origin;
  if (process.env.DATA_DRIVER !== "json") return NextResponse.json(await referralsPrisma(user, origin));

  const db = await readDb();
  const referrals = db.referrals
    .filter((referral) => referral.inviterId === user.id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((referral) => {
      const invitedUser = db.users.find((candidate) => candidate.id === referral.invitedUserId);
      return { ...referral, invitedUser: invitedUser ? toSafeUser(invitedUser) : null };
    });

  const milestones = [
    { count: 1, label: "First Invite", earned: referrals.length >= 1 },
    { count: 3, label: "Community Starter", earned: referrals.length >= 3 },
    { count: 10, label: "Growth Champion", earned: referrals.length >= 10 },
    { count: 25, label: "Ambassador", earned: referrals.length >= 25 }
  ];

  return NextResponse.json({
    referralCode: user.referralCode,
    inviteLink: `${origin}/invite/${encodeURIComponent(user.referralCode)}`,
    referrals,
    totalReferrals: referrals.length,
    milestones
  });
}
