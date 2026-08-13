import { id, canViewPost, isBlockedBetween, publicPost, extractMentionedUsers, reactionTypes } from "./db";
import { prisma } from "./prisma";
import { prismaUserToUser } from "./prisma-direct-auth";
import type { Post, ReactionType, User } from "./types";

const parse = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};
const json = (value: unknown, fallback: unknown) => JSON.stringify(value ?? fallback);
const iso = (value: Date | string | null | undefined) => new Date(value || Date.now()).toISOString();

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

function mapGroup(group: any) {
  return { id: group.id, name: group.name, description: group.description, cover: group.cover, ownerId: group.ownerId, memberIds: parse<string[]>(group.memberIds, []), createdAt: iso(group.createdAt) };
}
function mapEvent(event: any) {
  return { id: event.id, title: event.title, description: event.description, location: event.location, startsAt: iso(event.startsAt), hostId: event.hostId, attendeeIds: parse<string[]>(event.attendeeIds, []), cover: event.cover, createdAt: iso(event.createdAt) };
}

async function fullPost(postId: string, viewer?: User | null) {
  const db = prisma();
  const [rawPost, rawUsers, rawGroups, rawEvents] = await Promise.all([
    db.post.findUnique({ where: { id: postId }, include: { comments: true } }),
    db.user.findMany({ take: 300 }),
    db.group.findMany({ take: 200 }),
    db.event.findMany({ take: 200 })
  ]);
  if (!rawPost) return null;
  const users = rawUsers.map(prismaUserToUser);
  const post = mapPost(rawPost);
  if (viewer && !canViewPost(post, viewer, users)) throw new Error("You cannot view this post.");
  return publicPost(post, users, rawGroups.map(mapGroup), rawEvents.map(mapEvent));
}

async function notify(recipientId: string, actorId: string, type: string, postId?: string, commentId?: string) {
  if (recipientId === actorId) return;
  const recipientRaw = await prisma().user.findUnique({ where: { id: recipientId } });
  if (!recipientRaw) return;
  const recipient = prismaUserToUser(recipientRaw);
  const allowed = {
    like: recipient.settings.notifyLikes,
    comment: recipient.settings.notifyComments,
    mention: recipient.settings.notifyMentions,
    message: recipient.settings.notifyMessages,
    follow: recipient.settings.notifyFollows,
    friend_request: recipient.settings.notifyFriendRequests,
    friend_accept: recipient.settings.notifyFriendRequests
  }[type as keyof typeof recipient.settings | string];
  if (!allowed) return;
  if (type !== "message") {
    const duplicate = await prisma().notification.findFirst({ where: { recipientId, actorId, type, postId, commentId } });
    if (duplicate) return;
  }
  await prisma().notification.create({ data: { id: id("notif"), recipientId, actorId, type, postId, commentId, read: false } });
}

async function getPostAndAuthor(postId: string, user: User) {
  const rawPost = await prisma().post.findUnique({ where: { id: postId }, include: { comments: true } });
  if (!rawPost) return null;
  const post = mapPost(rawPost);
  const authorRaw = await prisma().user.findUnique({ where: { id: post.authorId } });
  const author = authorRaw ? prismaUserToUser(authorRaw) : null;
  if (isBlockedBetween(author, user)) throw new Error("You cannot interact with this post.");
  return { post, author };
}

export async function likePostPrisma(postId: string, user: User) {
  const found = await getPostAndAuthor(postId, user);
  if (!found) return null;
  const likes = found.post.likes.includes(user.id) ? found.post.likes.filter((x) => x !== user.id) : [...found.post.likes, user.id];
  await prisma().post.update({ where: { id: postId }, data: { likes: json(likes, []) } });
  if (!found.post.likes.includes(user.id)) await notify(found.post.authorId, user.id, "like", postId);
  return fullPost(postId, user);
}

export async function reactPostPrisma(postId: string, user: User, reaction: ReactionType) {
  const found = await getPostAndAuthor(postId, user);
  if (!found) return null;
  const reactions = found.post.reactions || {};
  reactionTypes.forEach((type) => { reactions[type] = (reactions[type] || []).filter((id) => id !== user.id); });
  reactions[reaction] = [...(reactions[reaction] || []), user.id];
  const likes = reaction === "like" && !found.post.likes.includes(user.id) ? [...found.post.likes, user.id] : found.post.likes;
  await prisma().post.update({ where: { id: postId }, data: { reactions: json(reactions, {}), likes: json(likes, []) } });
  await notify(found.post.authorId, user.id, "like", postId);
  return fullPost(postId, user);
}

export async function sharePostPrisma(postId: string, user: User) {
  const found = await getPostAndAuthor(postId, user);
  if (!found) return null;
  await prisma().post.update({ where: { id: postId }, data: { shares: { increment: 1 } } });
  return fullPost(postId, user);
}

export async function savePostPrisma(postId: string, user: User) {
  const db = prisma();
  const rawPost = await db.post.findUnique({ where: { id: postId }, include: { comments: true } });
  if (!rawPost) return null;
  const rawUsers = await db.user.findMany({ take: 300 });
  const users = rawUsers.map(prismaUserToUser);
  const me = users.find((u) => u.id === user.id) || user;
  const post = mapPost(rawPost);
  if (!canViewPost(post, me, users)) throw new Error("You cannot save this post.");
  const saved = me.savedPosts.includes(postId) ? me.savedPosts.filter((id) => id !== postId) : [postId, ...me.savedPosts];
  await db.user.update({ where: { id: user.id }, data: { savedPosts: json(saved, []) } });
  return { post: await fullPost(postId, me), isSaved: saved.includes(postId), savedPosts: saved };
}

export async function votePollPrisma(postId: string, user: User, optionId: string) {
  const found = await getPostAndAuthor(postId, user);
  if (!found) return null;
  if (!found.post.poll) throw new Error("This post does not have a poll.");
  if (found.post.poll.closesAt && Date.parse(found.post.poll.closesAt) < Date.now()) throw new Error("This poll is closed.");
  const option = found.post.poll.options.find((item) => item.id === optionId);
  if (!option) throw new Error("Poll option not found.");
  const alreadyVoted = option.votes.includes(user.id);
  if (!found.post.poll.allowMultiple) found.post.poll.options.forEach((item) => item.votes = item.votes.filter((id) => id !== user.id));
  if (!alreadyVoted) option.votes.push(user.id);
  else if (found.post.poll.allowMultiple) option.votes = option.votes.filter((id) => id !== user.id);
  await prisma().post.update({ where: { id: postId }, data: { poll: json(found.post.poll, null) } });
  return fullPost(postId, user);
}

export async function createCommentPrisma(postId: string, user: User, text: string, parentId?: string) {
  const found = await getPostAndAuthor(postId, user);
  if (!found) return null;
  const parent = parentId ? found.post.comments.find((comment) => comment.id === parentId) : null;
  if (parentId && !parent) throw new Error("Parent comment not found.");
  const commentId = id("c");
  await prisma().comment.create({ data: { id: commentId, postId, userId: user.id, parentId: parentId || null, text, likes: "[]" } });
  await notify(parent?.userId || found.post.authorId, user.id, "comment", postId, commentId);
  const rawUsers = await prisma().user.findMany({ take: 300 });
  const users = rawUsers.map(prismaUserToUser);
  const mentioned = extractMentionedUsers(text, users);
  for (const m of mentioned) await notify(m.id, user.id, "mention", postId, commentId);
  return fullPost(postId, user);
}

export async function likeCommentPrisma(postId: string, commentId: string, user: User) {
  const found = await getPostAndAuthor(postId, user);
  if (!found) return null;
  const comment = found.post.comments.find((item) => item.id === commentId);
  if (!comment) throw new Error("Comment not found.");
  const likes = comment.likes.includes(user.id) ? comment.likes.filter((id) => id !== user.id) : [...comment.likes, user.id];
  await prisma().comment.update({ where: { id: commentId }, data: { likes: json(likes, []) } });
  if (!comment.likes.includes(user.id)) await notify(comment.userId, user.id, "like", postId, commentId);
  return fullPost(postId, user);
}
