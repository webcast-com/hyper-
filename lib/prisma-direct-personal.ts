import { id, canViewPost, publicMarketplaceListing, publicPost, publicStory } from "./db";
import { prisma } from "./prisma";
import { prismaUserToUser } from "./prisma-direct-auth";
import type { MarketplaceListing, Post, Story, User } from "./types";

const parse = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};
const json = (value: unknown, fallback: unknown) => JSON.stringify(value ?? fallback);
const iso = (value: Date | string | null | undefined) => new Date(value || Date.now()).toISOString();
const toSafeUser = (user: User) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safe } = user;
  return safe;
};

function mapPost(post: any): Post {
  return {
    id: post.id,
    authorId: post.authorId,
    groupId: post.groupId || undefined,
    eventId: post.eventId || undefined,
    body: post.body,
    imageUrl: post.imageUrl || "",
    poll: post.poll ? parse(post.poll, undefined) : undefined,
    tags: parse<string[]>(post.tags, []),
    visibility: (post.visibility || "public") as Post["visibility"],
    likes: parse<string[]>(post.likes, []),
    reactions: parse(post.reactions, {}),
    shares: post.shares || 0,
    comments: (post.comments || []).map((c: any) => ({ id: c.id, userId: c.userId, text: c.text, parentId: c.parentId || undefined, likes: parse<string[]>(c.likes, []), createdAt: iso(c.createdAt) })),
    createdAt: iso(post.createdAt)
  };
}
function mapListing(listing: any): MarketplaceListing {
  return { id: listing.id, sellerId: listing.sellerId, title: listing.title, description: listing.description, type: listing.type, category: listing.category, price: listing.price, currency: listing.currency, imageUrl: listing.imageUrl || "", tags: parse<string[]>(listing.tags, []), saves: parse<string[]>(listing.saves, []), active: listing.active, createdAt: iso(listing.createdAt) };
}
function mapStory(story: any): Story {
  return { id: story.id, authorId: story.authorId, body: story.body, imageUrl: story.imageUrl || "", views: parse<string[]>(story.views, []), createdAt: iso(story.createdAt), expiresAt: iso(story.expiresAt) };
}

export async function listStoriesPrisma() {
  const db = prisma();
  const [rawStories, rawUsers] = await Promise.all([
    db.story.findMany({ where: { expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.user.findMany({ take: 200 })
  ]);
  const users = rawUsers.map(prismaUserToUser);
  return rawStories.map(mapStory).map((story) => publicStory(story, users));
}

export async function createStoryPrisma(user: User, input: { body: string; imageUrl: string }) {
  const created = await prisma().story.create({
    data: { id: id("story"), authorId: user.id, body: input.body, imageUrl: input.imageUrl || null, views: "[]", expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
  });
  return publicStory(mapStory(created), [user]);
}

export async function savedItemsPrisma(user: User) {
  const db = prisma();
  const [rawUsers, rawPosts, rawListings] = await Promise.all([
    db.user.findMany({ take: 300 }),
    db.post.findMany({ where: { id: { in: user.savedPosts } }, include: { comments: true }, take: 200 }),
    db.marketplaceListing.findMany({ where: { active: true, saves: { contains: user.id } }, orderBy: { createdAt: "desc" }, take: 200 })
  ]);
  const users = rawUsers.map(prismaUserToUser);
  const me = users.find((u) => u.id === user.id) || user;
  const savedPosts = user.savedPosts
    .map((postId) => rawPosts.find((post) => post.id === postId))
    .filter(Boolean)
    .map(mapPost)
    .filter((post) => canViewPost(post, me, users))
    .map((post) => publicPost(post, users));
  const savedListings = rawListings.map(mapListing).map((listing) => publicMarketplaceListing(listing, users, user.id));
  return { savedPosts, savedListings, counts: { posts: savedPosts.length, listings: savedListings.length } };
}

export async function referralsPrisma(user: User, origin: string) {
  const db = prisma();
  const rawReferrals = await db.referral.findMany({ where: { inviterId: user.id }, orderBy: { createdAt: "desc" }, take: 200 });
  const invitedIds = rawReferrals.map((referral) => referral.invitedUserId);
  const invitedUsers = invitedIds.length ? (await db.user.findMany({ where: { id: { in: invitedIds } } })).map(prismaUserToUser) : [];
  const referrals = rawReferrals.map((referral) => ({
    id: referral.id,
    inviterId: referral.inviterId,
    invitedUserId: referral.invitedUserId,
    code: referral.code,
    createdAt: iso(referral.createdAt),
    invitedUser: invitedUsers.find((candidate) => candidate.id === referral.invitedUserId) ? toSafeUser(invitedUsers.find((candidate) => candidate.id === referral.invitedUserId)!) : null
  }));
  const milestones = [
    { count: 1, label: "First Invite", earned: referrals.length >= 1 },
    { count: 3, label: "Community Starter", earned: referrals.length >= 3 },
    { count: 10, label: "Growth Champion", earned: referrals.length >= 10 },
    { count: 25, label: "Ambassador", earned: referrals.length >= 25 }
  ];
  return { referralCode: user.referralCode, inviteLink: `${origin}/invite/${encodeURIComponent(user.referralCode)}`, referrals, totalReferrals: referrals.length, milestones };
}
