import crypto from "crypto";
import { syncUserGraphSafe } from "./graph-relations";
import { prisma } from "./prisma";
import type { User } from "./types";

const parse = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};
const iso = (value: Date | string | null | undefined) => new Date(value || Date.now()).toISOString();

function defaultSettings(): User["settings"] {
  return {
    defaultPostVisibility: "public" as const,
    allowMessagesFrom: "everyone" as const,
    profileDiscoverable: true,
    notifyLikes: true,
    notifyComments: true,
    notifyFollows: true,
    notifyFriendRequests: true,
    notifyMessages: true,
    notifyMentions: true,
      digestFrequency: "daily"
  };
}

export function prismaUserToUser(user: any): User {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    passwordHash: user.passwordHash,
    bio: user.bio,
    niche: user.niche,
    website: user.website || "",
    avatar: user.avatar,
    banner: user.banner,
    followers: parse<string[]>(user.followers, []),
    following: parse<string[]>(user.following, []),
    friends: parse<string[]>(user.friends, []),
    blockedUsers: parse<string[]>(user.blockedUsers, []),
    mutedUsers: parse<string[]>(user.mutedUsers, []),
    isAdmin: user.isAdmin,
    roles: parse(user.roles, user.isAdmin ? ["admin", "moderator", "user"] : ["user"]),
    suspended: user.suspended,
    referralCode: user.referralCode,
    savedPosts: parse<string[]>(user.savedPosts, []),
    settings: { ...defaultSettings(), ...parse(user.settings, {}) },
    createdAt: iso(user.createdAt)
  };
}

export async function findUserByIdPrisma(userId: string) {
  const user = await prisma().user.findUnique({ where: { id: userId } });
  return user ? prismaUserToUser(user) : null;
}

export async function findUserByEmailPrisma(email: string) {
  const user = await prisma().user.findUnique({ where: { email: email.toLowerCase() } });
  return user ? prismaUserToUser(user) : null;
}

export async function uniqueUsernamePrisma(base: string) {
  const clean = base.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 18) || "creator";
  let candidate = clean;
  let i = 1;
  while (await prisma().user.findUnique({ where: { username: candidate }, select: { id: true } })) {
    candidate = `${clean}${i}`;
    i += 1;
  }
  return candidate;
}

const json = (value: unknown, fallback: unknown) => JSON.stringify(value ?? fallback);

function makeReferralCode(name: string) {
  const base = name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "CREATOR";
  return `${base}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function createUserPrisma(input: { name: string; email: string; passwordHash: string; niche: string; inviteCode?: string }) {
  const db = prisma();
  const username = await uniqueUsernamePrisma(input.name.replace(/\s+/g, ""));
  let referralCode = makeReferralCode(input.name);
  while (await db.user.findUnique({ where: { referralCode }, select: { id: true } })) referralCode = makeReferralCode(input.name);

  const user = await db.$transaction(async (tx) => {
    const inviter = input.inviteCode
      ? await tx.user.findFirst({ where: { referralCode: input.inviteCode.toUpperCase() } })
      : null;

    const created = await tx.user.create({
      data: {
        id: `usr_${cryptoRandom()}`,
        name: input.name,
        username,
        email: input.email.toLowerCase(),
        emailVerified: false,
        passwordHash: input.passwordHash,
        bio: `New ${input.niche} creator on Creator Connect.`,
        niche: input.niche,
        website: null,
        avatar: `https://api.dicebear.com/8.x/adventurer/svg?seed=${encodeURIComponent(input.name)}`,
        banner: "linear-gradient(135deg,#111827,#7c3aed)",
        followers: "[]",
        following: inviter ? json([inviter.id], []) : "[]",
        friends: "[]",
        blockedUsers: "[]",
        mutedUsers: "[]",
        savedPosts: "[]",
        settings: json(defaultSettings(), {}),
        isAdmin: false,
        roles: JSON.stringify(["user"]),
        suspended: false,
        referralCode
      }
    });

    if (inviter && inviter.id !== created.id) {
      const inviterFollowers = parse<string[]>(inviter.followers, []);
      if (!inviterFollowers.includes(created.id)) inviterFollowers.push(created.id);
      await tx.user.update({ where: { id: inviter.id }, data: { followers: json(inviterFollowers, []) } });
      await tx.referral.create({ data: { id: `ref_${cryptoRandom()}`, inviterId: inviter.id, invitedUserId: created.id, code: inviter.referralCode } });
    }

    return created;
  });

  await syncUserGraphSafe(db, user.id);
  return prismaUserToUser(user);
}

function cryptoRandom() {
  return crypto.randomBytes(8).toString("hex");
}
