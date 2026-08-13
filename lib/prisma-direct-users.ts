import { id, canViewPost, isBlockedBetween, publicPost } from "./db";
import { prisma } from "./prisma";
import { prismaUserToUser } from "./prisma-direct-auth";
import type { MessagePermission, Post, PostVisibility, User } from "./types";

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
  return { id: post.id, authorId: post.authorId, groupId: post.groupId || undefined, eventId: post.eventId || undefined, body: post.body, imageUrl: post.imageUrl || "", poll: post.poll ? parse(post.poll, undefined) : undefined, tags: parse<string[]>(post.tags, []), visibility: (post.visibility || "public") as Post["visibility"], likes: parse<string[]>(post.likes, []), reactions: parse(post.reactions, {}), shares: post.shares || 0, comments: (post.comments || []).map((c: any) => ({ id: c.id, userId: c.userId, text: c.text, parentId: c.parentId || undefined, likes: parse<string[]>(c.likes, []), createdAt: iso(c.createdAt) })), createdAt: iso(post.createdAt) };
}
function publicFriendRequest(request: any, users: User[]) {
  const sender = users.find((user) => user.id === request.senderId);
  const recipient = users.find((user) => user.id === request.recipientId);
  return { id: request.id, senderId: request.senderId, recipientId: request.recipientId, status: request.status, createdAt: iso(request.createdAt), respondedAt: request.respondedAt ? iso(request.respondedAt) : undefined, sender: sender ? toSafeUser(sender) : null, recipient: recipient ? toSafeUser(recipient) : null };
}
async function notification(recipientId: string, actorId: string, type: string) {
  if (recipientId === actorId) return;
  const recipientRaw = await prisma().user.findUnique({ where: { id: recipientId } });
  if (!recipientRaw) return;
  const recipient = prismaUserToUser(recipientRaw);
  const allowed = type === "follow" ? recipient.settings.notifyFollows : recipient.settings.notifyFriendRequests;
  if (!allowed) return;
  const duplicate = await prisma().notification.findFirst({ where: { recipientId, actorId, type } });
  if (!duplicate) await prisma().notification.create({ data: { id: id("notif"), recipientId, actorId, type, read: false } });
}

export async function getUserProfilePrisma(idOrUsername: string, currentUser: User | null) {
  const db = prisma();
  const rawUser = await db.user.findFirst({ where: { OR: [{ id: idOrUsername }, { username: idOrUsername }] } });
  if (!rawUser) return null;
  const [rawUsers, rawPosts] = await Promise.all([
    db.user.findMany({ take: 300 }),
    db.post.findMany({ where: { authorId: rawUser.id }, include: { comments: true }, orderBy: { createdAt: "desc" }, take: 100 })
  ]);
  const users = rawUsers.map(prismaUserToUser);
  const user = prismaUserToUser(rawUser);
  const posts = rawPosts.map(mapPost).filter((post) => canViewPost(post, currentUser, users)).map((post) => publicPost(post, users));
  return { user: { ...toSafeUser(user), isFollowing: currentUser ? currentUser.following.includes(user.id) : false }, posts };
}

export async function toggleFollowPrisma(currentUser: User, targetId: string) {
  const db = prisma();
  const [meRaw, targetRaw] = await Promise.all([db.user.findUnique({ where: { id: currentUser.id } }), db.user.findUnique({ where: { id: targetId } })]);
  if (!meRaw || !targetRaw) return null;
  const me = prismaUserToUser(meRaw), target = prismaUserToUser(targetRaw);
  if (isBlockedBetween(me, target)) throw new Error("You cannot follow this user.");
  const following = me.following.includes(targetId);
  const nextFollowing = following ? me.following.filter((x) => x !== targetId) : [...me.following, targetId];
  const nextFollowers = following ? target.followers.filter((x) => x !== me.id) : [...target.followers, me.id];
  await db.$transaction([
    db.user.update({ where: { id: me.id }, data: { following: json(nextFollowing, []) } }),
    db.user.update({ where: { id: target.id }, data: { followers: json(nextFollowers, []) } })
  ]);
  if (!following) await notification(target.id, me.id, "follow");
  return { user: toSafeUser({ ...target, followers: nextFollowers }), isFollowing: !following };
}

export async function friendsPrisma(user: User) {
  const db = prisma();
  const [rawUsers, rawRequests] = await Promise.all([db.user.findMany({ take: 300 }), db.friendRequest.findMany({ where: { status: "pending" } })]);
  const users = rawUsers.map(prismaUserToUser);
  const me = users.find((u) => u.id === user.id) || user;
  const friends = users.filter((candidate) => me.friends.includes(candidate.id)).map(toSafeUser);
  const incomingRaw = rawRequests.filter((r) => r.recipientId === user.id).sort((a, b) => +b.createdAt - +a.createdAt);
  const outgoingRaw = rawRequests.filter((r) => r.senderId === user.id);
  const incoming = incomingRaw.map((r) => publicFriendRequest(r, users));
  const outgoing = outgoingRaw.map((r) => publicFriendRequest(r, users));
  const excluded = new Set([user.id, ...me.friends, ...incomingRaw.map((r) => r.senderId), ...outgoingRaw.map((r) => r.recipientId)]);
  const suggestions = users.filter((candidate) => !excluded.has(candidate.id)).sort((a, b) => b.followers.length - a.followers.length).slice(0, 6).map(toSafeUser);
  return { friends, incoming, outgoing, suggestions };
}

export async function sendFriendRequestPrisma(user: User, recipientId: string) {
  const db = prisma();
  const [meRaw, recipientRaw] = await Promise.all([db.user.findUnique({ where: { id: user.id } }), db.user.findUnique({ where: { id: recipientId } })]);
  if (!meRaw || !recipientRaw) return null;
  const me = prismaUserToUser(meRaw), recipient = prismaUserToUser(recipientRaw);
  if (isBlockedBetween(me, recipient)) throw new Error("You cannot send a friend request to this user.");
  if (me.friends.includes(recipientId)) throw new Error("You are already friends.");
  const existing = await db.friendRequest.findFirst({ where: { status: "pending", OR: [{ senderId: me.id, recipientId }, { senderId: recipientId, recipientId: me.id }] } });
  if (existing) return publicFriendRequest(existing, [me, recipient]);
  const created = await db.friendRequest.create({ data: { id: id("fr"), senderId: me.id, recipientId, status: "pending" } });
  await notification(recipientId, me.id, "friend_request");
  return publicFriendRequest(created, [me, recipient]);
}

export async function respondFriendRequestPrisma(user: User, requestId: string, action: "accepted" | "declined") {
  const db = prisma();
  const request = await db.friendRequest.findFirst({ where: { id: requestId, recipientId: user.id, status: "pending" } });
  if (!request) return null;
  const [senderRaw, recipientRaw] = await Promise.all([db.user.findUnique({ where: { id: request.senderId } }), db.user.findUnique({ where: { id: request.recipientId } })]);
  if (!senderRaw || !recipientRaw) return null;
  const sender = prismaUserToUser(senderRaw), recipient = prismaUserToUser(recipientRaw);
  const updated = await db.friendRequest.update({ where: { id: requestId }, data: { status: action, respondedAt: new Date() } });
  if (action === "accepted") {
    const senderFriends = sender.friends.includes(recipient.id) ? sender.friends : [...sender.friends, recipient.id];
    const recipientFriends = recipient.friends.includes(sender.id) ? recipient.friends : [...recipient.friends, sender.id];
    await db.$transaction([
      db.user.update({ where: { id: sender.id }, data: { friends: json(senderFriends, []) } }),
      db.user.update({ where: { id: recipient.id }, data: { friends: json(recipientFriends, []) } })
    ]);
    await notification(sender.id, recipient.id, "friend_accept");
  }
  return publicFriendRequest(updated, [sender, recipient]);
}

export async function removeFriendPrisma(user: User, friendId: string) {
  const db = prisma();
  const [meRaw, friendRaw] = await Promise.all([db.user.findUnique({ where: { id: user.id } }), db.user.findUnique({ where: { id: friendId } })]);
  if (!meRaw || !friendRaw) return false;
  const me = prismaUserToUser(meRaw), friend = prismaUserToUser(friendRaw);
  await db.$transaction([
    db.user.update({ where: { id: me.id }, data: { friends: json(me.friends.filter((id) => id !== friendId), []) } }),
    db.user.update({ where: { id: friend.id }, data: { friends: json(friend.friends.filter((id) => id !== me.id), []) } })
  ]);
  return true;
}

export async function updateProfilePrisma(user: User, body: any) {
  const updated = await prisma().user.update({ where: { id: user.id }, data: { name: String(body.name ?? user.name).trim().slice(0, 60) || user.name, bio: String(body.bio ?? user.bio).trim().slice(0, 240), niche: String(body.niche ?? user.niche).trim().slice(0, 40) || "Creator", website: String(body.website ?? user.website ?? "").trim().slice(0, 120) || null, avatar: String(body.avatar ?? user.avatar).trim() || user.avatar } });
  return toSafeUser(prismaUserToUser(updated));
}

export async function getSafetyPrisma(user: User) {
  const db = prisma();
  const rawUsers = await db.user.findMany({ where: { OR: [{ id: { in: user.blockedUsers } }, { id: { in: user.mutedUsers } }] } });
  const users = rawUsers.map(prismaUserToUser);
  return { blockedUsers: users.filter((u) => user.blockedUsers.includes(u.id)).map(toSafeUser), mutedUsers: users.filter((u) => user.mutedUsers.includes(u.id)).map(toSafeUser) };
}

export async function toggleMutePrisma(user: User, targetId: string) {
  const target = await prisma().user.findUnique({ where: { id: targetId } });
  if (!target) return null;
  if (user.blockedUsers.includes(targetId)) return { muted: false, blocked: true };
  const muted = user.mutedUsers.includes(targetId);
  const next = muted ? user.mutedUsers.filter((id) => id !== targetId) : [...user.mutedUsers, targetId];
  await prisma().user.update({ where: { id: user.id }, data: { mutedUsers: json(next, []) } });
  return { muted: !muted, blocked: false };
}

export async function toggleBlockPrisma(user: User, targetId: string) {
  const db = prisma();
  const targetRaw = await db.user.findUnique({ where: { id: targetId } });
  if (!targetRaw) return null;
  const target = prismaUserToUser(targetRaw);
  const blocked = user.blockedUsers.includes(targetId);
  if (blocked) {
    await db.user.update({ where: { id: user.id }, data: { blockedUsers: json(user.blockedUsers.filter((id) => id !== targetId), []) } });
    return { blocked: false };
  }
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { blockedUsers: json([...user.blockedUsers, targetId], []), mutedUsers: json(user.mutedUsers.filter((id) => id !== targetId), []), friends: json(user.friends.filter((id) => id !== targetId), []), following: json(user.following.filter((id) => id !== targetId), []) } }),
    db.user.update({ where: { id: targetId }, data: { friends: json(target.friends.filter((id) => id !== user.id), []), followers: json(target.followers.filter((id) => id !== user.id), []) } }),
    db.friendRequest.deleteMany({ where: { OR: [{ senderId: user.id, recipientId: targetId }, { senderId: targetId, recipientId: user.id }] } })
  ]);
  return { blocked: true };
}

export async function updateSettingsPrisma(user: User, body: any) {
  const settings = {
    ...user.settings,
    defaultPostVisibility: ["public", "followers", "friends", "only_me"].includes(body.defaultPostVisibility) ? body.defaultPostVisibility as PostVisibility : user.settings.defaultPostVisibility,
    allowMessagesFrom: ["everyone", "friends", "none"].includes(body.allowMessagesFrom) ? body.allowMessagesFrom as MessagePermission : user.settings.allowMessagesFrom,
    profileDiscoverable: typeof body.profileDiscoverable === "boolean" ? body.profileDiscoverable : user.settings.profileDiscoverable,
    notifyLikes: typeof body.notifyLikes === "boolean" ? body.notifyLikes : user.settings.notifyLikes,
    notifyComments: typeof body.notifyComments === "boolean" ? body.notifyComments : user.settings.notifyComments,
    notifyFollows: typeof body.notifyFollows === "boolean" ? body.notifyFollows : user.settings.notifyFollows,
    notifyFriendRequests: typeof body.notifyFriendRequests === "boolean" ? body.notifyFriendRequests : user.settings.notifyFriendRequests,
    notifyMessages: typeof body.notifyMessages === "boolean" ? body.notifyMessages : user.settings.notifyMessages,
    notifyMentions: typeof body.notifyMentions === "boolean" ? body.notifyMentions : user.settings.notifyMentions
  };
  const updated = await prisma().user.update({ where: { id: user.id }, data: { settings: json(settings, {}) } });
  const mapped = prismaUserToUser(updated);
  return { user: toSafeUser(mapped), settings: mapped.settings };
}
