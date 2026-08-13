import { id } from "./db";
import { prisma } from "./prisma";
import { prismaUserToUser } from "./prisma-direct-auth";
import { canViewPost, publicEvent, publicGroup, publicPost } from "./db";
import type { Event, Group, Post, User } from "./types";

const parse = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};
const json = (value: unknown, fallback: unknown) => JSON.stringify(value ?? fallback);
const iso = (value: Date | string | null | undefined) => new Date(value || Date.now()).toISOString();

function mapGroup(group: any): Group {
  return { id: group.id, name: group.name, description: group.description, cover: group.cover, ownerId: group.ownerId, memberIds: parse<string[]>(group.memberIds, []), createdAt: iso(group.createdAt) };
}

function mapEvent(event: any): Event {
  return { id: event.id, title: event.title, description: event.description, location: event.location, startsAt: iso(event.startsAt), hostId: event.hostId, attendeeIds: parse<string[]>(event.attendeeIds, []), cover: event.cover, createdAt: iso(event.createdAt) };
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

export async function listGroupsPrisma(currentUserId?: string) {
  const db = prisma();
  const [rawGroups, rawUsers] = await Promise.all([db.group.findMany({ take: 100 }), db.user.findMany({ take: 100 })]);
  const users = rawUsers.map(prismaUserToUser);
  return rawGroups.map(mapGroup).sort((a, b) => b.memberIds.length - a.memberIds.length).map((group) => publicGroup(group, users, currentUserId));
}

export async function createGroupPrisma(user: User, input: { name: string; description: string }) {
  const created = await prisma().group.create({
    data: {
      id: id("grp"),
      name: input.name,
      description: input.description,
      cover: "linear-gradient(135deg,#111827,#2563eb)",
      ownerId: user.id,
      memberIds: json([user.id], [])
    }
  });
  return publicGroup(mapGroup(created), [user], user.id);
}

export async function getGroupPrisma(groupId: string, currentUser: User | null) {
  const db = prisma();
  const [rawGroup, rawUsers, rawPosts, rawGroups, rawEvents] = await Promise.all([
    db.group.findUnique({ where: { id: groupId } }),
    db.user.findMany({ take: 200 }),
    db.post.findMany({ where: { groupId }, include: { comments: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.group.findMany({ take: 100 }),
    db.event.findMany({ take: 100 })
  ]);
  if (!rawGroup) return null;
  const users = rawUsers.map(prismaUserToUser);
  const groups = rawGroups.map(mapGroup);
  const events = rawEvents.map(mapEvent);
  const posts = rawPosts.map(mapPost).filter((post) => canViewPost(post, currentUser, users)).map((post) => publicPost(post, users, groups, events));
  return { group: publicGroup(mapGroup(rawGroup), users, currentUser?.id), posts };
}

export async function toggleGroupJoinPrisma(groupId: string, user: User) {
  const db = prisma();
  const rawGroup = await db.group.findUnique({ where: { id: groupId } });
  if (!rawGroup) return null;
  const memberIds = parse<string[]>(rawGroup.memberIds, []);
  const next = memberIds.includes(user.id) ? memberIds.filter((id) => id !== user.id) : [...memberIds, user.id];
  const updated = await db.group.update({ where: { id: groupId }, data: { memberIds: json(next, []) } });
  return publicGroup(mapGroup(updated), [user], user.id);
}

export async function createGroupPostPrisma(groupId: string, user: User, input: { body: string; imageUrl: string; tags: string[] }) {
  const db = prisma();
  const rawGroup = await db.group.findUnique({ where: { id: groupId } });
  if (!rawGroup) return null;
  const group = mapGroup(rawGroup);
  if (!group.memberIds.includes(user.id)) throw new Error("Join this group before posting.");
  const created = await db.post.create({
    data: {
      id: id("post"), authorId: user.id, groupId, body: input.body, imageUrl: input.imageUrl || null, tags: json(input.tags, []), visibility: "public", likes: "[]", reactions: "{}", shares: 0
    },
    include: { comments: true }
  });
  return publicPost(mapPost(created), [user], [group], []);
}

export async function listEventsPrisma(currentUserId?: string) {
  const db = prisma();
  const [rawEvents, rawUsers] = await Promise.all([db.event.findMany({ orderBy: { startsAt: "asc" }, take: 100 }), db.user.findMany({ take: 100 })]);
  const users = rawUsers.map(prismaUserToUser);
  return rawEvents.map(mapEvent).map((event) => publicEvent(event, users, currentUserId));
}

export async function createEventPrisma(user: User, input: { title: string; description: string; location: string; startsAt: string }) {
  const created = await prisma().event.create({
    data: { id: id("evt"), title: input.title, description: input.description, location: input.location, startsAt: new Date(input.startsAt), hostId: user.id, attendeeIds: json([user.id], []), cover: "linear-gradient(135deg,#16a34a,#0ea5e9)" }
  });
  return publicEvent(mapEvent(created), [user], user.id);
}

export async function getEventPrisma(eventId: string, currentUser: User | null) {
  const db = prisma();
  const [rawEvent, rawUsers, rawPosts, rawGroups, rawEvents] = await Promise.all([
    db.event.findUnique({ where: { id: eventId } }),
    db.user.findMany({ take: 200 }),
    db.post.findMany({ where: { eventId }, include: { comments: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.group.findMany({ take: 100 }),
    db.event.findMany({ take: 100 })
  ]);
  if (!rawEvent) return null;
  const users = rawUsers.map(prismaUserToUser);
  const groups = rawGroups.map(mapGroup);
  const events = rawEvents.map(mapEvent);
  const posts = rawPosts.map(mapPost).filter((post) => canViewPost(post, currentUser, users)).map((post) => publicPost(post, users, groups, events));
  return { event: publicEvent(mapEvent(rawEvent), users, currentUser?.id), posts };
}

export async function toggleEventRsvpPrisma(eventId: string, user: User) {
  const db = prisma();
  const rawEvent = await db.event.findUnique({ where: { id: eventId } });
  if (!rawEvent) return null;
  const attendeeIds = parse<string[]>(rawEvent.attendeeIds, []);
  const next = attendeeIds.includes(user.id) ? attendeeIds.filter((id) => id !== user.id) : [...attendeeIds, user.id];
  const updated = await db.event.update({ where: { id: eventId }, data: { attendeeIds: json(next, []) } });
  return publicEvent(mapEvent(updated), [user], user.id);
}

export async function createEventPostPrisma(eventId: string, user: User, input: { body: string; imageUrl: string; tags: string[] }) {
  const db = prisma();
  const rawEvent = await db.event.findUnique({ where: { id: eventId } });
  if (!rawEvent) return null;
  const event = mapEvent(rawEvent);
  if (!event.attendeeIds.includes(user.id)) throw new Error("RSVP to this event before posting.");
  const created = await db.post.create({
    data: {
      id: id("post"), authorId: user.id, eventId, body: input.body, imageUrl: input.imageUrl || null, tags: json(input.tags, []), visibility: "public", likes: "[]", reactions: "{}", shares: 0
    },
    include: { comments: true }
  });
  return publicPost(mapPost(created), [user], [], [event]);
}
