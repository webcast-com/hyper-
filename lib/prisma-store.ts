import type { PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import type { Challenge, ChallengeEntry, Conversation, Database, Event, Group, MarketplaceInquiry, MarketplaceListing, MediaAsset, FeatureFlag, ModerationRule, ModerationFlag, Notification, NotificationDigest, Post, Referral, Report, Story, User } from "./types";

const parse = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const json = (value: unknown, fallback: unknown) => JSON.stringify(value ?? fallback);
const iso = (value: Date | string | null | undefined) => new Date(value || Date.now()).toISOString();
const date = (value: Date | string | null | undefined) => new Date(value || Date.now());

function mapUser(user: Awaited<ReturnType<PrismaClient["user"]["findMany"]>>[number]): User {
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
    settings: parse(user.settings, {
      defaultPostVisibility: "public",
      allowMessagesFrom: "everyone",
      profileDiscoverable: true,
      notifyLikes: true,
      notifyComments: true,
      notifyFollows: true,
      notifyFriendRequests: true,
      notifyMessages: true,
      notifyMentions: true,
      digestFrequency: "daily"
    }),
    createdAt: iso(user.createdAt)
  };
}

export async function readPrismaDb(): Promise<Database> {
  const db = prisma();
  const [users, posts, comments, notifications, conversations, messages, stories, groups, events, challenges, challengeEntries, marketplaceListings, marketplaceInquiries, friendRequests, reports, referrals, mediaAssets, authTokens, featureFlags, moderationRules, moderationFlags, notificationDigests] = await Promise.all([
    db.user.findMany(),
    db.post.findMany(),
    db.comment.findMany(),
    db.notification.findMany(),
    db.conversation.findMany(),
    db.message.findMany(),
    db.story.findMany(),
    db.group.findMany(),
    db.event.findMany(),
    db.challenge.findMany(),
    db.challengeEntry.findMany(),
    db.marketplaceListing.findMany(),
    db.marketplaceInquiry.findMany(),
    db.friendRequest.findMany(),
    db.report.findMany(),
    db.referral.findMany(),
    db.mediaAsset.findMany(),
    db.authToken.findMany(),
    db.featureFlag.findMany(),
    db.moderationRule.findMany(),
    db.moderationFlag.findMany(),
    db.notificationDigest.findMany()
  ]);

  const commentsByPost = new Map<string, Database["posts"][number]["comments"]>();
  comments.forEach((comment) => {
    const list = commentsByPost.get(comment.postId) || [];
    list.push({
      id: comment.id,
      userId: comment.userId,
      text: comment.text,
      parentId: comment.parentId || undefined,
      likes: parse<string[]>(comment.likes, []),
      createdAt: iso(comment.createdAt)
    });
    commentsByPost.set(comment.postId, list);
  });

  const messagesByConversation = new Map<string, Conversation["messages"]>();
  messages.forEach((message) => {
    const list = messagesByConversation.get(message.conversationId) || [];
    list.push({
      id: message.id,
      senderId: message.senderId,
      recipientId: message.recipientId,
      text: message.text,
      read: message.read,
      createdAt: iso(message.createdAt)
    });
    messagesByConversation.set(message.conversationId, list);
  });

  return {
    users: users.map(mapUser),
    posts: posts.map((post): Post => ({
      id: post.id,
      authorId: post.authorId,
      groupId: post.groupId || undefined,
      eventId: post.eventId || undefined,
      body: post.body,
      imageUrl: post.imageUrl || "",
      poll: post.poll ? parse(post.poll, undefined) : undefined,
      tags: parse<string[]>(post.tags, []),
      visibility: post.visibility as Post["visibility"],
      likes: parse<string[]>(post.likes, []),
      reactions: parse(post.reactions, {}),
      shares: post.shares,
      comments: (commentsByPost.get(post.id) || []).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
      createdAt: iso(post.createdAt)
    })),
    notifications: notifications.map((notification): Notification => ({
      id: notification.id,
      recipientId: notification.recipientId,
      actorId: notification.actorId,
      type: notification.type as Notification["type"],
      postId: notification.postId || undefined,
      commentId: notification.commentId || undefined,
      read: notification.read,
      createdAt: iso(notification.createdAt)
    })),
    conversations: conversations.map((conversation): Conversation => ({
      id: conversation.id,
      participantIds: parse<string[]>(conversation.participantIds, []),
      messages: (messagesByConversation.get(conversation.id) || []).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
      updatedAt: iso(conversation.updatedAt),
      createdAt: iso(conversation.createdAt)
    })),
    reports: reports.map((report): Report => ({
      id: report.id,
      reporterId: report.reporterId,
      targetType: report.targetType as Report["targetType"],
      targetId: report.targetId,
      reason: report.reason as Report["reason"],
      details: report.details,
      status: report.status as Report["status"],
      createdAt: iso(report.createdAt)
    })),
    stories: stories.map((story): Story => ({
      id: story.id,
      authorId: story.authorId,
      body: story.body,
      imageUrl: story.imageUrl || "",
      views: parse<string[]>(story.views, []),
      createdAt: iso(story.createdAt),
      expiresAt: iso(story.expiresAt)
    })),
    groups: groups.map((group): Group => ({
      id: group.id,
      name: group.name,
      description: group.description,
      cover: group.cover,
      ownerId: group.ownerId,
      memberIds: parse<string[]>(group.memberIds, []),
      createdAt: iso(group.createdAt)
    })),
    events: events.map((event): Event => ({
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      startsAt: iso(event.startsAt),
      hostId: event.hostId,
      attendeeIds: parse<string[]>(event.attendeeIds, []),
      cover: event.cover,
      createdAt: iso(event.createdAt)
    })),
    friendRequests: friendRequests.map((request) => ({
      id: request.id,
      senderId: request.senderId,
      recipientId: request.recipientId,
      status: request.status as "pending" | "accepted" | "declined",
      createdAt: iso(request.createdAt),
      respondedAt: request.respondedAt ? iso(request.respondedAt) : undefined
    })),
    challenges: challenges.map((challenge): Challenge => ({
      id: challenge.id,
      title: challenge.title,
      description: challenge.description,
      theme: challenge.theme,
      prize: challenge.prize,
      startsAt: iso(challenge.startsAt),
      endsAt: iso(challenge.endsAt),
      hostId: challenge.hostId,
      createdAt: iso(challenge.createdAt)
    })),
    challengeEntries: challengeEntries.map((entry): ChallengeEntry => ({
      id: entry.id,
      challengeId: entry.challengeId,
      authorId: entry.authorId,
      title: entry.title,
      body: entry.body,
      imageUrl: entry.imageUrl || "",
      votes: parse<string[]>(entry.votes, []),
      createdAt: iso(entry.createdAt)
    })),
    marketplaceListings: marketplaceListings.map((listing): MarketplaceListing => ({
      id: listing.id,
      sellerId: listing.sellerId,
      title: listing.title,
      description: listing.description,
      type: listing.type as MarketplaceListing["type"],
      category: listing.category,
      price: listing.price,
      currency: listing.currency,
      imageUrl: listing.imageUrl || "",
      tags: parse<string[]>(listing.tags, []),
      saves: parse<string[]>(listing.saves, []),
      active: listing.active,
      createdAt: iso(listing.createdAt)
    })),
    marketplaceInquiries: marketplaceInquiries.map((inquiry): MarketplaceInquiry => ({
      id: inquiry.id,
      listingId: inquiry.listingId,
      buyerId: inquiry.buyerId,
      sellerId: inquiry.sellerId,
      message: inquiry.message,
      status: inquiry.status as MarketplaceInquiry["status"],
      createdAt: iso(inquiry.createdAt)
    })),
    referrals: referrals.map((referral): Referral => ({
      id: referral.id,
      inviterId: referral.inviterId,
      invitedUserId: referral.invitedUserId,
      code: referral.code,
      createdAt: iso(referral.createdAt)
    })),
    mediaAssets: mediaAssets.map((asset): MediaAsset => ({
      id: asset.id,
      ownerId: asset.ownerId,
      url: asset.url,
      provider: asset.provider as MediaAsset["provider"],
      filename: asset.filename,
      mimeType: asset.mimeType,
      size: asset.size,
      width: asset.width || undefined,
      height: asset.height || undefined,
      createdAt: iso(asset.createdAt)
    })),
    authTokens: authTokens.map((token) => ({
      id: token.id,
      userId: token.userId,
      type: token.type as any,
      tokenHash: token.tokenHash,
      expiresAt: iso(token.expiresAt),
      usedAt: token.usedAt ? iso(token.usedAt) : undefined,
      createdAt: iso(token.createdAt)
    })),
    featureFlags: featureFlags.map((flag): FeatureFlag => ({
      key: flag.key,
      enabled: flag.enabled,
      description: flag.description || undefined,
      updatedBy: flag.updatedBy || undefined,
      updatedAt: iso(flag.updatedAt),
      createdAt: iso(flag.createdAt)
    })),
    moderationRules: moderationRules.map((rule): ModerationRule => ({ id: rule.id, phrase: rule.phrase, targetTypes: JSON.parse(rule.targetTypes || "[]"), action: rule.action as any, active: rule.active, createdBy: rule.createdBy || undefined, createdAt: iso(rule.createdAt), updatedAt: iso(rule.updatedAt) })),
    moderationFlags: moderationFlags.map((flag): ModerationFlag => ({ id: flag.id, ruleId: flag.ruleId || undefined, targetType: flag.targetType, targetId: flag.targetId, actorId: flag.actorId || undefined, excerpt: flag.excerpt, status: flag.status as any, createdAt: iso(flag.createdAt) })),
    notificationDigests: notificationDigests.map((digest): NotificationDigest => ({ id: digest.id, userId: digest.userId, frequency: digest.frequency as any, subject: digest.subject, itemCount: digest.itemCount, status: digest.status as any, error: digest.error || undefined, sentAt: digest.sentAt ? iso(digest.sentAt) : undefined, createdAt: iso(digest.createdAt) }))
  };
}

export async function writePrismaDb(snapshot: Database) {
  const db = prisma();
  await db.$transaction(async (tx) => {
    await tx.notification.deleteMany();
    await tx.message.deleteMany();
    await tx.conversation.deleteMany();
    await tx.marketplaceInquiry.deleteMany();
    await tx.marketplaceListing.deleteMany();
    await tx.challengeEntry.deleteMany();
    await tx.challenge.deleteMany();
    await tx.story.deleteMany();
    await tx.comment.deleteMany();
    await tx.post.deleteMany();
    await tx.group.deleteMany();
    await tx.event.deleteMany();
    await tx.friendRequest.deleteMany();
    await tx.report.deleteMany();
    await tx.mediaAsset.deleteMany();
    await tx.referral.deleteMany();
    await tx.user.deleteMany();

    for (const user of snapshot.users) {
      await tx.user.create({ data: {
        id: user.id, name: user.name, username: user.username, email: user.email, emailVerified: Boolean(user.emailVerified), passwordHash: user.passwordHash, bio: user.bio, niche: user.niche,
        website: user.website || null, avatar: user.avatar, banner: user.banner,
        followers: json(user.followers, []), following: json(user.following, []), friends: json(user.friends, []), blockedUsers: json(user.blockedUsers, []), mutedUsers: json(user.mutedUsers, []), savedPosts: json(user.savedPosts, []), settings: json(user.settings, {}), roles: json(user.roles, user.isAdmin ? ["admin", "moderator", "user"] : ["user"]),
        isAdmin: Boolean(user.isAdmin), suspended: Boolean(user.suspended), referralCode: user.referralCode, createdAt: date(user.createdAt)
      }});
    }
    for (const group of snapshot.groups) await tx.group.create({ data: { id: group.id, name: group.name, description: group.description, cover: group.cover, ownerId: group.ownerId, memberIds: json(group.memberIds, []), createdAt: date(group.createdAt) }});
    for (const event of snapshot.events) await tx.event.create({ data: { id: event.id, title: event.title, description: event.description, location: event.location, startsAt: date(event.startsAt), hostId: event.hostId, attendeeIds: json(event.attendeeIds, []), cover: event.cover, createdAt: date(event.createdAt) }});
    for (const post of snapshot.posts) {
      await tx.post.create({ data: { id: post.id, authorId: post.authorId, groupId: post.groupId || null, eventId: post.eventId || null, body: post.body, imageUrl: post.imageUrl || null, poll: post.poll ? json(post.poll, null) : null, tags: json(post.tags, []), visibility: post.visibility || "public", likes: json(post.likes, []), reactions: json(post.reactions, {}), shares: post.shares || 0, createdAt: date(post.createdAt) }});
    }
    for (const post of snapshot.posts) {
      for (const comment of post.comments) {
        await tx.comment.create({ data: { id: comment.id, postId: post.id, userId: comment.userId, parentId: null, text: comment.text, likes: json(comment.likes, []), createdAt: date(comment.createdAt) }});
      }
    }
    for (const post of snapshot.posts) {
      for (const comment of post.comments.filter((item) => item.parentId)) await tx.comment.update({ where: { id: comment.id }, data: { parentId: comment.parentId } });
    }
    for (const story of snapshot.stories) await tx.story.create({ data: { id: story.id, authorId: story.authorId, body: story.body, imageUrl: story.imageUrl || null, views: json(story.views, []), createdAt: date(story.createdAt), expiresAt: date(story.expiresAt) }});
    for (const challenge of snapshot.challenges) await tx.challenge.create({ data: { id: challenge.id, title: challenge.title, description: challenge.description, theme: challenge.theme, prize: challenge.prize, startsAt: date(challenge.startsAt), endsAt: date(challenge.endsAt), hostId: challenge.hostId, createdAt: date(challenge.createdAt) }});
    for (const entry of snapshot.challengeEntries) await tx.challengeEntry.create({ data: { id: entry.id, challengeId: entry.challengeId, authorId: entry.authorId, title: entry.title, body: entry.body, imageUrl: entry.imageUrl || null, votes: json(entry.votes, []), createdAt: date(entry.createdAt) }});
    for (const listing of snapshot.marketplaceListings) await tx.marketplaceListing.create({ data: { id: listing.id, sellerId: listing.sellerId, title: listing.title, description: listing.description, type: listing.type, category: listing.category, price: listing.price, currency: listing.currency, imageUrl: listing.imageUrl || null, tags: json(listing.tags, []), saves: json(listing.saves, []), active: listing.active, createdAt: date(listing.createdAt) }});
    for (const inquiry of snapshot.marketplaceInquiries) await tx.marketplaceInquiry.create({ data: { id: inquiry.id, listingId: inquiry.listingId, buyerId: inquiry.buyerId, sellerId: inquiry.sellerId, message: inquiry.message, status: inquiry.status, createdAt: date(inquiry.createdAt) }});
    for (const conversation of snapshot.conversations) {
      await tx.conversation.create({ data: { id: conversation.id, participantIds: json(conversation.participantIds, []), createdAt: date(conversation.createdAt), updatedAt: date(conversation.updatedAt) }});
      for (const message of conversation.messages) await tx.message.create({ data: { id: message.id, conversationId: conversation.id, senderId: message.senderId, recipientId: message.recipientId, text: message.text, read: message.read, createdAt: date(message.createdAt) }});
    }
    for (const notification of snapshot.notifications) await tx.notification.create({ data: { id: notification.id, recipientId: notification.recipientId, actorId: notification.actorId, type: notification.type, postId: notification.postId || null, commentId: notification.commentId || null, read: notification.read, createdAt: date(notification.createdAt) }});
    for (const request of snapshot.friendRequests) await tx.friendRequest.create({ data: { id: request.id, senderId: request.senderId, recipientId: request.recipientId, status: request.status, createdAt: date(request.createdAt), respondedAt: request.respondedAt ? date(request.respondedAt) : null }});
    for (const report of snapshot.reports) await tx.report.create({ data: { id: report.id, reporterId: report.reporterId, targetType: report.targetType, targetId: report.targetId, reason: report.reason, details: report.details, status: report.status, createdAt: date(report.createdAt) }});
    for (const referral of snapshot.referrals) await tx.referral.create({ data: { id: referral.id, inviterId: referral.inviterId, invitedUserId: referral.invitedUserId, code: referral.code, createdAt: date(referral.createdAt) }});
    for (const asset of snapshot.mediaAssets || []) await tx.mediaAsset.create({ data: { id: asset.id, ownerId: asset.ownerId, url: asset.url, provider: asset.provider, filename: asset.filename, mimeType: asset.mimeType, size: asset.size, width: asset.width || null, height: asset.height || null, createdAt: date(asset.createdAt) }});
    for (const token of snapshot.authTokens || []) await tx.authToken.create({ data: { id: token.id, userId: token.userId, type: token.type, tokenHash: token.tokenHash, expiresAt: date(token.expiresAt), usedAt: token.usedAt ? date(token.usedAt) : null, createdAt: date(token.createdAt) }});
    for (const flag of snapshot.featureFlags || []) await tx.featureFlag.create({ data: { key: flag.key, enabled: flag.enabled, description: flag.description || null, updatedBy: flag.updatedBy || null, createdAt: date(flag.createdAt), updatedAt: date(flag.updatedAt) }});
    for (const rule of snapshot.moderationRules || []) await tx.moderationRule.create({ data: { id: rule.id, phrase: rule.phrase, targetTypes: JSON.stringify(rule.targetTypes || []), action: rule.action, active: rule.active, createdBy: rule.createdBy || null, createdAt: date(rule.createdAt), updatedAt: date(rule.updatedAt) }});
    for (const flag of snapshot.moderationFlags || []) await tx.moderationFlag.create({ data: { id: flag.id, ruleId: flag.ruleId || null, targetType: flag.targetType, targetId: flag.targetId, actorId: flag.actorId || null, excerpt: flag.excerpt, status: flag.status, createdAt: date(flag.createdAt) }});
    for (const digest of snapshot.notificationDigests || []) await tx.notificationDigest.create({ data: { id: digest.id, userId: digest.userId, frequency: digest.frequency, subject: digest.subject, itemCount: digest.itemCount, status: digest.status, error: digest.error || null, sentAt: digest.sentAt ? date(digest.sentAt) : null, createdAt: date(digest.createdAt) }});
  }, { timeout: 30_000 });
}
