import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { isJsonDriver } from "./data-driver";
import type { AuthToken, FeatureFlag, ModerationRule, ModerationFlag, Challenge, ChallengeEntry, Conversation, Database, Event, FriendRequest, Group, MarketplaceInquiry, MarketplaceListing, MediaAsset, Message, Notification, NotificationDigest, Post, PostVisibility, ReactionType, Referral, Report, SafeUser, Story, User } from "./types";

const dbPath = path.join(process.cwd(), "data", "db.json");
const usePrismaRuntime = () => !isJsonDriver();
let writeQueue = Promise.resolve();

function now() {
  return new Date().toISOString();
}

export function id(prefix = "id") {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

export function toSafeUser(user: User): SafeUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safe } = user;
  return safe;
}

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

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

function seedDb(): Database {
  const users: User[] = [
    {
      id: "usr_maya",
      name: "Maya Okello",
      username: "mayamakes",
      email: "maya@example.com",
      emailVerified: true,
      passwordHash: "demo_admin_salt_2026:340a6d7ab994c4dff6e8635c2131cd93fb6d96bc4800af6c2be23387ec387bd48310df4044bf6707910566d3af3bad781612d9c3e47736a65c03f15a90dbd7b6",
      bio: "Visual storyteller sharing brand identity breakdowns, behind-the-scenes sketches, and Nairobi cafe work sessions.",
      niche: "Design",
      website: "https://example.com/maya",
      avatar: "https://api.dicebear.com/8.x/adventurer/svg?seed=Maya",
      banner: "linear-gradient(135deg,#7c3aed,#ec4899)",
      followers: ["usr_zuri", "usr_leo"],
      following: ["usr_zuri"],
      friends: ["usr_zuri"],
      blockedUsers: [],
      mutedUsers: [],
      isAdmin: true,
      roles: ["owner", "admin", "moderator", "user"],
      suspended: false,
      referralCode: "MAYA2026",
      savedPosts: ["post_3"],
      settings: defaultSettings(),
      createdAt: daysAgo(90)
    },
    {
      id: "usr_zuri",
      name: "Zuri Beats",
      username: "zuribeats",
      email: "zuri@example.com",
      emailVerified: true,
      passwordHash: "demo_zuri_salt_2026:be96796e0da950a6f75264df5fe5948fd2d4c6117286c2446dab252c566e9462f8bcacc69727e981f83a3e707717b23005058584b34f64aa56c7fc54a0aa6454",
      bio: "Producer. Sharing loops, breakdowns, plug-in chains, and creative challenges for bedroom musicians.",
      niche: "Music",
      website: "https://example.com/zuri",
      avatar: "https://api.dicebear.com/8.x/adventurer/svg?seed=Zuri",
      banner: "linear-gradient(135deg,#06b6d4,#3b82f6)",
      followers: ["usr_maya"],
      following: ["usr_maya", "usr_leo"],
      friends: ["usr_maya"],
      blockedUsers: [],
      mutedUsers: [],
      isAdmin: false,
      roles: ["user"],
      suspended: false,
      referralCode: "ZURI2026",
      savedPosts: ["post_1"],
      settings: defaultSettings(),
      createdAt: daysAgo(75)
    },
    {
      id: "usr_leo",
      name: "Leo Frames",
      username: "leoframes",
      email: "leo@example.com",
      emailVerified: true,
      passwordHash: "demo_leo_salt_2026:236e6ad4bde465442d9f78ad86ec85854f157c18307cb61d33855a5bee7b0c319d3bedeeb1e8abb6e61b14a56c8692c1b65c59cf30ba41f68a8f6af9021b29d8",
      bio: "Street photographer publishing weekly photo walks, editing recipes, and print drops.",
      niche: "Photography",
      website: "https://example.com/leo",
      avatar: "https://api.dicebear.com/8.x/adventurer/svg?seed=Leo",
      banner: "linear-gradient(135deg,#f97316,#ef4444)",
      followers: ["usr_zuri"],
      following: ["usr_maya"],
      friends: [],
      blockedUsers: [],
      mutedUsers: [],
      isAdmin: false,
      roles: ["user"],
      suspended: false,
      referralCode: "LEO2026",
      savedPosts: [],
      settings: defaultSettings(),
      createdAt: daysAgo(50)
    }
  ];

  const posts: Post[] = [
    {
      id: "post_1",
      authorId: "usr_maya",
      body: "Just finished a 3-page visual identity system for a coffee roaster. My favorite exercise: defining what the brand should NEVER look like before touching colors.",
      imageUrl: "",
      tags: ["branding", "design", "process"],
      visibility: "public",
      likes: ["usr_zuri", "usr_leo"],
      reactions: { love: ["usr_zuri"], wow: ["usr_leo"] },
      shares: 2,
      comments: [
        { id: "c1", userId: "usr_zuri", text: "That negative-space rule is underrated.", likes: ["usr_maya"], createdAt: daysAgo(2) },
        { id: "c1_reply", userId: "usr_maya", text: "Exactly — constraints make the direction clearer.", parentId: "c1", likes: [], createdAt: daysAgo(1) }
      ],
      createdAt: daysAgo(3)
    },
    {
      id: "post_2",
      authorId: "usr_zuri",
      body: "Creator challenge: make an 8-bar loop using only sounds recorded in your kitchen. Drop your weirdest sample idea below.",
      imageUrl: "",
      poll: {
        question: "Which sample should lead the challenge pack?",
        allowMultiple: false,
        options: [
          { id: "opt_cups", text: "Coffee cup taps", votes: ["usr_maya"] },
          { id: "opt_fridge", text: "Fridge hum bass", votes: [] },
          { id: "opt_spoon", text: "Spoon percussion", votes: ["usr_leo"] }
        ]
      },
      tags: ["music", "challenge", "samples"],
      visibility: "public",
      likes: ["usr_maya"],
      reactions: { haha: ["usr_maya"] },
      shares: 1,
      comments: [],
      createdAt: daysAgo(2)
    },
    {
      id: "post_3",
      authorId: "usr_leo",
      body: "Golden hour is nice, but rainy reflections after sunset are the real cheat code for city photos.",
      imageUrl: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=80",
      tags: ["photography", "street", "tips"],
      visibility: "public",
      likes: ["usr_maya", "usr_zuri"],
      reactions: { love: ["usr_maya"], wow: ["usr_zuri"] },
      shares: 3,
      comments: [{ id: "c2", userId: "usr_maya", text: "The mood in this is perfect.", likes: ["usr_leo"], createdAt: daysAgo(1) }],
      createdAt: daysAgo(1)
    }
  ];

  const notifications: Notification[] = [
    { id: "notif_1", recipientId: "usr_maya", actorId: "usr_zuri", type: "comment", postId: "post_1", commentId: "c1", read: false, createdAt: daysAgo(2) },
    { id: "notif_2", recipientId: "usr_leo", actorId: "usr_maya", type: "comment", postId: "post_3", commentId: "c2", read: false, createdAt: daysAgo(1) },
    { id: "notif_3", recipientId: "usr_maya", actorId: "usr_leo", type: "like", postId: "post_1", read: true, createdAt: daysAgo(2) }
  ];

  const conversations: Conversation[] = [];
  const reports: Report[] = [];
  const friendRequests: FriendRequest[] = [
    { id: "fr_1", senderId: "usr_leo", recipientId: "usr_maya", status: "pending", createdAt: daysAgo(1) }
  ];
  const stories: Story[] = [
    { id: "story_1", authorId: "usr_maya", body: "Moodboard day ✨", imageUrl: "", views: [], createdAt: daysAgo(0), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
    { id: "story_2", authorId: "usr_zuri", body: "New beat preview tonight", imageUrl: "", views: [], createdAt: daysAgo(0), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }
  ];
  const groups: Group[] = [
    { id: "grp_design", name: "Design Circle", description: "Feedback, critiques, resources, and creative briefs for designers.", cover: "linear-gradient(135deg,#7c3aed,#ec4899)", ownerId: "usr_maya", memberIds: ["usr_maya", "usr_zuri"], createdAt: daysAgo(20) },
    { id: "grp_audio", name: "Bedroom Producers", description: "Loops, plugins, mix notes, and weekly music challenges.", cover: "linear-gradient(135deg,#06b6d4,#3b82f6)", ownerId: "usr_zuri", memberIds: ["usr_zuri"], createdAt: daysAgo(18) }
  ];
  const events: Event[] = [
    { id: "evt_walk", title: "Nairobi Creator Walk", description: "A casual photo/design/audio inspiration walk with creators.", location: "Nairobi CBD", startsAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(), hostId: "usr_leo", attendeeIds: ["usr_leo", "usr_maya"], cover: "linear-gradient(135deg,#f97316,#ef4444)", createdAt: daysAgo(5) }
  ];
  const marketplaceListings: MarketplaceListing[] = [
    { id: "lst_brand", sellerId: "usr_maya", title: "Brand identity mini-audit", description: "I will review your creator brand visuals and send a concise improvement plan.", type: "service", category: "Design", price: 35, currency: "USD", imageUrl: "", tags: ["branding", "design", "audit"], saves: ["usr_zuri"], active: true, createdAt: daysAgo(4) },
    { id: "lst_loops", sellerId: "usr_zuri", title: "Afro-electronic loop pack", description: "A royalty-free starter loop pack for reels, intros, and demos.", type: "digital_product", category: "Music", price: 12, currency: "USD", imageUrl: "", tags: ["music", "loops", "samples"], saves: [], active: true, createdAt: daysAgo(3) },
    { id: "lst_photo", sellerId: "usr_leo", title: "Creator portrait session", description: "A short outdoor portrait session for profile photos and promo content.", type: "service", category: "Photography", price: 80, currency: "USD", imageUrl: "", tags: ["photography", "portraits"], saves: ["usr_maya"], active: true, createdAt: daysAgo(2) }
  ];
  const marketplaceInquiries: MarketplaceInquiry[] = [];
  const referrals: Referral[] = [];
  const mediaAssets: MediaAsset[] = [];
  const authTokens: AuthToken[] = [];
  const featureFlags: FeatureFlag[] = [];
  const moderationRules: ModerationRule[] = [];
  const moderationFlags: ModerationFlag[] = [];
  const notificationDigests: NotificationDigest[] = [];

  const challenges: Challenge[] = [
    { id: "chl_weekly", title: "Weekly Creator Sprint", description: "Create a post, image, beat, photo, or design around the theme and let the community vote.", theme: "Behind the process", prize: "Featured on Explore + Creator Sprint badge", startsAt: daysAgo(1), endsAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(), hostId: "usr_maya", createdAt: daysAgo(1) }
  ];
  const challengeEntries: ChallengeEntry[] = [
    { id: "entry_1", challengeId: "chl_weekly", authorId: "usr_maya", title: "Brand board breakdown", body: "A quick breakdown of how I turn messy notes into a visual direction.", imageUrl: "", votes: ["usr_zuri"], createdAt: daysAgo(0) },
    { id: "entry_2", challengeId: "chl_weekly", authorId: "usr_zuri", title: "Kitchen sample loop", body: "A beat made with coffee cup taps, fridge hum, and a spoon hit.", imageUrl: "", votes: ["usr_maya", "usr_leo"], createdAt: daysAgo(0) }
  ];

  return { users, posts, notifications, conversations, reports, stories, groups, events, friendRequests, challenges, challengeEntries, marketplaceListings, marketplaceInquiries, referrals, mediaAssets, authTokens, featureFlags, moderationRules, moderationFlags, notificationDigests };
}

async function ensureDb() {
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  try {
    await fs.access(dbPath);
  } catch {
    await fs.writeFile(dbPath, JSON.stringify(seedDb(), null, 2), "utf8");
  }
}

export async function readDb(): Promise<Database> {
  if (usePrismaRuntime()) {
    const { readPrismaDb } = await import("./prisma-store");
    return readPrismaDb();
  }
  await ensureDb();
  const raw = await fs.readFile(dbPath, "utf8");
  const db = JSON.parse(raw) as Database;
  if (!Array.isArray(db.notifications)) db.notifications = [];
  if (!Array.isArray(db.conversations)) db.conversations = [];
  if (!Array.isArray(db.reports)) db.reports = [];
  if (!Array.isArray(db.stories)) db.stories = [];
  if (!Array.isArray(db.groups)) db.groups = [];
  if (!Array.isArray(db.events)) db.events = [];
  if (!Array.isArray(db.friendRequests)) db.friendRequests = [];
  if (!Array.isArray(db.challenges)) db.challenges = [];
  if (!Array.isArray(db.challengeEntries)) db.challengeEntries = [];
  if (!Array.isArray(db.marketplaceListings)) db.marketplaceListings = [];
  if (!Array.isArray(db.marketplaceInquiries)) db.marketplaceInquiries = [];
  if (!Array.isArray(db.referrals)) db.referrals = [];
  if (!Array.isArray(db.mediaAssets)) db.mediaAssets = [];
  if (!Array.isArray(db.authTokens)) db.authTokens = [];
  if (!Array.isArray(db.featureFlags)) db.featureFlags = [];
  if (!Array.isArray(db.moderationRules)) db.moderationRules = [];
  if (!Array.isArray(db.moderationFlags)) db.moderationFlags = [];
  if (!Array.isArray(db.notificationDigests)) db.notificationDigests = [];
  db.users.forEach((user) => {
    if (!Array.isArray(user.friends)) user.friends = [];
    if (!Array.isArray(user.blockedUsers)) user.blockedUsers = [];
    if (!Array.isArray(user.mutedUsers)) user.mutedUsers = [];
    if (typeof user.isAdmin !== "boolean") user.isAdmin = user.username === "mayamakes";
    if (!Array.isArray(user.roles)) user.roles = user.isAdmin ? ["admin", "moderator", "user"] : ["user"];
    if (user.username === "mayamakes") {
      user.isAdmin = true;
      user.roles = Array.from(new Set([...(user.roles || []), "owner", "admin", "moderator", "user"]));
      if (user.passwordHash === "demo-only") user.passwordHash = "demo_admin_salt_2026:340a6d7ab994c4dff6e8635c2131cd93fb6d96bc4800af6c2be23387ec387bd48310df4044bf6707910566d3af3bad781612d9c3e47736a65c03f15a90dbd7b6";
    }
    if (user.passwordHash === "demo-only") user.passwordHash = "demo_user_salt_2026:2883ffbc6d2a58a885045844221c4796551ca088f6a6a7614f274384678af096085485bd444e4c4298cfc75f47529661ab5889b2680a7f62e98ea2c3732e51b2";
    if (typeof user.emailVerified !== "boolean") user.emailVerified = user.username === "mayamakes" || user.username === "zuribeats" || user.username === "leoframes";
    if (typeof user.suspended !== "boolean") user.suspended = false;
    if (!user.referralCode) user.referralCode = `${user.username.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)}${user.id.slice(-4).toUpperCase()}`;
    if (!Array.isArray(user.savedPosts)) user.savedPosts = [];
    user.settings = { ...defaultSettings(), ...(user.settings || {}) };
  });
  db.posts.forEach((post) => {
    if (!post.reactions) post.reactions = {};
    if (typeof post.shares !== "number") post.shares = 0;
    if (!post.visibility) post.visibility = "public" as PostVisibility;
    post.comments.forEach((comment) => {
      if (!Array.isArray(comment.likes)) comment.likes = [];
    });
  });
  return db;
}

export async function writeDb(db: Database) {
  if (usePrismaRuntime()) {
    throw new Error(
      "Refusing to wipe-and-rewrite the Prisma database via writeDb(). Use direct Prisma helpers, or the seed/import scripts that call writePrismaDb() explicitly."
    );
  }
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  writeQueue = writeQueue.then(() => fs.writeFile(dbPath, JSON.stringify(db, null, 2), "utf8"));
  await writeQueue;
}

export async function updateDb<T>(mutator: (db: Database) => T | Promise<T>) {
  const db = await readDb();
  const result = await mutator(db);
  await writeDb(db);
  return result;
}

export async function findUserById(userId: string) {
  if (usePrismaRuntime()) {
    const { findUserByIdPrisma } = await import("./prisma-direct-auth");
    return findUserByIdPrisma(userId);
  }
  const db = await readDb();
  return db.users.find((user) => user.id === userId) ?? null;
}

export function isBlockedBetween(a: User | null | undefined, b: User | null | undefined) {
  if (!a || !b) return false;
  return a.blockedUsers.includes(b.id) || b.blockedUsers.includes(a.id);
}

export function canViewPost(post: Post, viewer: User | null, users: User[]) {
  const visibility = post.visibility || "public";
  const author = users.find((user) => user.id === post.authorId);
  if (!author) return false;
  if (viewer && isBlockedBetween(author, viewer)) return false;
  if (viewer?.mutedUsers.includes(author.id) && post.authorId !== viewer.id) return false;
  if (visibility === "public") return true;
  if (!viewer) return false;
  if (post.authorId === viewer.id) return true;
  if (visibility === "followers") return viewer.following.includes(author.id);
  if (visibility === "friends") return author.friends.includes(viewer.id) && viewer.friends.includes(author.id);
  return false;
}

export function publicPost(post: Post, users: User[], groups: Group[] = [], events: Event[] = []) {
  const author = users.find((user) => user.id === post.authorId);
  const group = post.groupId ? groups.find((item) => item.id === post.groupId) : null;
  const event = post.eventId ? events.find((item) => item.id === post.eventId) : null;
  return {
    ...post,
    visibility: post.visibility || "public",
    group: group ? { id: group.id, name: group.name, cover: group.cover } : null,
    event: event ? { id: event.id, title: event.title, cover: event.cover, startsAt: event.startsAt } : null,
    reactions: post.reactions ?? {},
    shares: post.shares ?? 0,
    author: author ? toSafeUser(author) : null,
    comments: post.comments.map((comment) => ({
      ...comment,
      author: users.find((user) => user.id === comment.userId)
        ? toSafeUser(users.find((user) => user.id === comment.userId)!)
        : null
    }))
  };
}

export function extractMentionedUsers(text: string, users: User[]) {
  const usernames = Array.from(new Set((text.match(/@[a-zA-Z0-9_]+/g) || []).map((item) => item.slice(1).toLowerCase())));
  return users.filter((user) => usernames.includes(user.username.toLowerCase()));
}

export { now };


export function addNotification(db: Database, notification: Omit<Notification, "id" | "read" | "createdAt">) {
  if (notification.recipientId === notification.actorId) return null;
  const recipient = db.users.find((user) => user.id === notification.recipientId);
  const settings = recipient?.settings || defaultSettings();
  const allowed = {
    like: settings.notifyLikes,
    comment: settings.notifyComments,
    follow: settings.notifyFollows,
    friend_request: settings.notifyFriendRequests,
    friend_accept: settings.notifyFriendRequests,
    message: settings.notifyMessages,
    mention: settings.notifyMentions
  }[notification.type];
  if (!allowed) return null;

  const duplicate = notification.type === "message" ? null : db.notifications.find((item) =>
    item.recipientId === notification.recipientId &&
    item.actorId === notification.actorId &&
    item.type === notification.type &&
    item.postId === notification.postId &&
    item.commentId === notification.commentId
  );

  if (duplicate) return duplicate;

  const created: Notification = {
    ...notification,
    id: id("notif"),
    read: false,
    createdAt: now()
  };
  db.notifications.push(created);
  return created;
}

export function publicNotification(notification: Notification, users: User[], posts: Post[]) {
  const actor = users.find((user) => user.id === notification.actorId);
  const post = notification.postId ? posts.find((item) => item.id === notification.postId) : null;
  return {
    ...notification,
    actor: actor ? toSafeUser(actor) : null,
    post: post ? { id: post.id, body: post.body, imageUrl: post.imageUrl, authorId: post.authorId } : null
  };
}


export function publicMessage(message: Message, users: User[]) {
  const sender = users.find((user) => user.id === message.senderId);
  const recipient = users.find((user) => user.id === message.recipientId);
  return {
    ...message,
    sender: sender ? toSafeUser(sender) : null,
    recipient: recipient ? toSafeUser(recipient) : null
  };
}

export function publicConversation(conversation: Conversation, users: User[], currentUserId: string) {
  const participants = conversation.participantIds
    .map((participantId) => users.find((user) => user.id === participantId))
    .filter(Boolean)
    .map((user) => toSafeUser(user!));
  const otherUser = participants.find((user) => user.id !== currentUserId) ?? participants[0] ?? null;
  const unreadCount = conversation.messages.filter((message) => message.recipientId === currentUserId && !message.read).length;
  return {
    ...conversation,
    participants,
    otherUser,
    unreadCount,
    messages: conversation.messages.map((message) => publicMessage(message, users))
  };
}


export const reactionTypes: ReactionType[] = ["like", "love", "care", "haha", "wow", "sad", "angry"];

export function publicStory(story: Story, users: User[]) {
  const author = users.find((user) => user.id === story.authorId);
  return { ...story, author: author ? toSafeUser(author) : null };
}

export function publicGroup(group: Group, users: User[], currentUserId?: string) {
  const owner = users.find((user) => user.id === group.ownerId);
  return {
    ...group,
    owner: owner ? toSafeUser(owner) : null,
    memberCount: group.memberIds.length,
    isMember: currentUserId ? group.memberIds.includes(currentUserId) : false
  };
}

export function publicEvent(event: Event, users: User[], currentUserId?: string) {
  const host = users.find((user) => user.id === event.hostId);
  return {
    ...event,
    host: host ? toSafeUser(host) : null,
    attendeeCount: event.attendeeIds.length,
    isAttending: currentUserId ? event.attendeeIds.includes(currentUserId) : false
  };
}


export function publicFriendRequest(request: FriendRequest, users: User[]) {
  const sender = users.find((user) => user.id === request.senderId);
  const recipient = users.find((user) => user.id === request.recipientId);
  return {
    ...request,
    sender: sender ? toSafeUser(sender) : null,
    recipient: recipient ? toSafeUser(recipient) : null
  };
}


export function publicChallenge(challenge: Challenge, users: User[], entries: ChallengeEntry[]) {
  const host = users.find((user) => user.id === challenge.hostId);
  const challengeEntries = entries.filter((entry) => entry.challengeId === challenge.id);
  return {
    ...challenge,
    host: host ? toSafeUser(host) : null,
    entryCount: challengeEntries.length,
    voteCount: challengeEntries.reduce((sum, entry) => sum + entry.votes.length, 0),
    isActive: Date.parse(challenge.endsAt) > Date.now()
  };
}

export function publicChallengeEntry(entry: ChallengeEntry, users: User[], currentUserId?: string) {
  const author = users.find((user) => user.id === entry.authorId);
  return {
    ...entry,
    author: author ? toSafeUser(author) : null,
    voteCount: entry.votes.length,
    hasVoted: currentUserId ? entry.votes.includes(currentUserId) : false
  };
}


export function publicMarketplaceListing(listing: MarketplaceListing, users: User[], currentUserId?: string) {
  const seller = users.find((user) => user.id === listing.sellerId);
  return {
    ...listing,
    seller: seller ? toSafeUser(seller) : null,
    saveCount: listing.saves.length,
    isSaved: currentUserId ? listing.saves.includes(currentUserId) : false
  };
}

export function publicMarketplaceInquiry(inquiry: MarketplaceInquiry, users: User[], listings: MarketplaceListing[]) {
  const buyer = users.find((user) => user.id === inquiry.buyerId);
  const seller = users.find((user) => user.id === inquiry.sellerId);
  const listing = listings.find((item) => item.id === inquiry.listingId);
  return {
    ...inquiry,
    buyer: buyer ? toSafeUser(buyer) : null,
    seller: seller ? toSafeUser(seller) : null,
    listing: listing ? { id: listing.id, title: listing.title, price: listing.price, currency: listing.currency } : null
  };
}
