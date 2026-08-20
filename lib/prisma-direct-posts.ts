import { prisma } from "./prisma";
import { canViewPost, extractMentionedUsers, id, publicPost } from "./db";
import type { Post, PostVisibility, SafeUser, User } from "./types";

const parse = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};
const iso = (value: Date | string | null | undefined) => new Date(value || Date.now()).toISOString();
const json = (value: unknown, fallback: unknown) => JSON.stringify(value ?? fallback);

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

function mapUser(user: any): User {
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
    visibility: (post.visibility || "public") as PostVisibility,
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

function mapGroup(group: any) {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    cover: group.cover,
    ownerId: group.ownerId,
    memberIds: parse<string[]>(group.memberIds, []),
    createdAt: iso(group.createdAt)
  };
}

function mapEvent(event: any) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    startsAt: iso(event.startsAt),
    hostId: event.hostId,
    attendeeIds: parse<string[]>(event.attendeeIds, []),
    cover: event.cover,
    createdAt: iso(event.createdAt)
  };
}

function engagementScore(post: Post) {
  const reactionCount = Object.values(post.reactions || {}).reduce((sum, users) => sum + (users?.length || 0), 0);
  const engagement = post.likes.length + post.comments.length * 2 + (post.shares || 0) * 3 + reactionCount;
  const ageHours = Math.max((Date.now() - Date.parse(post.createdAt)) / 36e5, 1);
  return engagement / Math.pow(ageHours, 0.45);
}

export async function listPostsPrisma({ limit, cursor, feed, viewer }: { limit: number; cursor: string | null; feed: string; viewer: User | null }) {
  const db = prisma();
  const [rawUsers, rawGroups, rawEvents, rawPosts] = await Promise.all([
    db.user.findMany(),
    db.group.findMany(),
    db.event.findMany(),
    db.post.findMany({ include: { comments: true }, orderBy: { createdAt: "desc" }, take: feed === "trending" ? 200 : 100 })
  ]);

  const users = rawUsers.map(mapUser);
  const groups = rawGroups.map(mapGroup);
  const events = rawEvents.map(mapEvent);
  const typedViewer = viewer ? users.find((user) => user.id === viewer.id) ?? viewer : null;

  let visible = rawPosts.map(mapPost).filter((post) => canViewPost(post, typedViewer, users));
  if (feed === "following" && typedViewer) visible = visible.filter((post) => post.authorId === typedViewer.id || typedViewer.following.includes(post.authorId));
  else if (feed === "friends" && typedViewer) visible = visible.filter((post) => post.authorId === typedViewer.id || typedViewer.friends.includes(post.authorId));
  else if (feed === "communities") visible = visible.filter((post) => post.groupId || post.eventId);

  visible.sort((a, b) => feed === "trending" ? engagementScore(b) - engagementScore(a) : Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const filtered = cursor
    ? visible.filter((post) => feed === "trending" ? engagementScore(post) < Number(cursor) : Date.parse(post.createdAt) < Date.parse(cursor))
    : visible;

  const page = filtered.slice(0, limit);
  const nextCursor = filtered.length > limit ? (feed === "trending" ? String(engagementScore(page[page.length - 1])) : page[page.length - 1]?.createdAt ?? null) : null;
  return { posts: page.map((post) => publicPost(post, users, groups, events)), nextCursor, hasMore: Boolean(nextCursor), feed };
}

export async function createPostPrisma(input: { user: User; text: string; imageUrl: string; poll: Post["poll"]; tags: string[]; visibility: PostVisibility }) {
  const db = prisma();
  const postId = id("post");
  const created = await db.post.create({
    data: {
      id: postId,
      authorId: input.user.id,
      body: input.text,
      imageUrl: input.imageUrl || null,
      poll: input.poll ? json(input.poll, null) : null,
      tags: json(input.tags, []),
      visibility: input.visibility,
      likes: "[]",
      reactions: "{}",
      shares: 0
    },
    include: { comments: true }
  });

  const rawUsers = await db.user.findMany();
  const users = rawUsers.map(mapUser);
  const mentionedUsers = extractMentionedUsers(input.text, users).filter((mentioned) => mentioned.id !== input.user.id && mentioned.settings.notifyMentions);
  if (mentionedUsers.length) {
    await db.notification.createMany({
      data: mentionedUsers.map((mentioned) => ({ id: id("notif"), recipientId: mentioned.id, actorId: input.user.id, type: "mention", postId, read: false }))
    });
  }

  await syncPostGraphSafe(db, postId);
  return publicPost(mapPost(created), users);
}
