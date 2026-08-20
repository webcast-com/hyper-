/**
 * Relational projection of JSON-in-column graph fields.
 *
 * The public API still reads the denormalized JSON columns so behavior stays the
 * same. These tables exist so Prisma/SQL can join and enforce FKs.
 */

type Db = {
  user: { findUnique: Function; findMany: Function };
  post: { findUnique: Function; findMany: Function };
  comment: { findUnique: Function; findMany: Function };
  group: { findUnique: Function; findMany: Function };
  event: { findUnique: Function; findMany: Function };
  conversation: { findUnique: Function; findMany: Function };
  marketplaceListing: { findUnique: Function; findMany: Function };
  challengeEntry: { findUnique: Function; findMany: Function };
  follow: { deleteMany: Function; createMany: Function };
  friendship: { deleteMany: Function; createMany: Function };
  userBlock: { deleteMany: Function; createMany: Function };
  userMute: { deleteMany: Function; createMany: Function };
  savedPost: { deleteMany: Function; createMany: Function };
  postLike: { deleteMany: Function; createMany: Function };
  commentLike: { deleteMany: Function; createMany: Function };
  postTag: { deleteMany: Function; createMany: Function };
  groupMember: { deleteMany: Function; createMany: Function };
  eventAttendee: { deleteMany: Function; createMany: Function };
  conversationParticipant: { deleteMany: Function; createMany: Function };
  listingSave: { deleteMany: Function; createMany: Function };
  challengeEntryVote: { deleteMany: Function; createMany: Function };
};

export function parseJsonIds(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
  } catch {
    return [];
  }
}

function uniqueAllowed(ids: string[], allowed?: Set<string>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    if (allowed && !allowed.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

async function userIdSet(db: Db) {
  const rows = await db.user.findMany({ select: { id: true } });
  return new Set<string>(rows.map((row: { id: string }) => row.id));
}

async function postIdSet(db: Db) {
  const rows = await db.post.findMany({ select: { id: true } });
  return new Set<string>(rows.map((row: { id: string }) => row.id));
}

async function ignoreMissingGraph(task: () => Promise<void>) {
  try {
    await task();
  } catch (error) {
    const message = (error as Error).message || "";
    if (/does not exist|no such table|Cannot read properties of undefined|is not a function/i.test(message)) {
      return;
    }
    throw error;
  }
}

export async function syncUserGraph(db: Db, userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const users = await userIdSet(db);
  const posts = await postIdSet(db);

  const following = uniqueAllowed(parseJsonIds(user.following), users).filter((id) => id !== userId);
  const followers = uniqueAllowed(parseJsonIds(user.followers), users).filter((id) => id !== userId);
  const friends = uniqueAllowed(parseJsonIds(user.friends), users).filter((id) => id !== userId);
  const blocked = uniqueAllowed(parseJsonIds(user.blockedUsers), users).filter((id) => id !== userId);
  const muted = uniqueAllowed(parseJsonIds(user.mutedUsers), users).filter((id) => id !== userId);
  const saved = uniqueAllowed(parseJsonIds(user.savedPosts), posts);

  await db.follow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } });
  const followRows = [
    ...following.map((followingId) => ({ followerId: userId, followingId })),
    ...followers.map((followerId) => ({ followerId, followingId: userId }))
  ];
  if (followRows.length) await db.follow.createMany({ data: followRows, skipDuplicates: true });

  await db.friendship.deleteMany({ where: { userId } });
  if (friends.length) {
    await db.friendship.createMany({
      data: friends.map((friendId) => ({ userId, friendId })),
      skipDuplicates: true
    });
  }

  await db.userBlock.deleteMany({ where: { userId } });
  if (blocked.length) {
    await db.userBlock.createMany({
      data: blocked.map((blockedUserId) => ({ userId, blockedUserId })),
      skipDuplicates: true
    });
  }

  await db.userMute.deleteMany({ where: { userId } });
  if (muted.length) {
    await db.userMute.createMany({
      data: muted.map((mutedUserId) => ({ userId, mutedUserId })),
      skipDuplicates: true
    });
  }

  await db.savedPost.deleteMany({ where: { userId } });
  if (saved.length) {
    await db.savedPost.createMany({
      data: saved.map((postId) => ({ userId, postId })),
      skipDuplicates: true
    });
  }
}

export async function syncPostGraph(db: Db, postId: string) {
  const post = await db.post.findUnique({ where: { id: postId } });
  if (!post) return;
  const users = await userIdSet(db);
  const likes = uniqueAllowed(parseJsonIds(post.likes), users);
  const tags = uniqueAllowed(parseJsonIds(post.tags));

  await db.postLike.deleteMany({ where: { postId } });
  if (likes.length) {
    await db.postLike.createMany({
      data: likes.map((userId) => ({ postId, userId })),
      skipDuplicates: true
    });
  }

  await db.postTag.deleteMany({ where: { postId } });
  if (tags.length) {
    await db.postTag.createMany({
      data: tags.map((tag) => ({ postId, tag: tag.slice(0, 64).toLowerCase() })),
      skipDuplicates: true
    });
  }
}

export async function syncCommentGraph(db: Db, commentId: string) {
  const comment = await db.comment.findUnique({ where: { id: commentId } });
  if (!comment) return;
  const users = await userIdSet(db);
  const likes = uniqueAllowed(parseJsonIds(comment.likes), users);
  await db.commentLike.deleteMany({ where: { commentId } });
  if (likes.length) {
    await db.commentLike.createMany({
      data: likes.map((userId) => ({ commentId, userId })),
      skipDuplicates: true
    });
  }
}

export async function syncGroupGraph(db: Db, groupId: string) {
  const group = await db.group.findUnique({ where: { id: groupId } });
  if (!group) return;
  const users = await userIdSet(db);
  const memberIds = uniqueAllowed(parseJsonIds(group.memberIds), users);
  await db.groupMember.deleteMany({ where: { groupId } });
  if (memberIds.length) {
    await db.groupMember.createMany({
      data: memberIds.map((userId) => ({ groupId, userId })),
      skipDuplicates: true
    });
  }
}

export async function syncEventGraph(db: Db, eventId: string) {
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return;
  const users = await userIdSet(db);
  const attendeeIds = uniqueAllowed(parseJsonIds(event.attendeeIds), users);
  await db.eventAttendee.deleteMany({ where: { eventId } });
  if (attendeeIds.length) {
    await db.eventAttendee.createMany({
      data: attendeeIds.map((userId) => ({ eventId, userId })),
      skipDuplicates: true
    });
  }
}

export async function syncConversationGraph(db: Db, conversationId: string) {
  const conversation = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) return;
  const users = await userIdSet(db);
  const participantIds = uniqueAllowed(parseJsonIds(conversation.participantIds), users);
  await db.conversationParticipant.deleteMany({ where: { conversationId } });
  if (participantIds.length) {
    await db.conversationParticipant.createMany({
      data: participantIds.map((userId) => ({ conversationId, userId })),
      skipDuplicates: true
    });
  }
}

export async function syncListingGraph(db: Db, listingId: string) {
  const listing = await db.marketplaceListing.findUnique({ where: { id: listingId } });
  if (!listing) return;
  const users = await userIdSet(db);
  const saves = uniqueAllowed(parseJsonIds(listing.saves), users);
  await db.listingSave.deleteMany({ where: { listingId } });
  if (saves.length) {
    await db.listingSave.createMany({
      data: saves.map((userId) => ({ listingId, userId })),
      skipDuplicates: true
    });
  }
}

export async function syncChallengeEntryGraph(db: Db, entryId: string) {
  const entry = await db.challengeEntry.findUnique({ where: { id: entryId } });
  if (!entry) return;
  const users = await userIdSet(db);
  const votes = uniqueAllowed(parseJsonIds(entry.votes), users);
  await db.challengeEntryVote.deleteMany({ where: { entryId } });
  if (votes.length) {
    await db.challengeEntryVote.createMany({
      data: votes.map((userId) => ({ entryId, userId })),
      skipDuplicates: true
    });
  }
}

export async function clearGraphTables(db: Db) {
  await ignoreMissingGraph(async () => {
    await db.challengeEntryVote.deleteMany();
    await db.listingSave.deleteMany();
    await db.conversationParticipant.deleteMany();
    await db.eventAttendee.deleteMany();
    await db.groupMember.deleteMany();
    await db.commentLike.deleteMany();
    await db.postLike.deleteMany();
    await db.postTag.deleteMany();
    await db.savedPost.deleteMany();
    await db.userMute.deleteMany();
    await db.userBlock.deleteMany();
    await db.friendship.deleteMany();
    await db.follow.deleteMany();
  });
}

export async function syncUserGraphSafe(db: Db, userId: string) {
  await ignoreMissingGraph(() => syncUserGraph(db, userId));
}

export async function syncPostGraphSafe(db: Db, postId: string) {
  await ignoreMissingGraph(() => syncPostGraph(db, postId));
}

export async function syncCommentGraphSafe(db: Db, commentId: string) {
  await ignoreMissingGraph(() => syncCommentGraph(db, commentId));
}

export async function syncGroupGraphSafe(db: Db, groupId: string) {
  await ignoreMissingGraph(() => syncGroupGraph(db, groupId));
}

export async function syncEventGraphSafe(db: Db, eventId: string) {
  await ignoreMissingGraph(() => syncEventGraph(db, eventId));
}

export async function syncConversationGraphSafe(db: Db, conversationId: string) {
  await ignoreMissingGraph(() => syncConversationGraph(db, conversationId));
}

export async function syncListingGraphSafe(db: Db, listingId: string) {
  await ignoreMissingGraph(() => syncListingGraph(db, listingId));
}

export async function syncChallengeEntryGraphSafe(db: Db, entryId: string) {
  await ignoreMissingGraph(() => syncChallengeEntryGraph(db, entryId));
}

export async function syncAllGraph(db: Db) {
  await ignoreMissingGraph(() => syncAllGraphUnchecked(db));
}

async function syncAllGraphUnchecked(db: Db) {
  const [users, posts, comments, groups, events, conversations, listings, entries] = await Promise.all([
    db.user.findMany({ select: { id: true } }),
    db.post.findMany({ select: { id: true } }),
    db.comment.findMany({ select: { id: true } }),
    db.group.findMany({ select: { id: true } }),
    db.event.findMany({ select: { id: true } }),
    db.conversation.findMany({ select: { id: true } }),
    db.marketplaceListing.findMany({ select: { id: true } }),
    db.challengeEntry.findMany({ select: { id: true } })
  ]);

  for (const user of users) await syncUserGraph(db, user.id);
  for (const post of posts) await syncPostGraph(db, post.id);
  for (const comment of comments) await syncCommentGraph(db, comment.id);
  for (const group of groups) await syncGroupGraph(db, group.id);
  for (const event of events) await syncEventGraph(db, event.id);
  for (const conversation of conversations) await syncConversationGraph(db, conversation.id);
  for (const listing of listings) await syncListingGraph(db, listing.id);
  for (const entry of entries) await syncChallengeEntryGraph(db, entry.id);
}
