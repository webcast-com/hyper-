import { NextResponse } from "next/server";
import { hashPassword, setSessionCookie, uniqueUsername } from "@/lib/auth";
import { id, now, toSafeUser, updateDb } from "@/lib/db";
import { createUserPrisma } from "@/lib/prisma-direct-auth";
import { auditLog } from "@/lib/audit";
import type { Role } from "@/lib/types";
import { createAuthToken } from "@/lib/auth-token-service";
import { sendVerificationEmail } from "@/lib/mail";
import { emitWebhook } from "@/lib/webhooks";
import { parseJson, registerSchema } from "@/lib/validation";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { requireFeature } from "@/lib/feature-flags";

export const runtime = "nodejs";

function makeReferralCode(name: string) {
  const base = name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "CREATOR";
  return `${base}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function POST(request: Request) {
  const feature = await requireFeature("public_registration");
  if (feature) return NextResponse.json(feature, { status: 403 });
  const limited = await rateLimit(request, "auth:register", 5, 60000);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429, headers: rateLimitHeaders(limited) });
  const parsed = await parseJson(request, registerSchema);
  if ("response" in parsed) return parsed.response;
  const { name, email, password } = parsed.data;
  const niche = parsed.data.niche || "Creator";
  const inviteCode = String(parsed.data.inviteCode || parsed.data.referralCode || "").trim().toUpperCase();

  if (process.env.DATA_DRIVER !== "json") {
    const user = await createUserPrisma({ name, email, passwordHash: hashPassword(password), niche, inviteCode }).catch((err) => ({ error: err.message } as const));
    if ("error" in user) return NextResponse.json({ error: user.error.includes("Unique") ? "Email already registered." : user.error }, { status: 409 });
    await setSessionCookie(user.id);
    const token = await createAuthToken(user.id, "email_verification");
    await sendVerificationEmail(user, token, request);
    await emitWebhook({ event: "user.created", actorId: user.id, payload: { userId: user.id, email: user.email, username: user.username } });
    await auditLog({ actorId: user.id, action: "auth.register", targetType: "user", targetId: user.id, metadata: { inviteCode: Boolean(inviteCode) }, request });
    return NextResponse.json({ user: toSafeUser(user), emailVerificationSent: true }, { status: 201 });
  }

  const user = await updateDb(async (db) => {
    if (db.users.some((u) => u.email === email)) {
      throw new Error("Email already registered.");
    }
    const username = await uniqueUsername(name.replace(/\s+/g, ""));
    let referralCode = makeReferralCode(name);
    while (db.users.some((u) => u.referralCode === referralCode)) referralCode = makeReferralCode(name);

    const newUser = {
      id: id("usr"),
      name,
      username,
      email,
      emailVerified: false,
      passwordHash: hashPassword(password),
      bio: `New ${niche} creator on Creator Connect.`,
      niche,
      website: "",
      avatar: `https://api.dicebear.com/8.x/adventurer/svg?seed=${encodeURIComponent(name)}`,
      banner: "linear-gradient(135deg,#111827,#7c3aed)",
      followers: [] as string[],
      following: [] as string[],
      friends: [] as string[],
      blockedUsers: [] as string[],
      mutedUsers: [] as string[],
      isAdmin: false,
      roles: ["user"] as Role[],
      suspended: false,
      referralCode,
      savedPosts: [] as string[],
      settings: {
        defaultPostVisibility: "public" as const,
        allowMessagesFrom: "everyone" as const,
        profileDiscoverable: true,
        notifyLikes: true,
        notifyComments: true,
        notifyFollows: true,
        notifyFriendRequests: true,
        notifyMessages: true,
        notifyMentions: true,
      digestFrequency: "daily" as const
      },
      createdAt: now()
    };
    db.users.push(newUser);

    if (inviteCode) {
      const inviter = db.users.find((candidate) => candidate.referralCode?.toUpperCase() === inviteCode && candidate.id !== newUser.id);
      if (inviter) {
        db.referrals.push({ id: id("ref"), inviterId: inviter.id, invitedUserId: newUser.id, code: inviter.referralCode, createdAt: now() });
        if (!newUser.following.includes(inviter.id)) newUser.following.push(inviter.id);
        if (!inviter.followers.includes(newUser.id)) inviter.followers.push(newUser.id);
      }
    }

    return newUser;
  }).catch((err) => {
    return { error: err.message } as const;
  });

  if ("error" in user) return NextResponse.json({ error: user.error }, { status: 409 });
  await setSessionCookie(user.id);
  const token = await createAuthToken(user.id, "email_verification");
  await sendVerificationEmail(user, token, request);
  await emitWebhook({ event: "user.created", actorId: user.id, payload: { userId: user.id, email: user.email, username: user.username } });
    await auditLog({ actorId: user.id, action: "auth.register", targetType: "user", targetId: user.id, metadata: { inviteCode: Boolean(inviteCode) }, request });
  return NextResponse.json({ user: toSafeUser(user), emailVerificationSent: true }, { status: 201 });
}
