import { prisma } from "./prisma";
import { prismaUserToUser } from "./prisma-direct-auth";
import { canViewPost, publicEvent, publicGroup, publicPost } from "./db";
import type { Event, Group, Post, User } from "./types";

const parse = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};
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
    comments: (post.comments || []).map((comment: any) => ({
      id: comment.id,
      userId: comment.userId,
      text: comment.text,
      parentId: comment.parentId || undefined,
      likes: parse<string[]>(comment.likes, []),
      createdAt: iso(comment.createdAt)
    })),
    createdAt: iso(post.createdAt)
  };
}

function mapGroup(group: any): Group {
  return { id: group.id, name: group.name, description: group.description, cover: group.cover, ownerId: group.ownerId, memberIds: parse<string[]>(group.memberIds, []), createdAt: iso(group.createdAt) };
}

function mapEvent(event: any): Event {
  return { id: event.id, title: event.title, description: event.description, location: event.location, startsAt: iso(event.startsAt), hostId: event.hostId, attendeeIds: parse<string[]>(event.attendeeIds, []), cover: event.cover, createdAt: iso(event.createdAt) };
}

function scorePost(post: Post) {
  const reactionCount = Object.values(post.reactions || {}).reduce((sum, users) => sum + (users?.length || 0), 0);
  const engagement = post.likes.length + post.comments.length * 2 + (post.shares || 0) * 3 + reactionCount;
  const ageHours = Math.max((Date.now() - Date.parse(post.createdAt)) / 36e5, 1);
  return engagement / Math.pow(ageHours, 0.45);
}

export async function discoverUsersPrisma(currentUser: User | null) {
  const users = (await prisma().user.findMany({ take: 100 })).map(prismaUserToUser);
  return users
    .filter((user) => user.settings?.profileDiscoverable || currentUser?.id === user.id)
    .sort((a, b) => b.followers.length - a.followers.length)
    .map((user) => ({
      ...toSafeUser(user),
      isFollowing: currentUser ? currentUser.following.includes(user.id) : false,
      isMe: currentUser?.id === user.id
    }));
}

export async function searchPrisma(q: string, viewer: User | null) {
  if (!q) return { users: [], posts: [] };
  const clean = q.toLowerCase();
  const db = prisma();
  const [rawUsers, rawPosts, rawGroups, rawEvents] = await Promise.all([
    db.user.findMany({ take: 100 }),
    db.post.findMany({ include: { comments: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.group.findMany(),
    db.event.findMany()
  ]);
  const users = rawUsers.map(prismaUserToUser);
  const groups = rawGroups.map(mapGroup);
  const events = rawEvents.map(mapEvent);

  const foundUsers = users
    .filter((user) => user.settings?.profileDiscoverable || viewer?.id === user.id)
    .filter((user) => [user.name, user.username, user.bio, user.niche].some((value) => value.toLowerCase().includes(clean)))
    .slice(0, 12)
    .map(toSafeUser);

  const foundPosts = rawPosts
    .map(mapPost)
    .filter((post) => canViewPost(post, viewer, users) && (post.body.toLowerCase().includes(clean) || post.tags.some((tag) => tag.toLowerCase().includes(clean.replace(/^#/, "")))))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 20)
    .map((post) => publicPost(post, users, groups, events));

  return { users: foundUsers, posts: foundPosts };
}

export async function explorePrisma() {
  const db = prisma();
  const [rawUsers, rawPosts, rawGroups, rawEvents] = await Promise.all([
    db.user.findMany({ take: 100 }),
    db.post.findMany({ where: { visibility: "public" }, include: { comments: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.group.findMany({ take: 50 }),
    db.event.findMany({ take: 50 })
  ]);

  const users = rawUsers.map(prismaUserToUser);
  const groups = rawGroups.map(mapGroup);
  const events = rawEvents.map(mapEvent);
  const publicPosts = rawPosts.map(mapPost);

  const trendingPosts = publicPosts
    .slice()
    .sort((a, b) => scorePost(b) - scorePost(a))
    .slice(0, 12)
    .map((post) => ({ ...publicPost(post, users, groups, events), trendScore: Number(scorePost(post).toFixed(2)) }));

  const tagMap = new Map<string, { tag: string; posts: number; engagement: number }>();
  publicPosts.forEach((post) => {
    const engagement = post.likes.length + post.comments.length + (post.shares || 0);
    post.tags.forEach((tag) => {
      const current = tagMap.get(tag) || { tag, posts: 0, engagement: 0 };
      current.posts += 1;
      current.engagement += engagement;
      tagMap.set(tag, current);
    });
  });

  const trendingTags = Array.from(tagMap.values()).sort((a, b) => b.posts + b.engagement - (a.posts + a.engagement)).slice(0, 12);
  const suggestedCreators = users
    .filter((user) => user.settings.profileDiscoverable)
    .sort((a, b) => b.followers.length + b.friends.length - (a.followers.length + a.friends.length))
    .slice(0, 10)
    .map(toSafeUser);
  const popularGroups = groups.slice().sort((a, b) => b.memberIds.length - a.memberIds.length).slice(0, 6).map((group) => publicGroup(group, users));
  const upcomingEvents = events
    .filter((event) => Date.parse(event.startsAt) > Date.now())
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, 6)
    .map((event) => publicEvent(event, users));

  return { trendingPosts, trendingTags, suggestedCreators, popularGroups, upcomingEvents };
}
