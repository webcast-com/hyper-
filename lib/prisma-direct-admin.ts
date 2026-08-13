import { id } from "./db";
import { prisma } from "./prisma";
import { prismaUserToUser } from "./prisma-direct-auth";
import type { ReportReason, ReportStatus, User, Post } from "./types";

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
  return { id: post.id, authorId: post.authorId, groupId: post.groupId || undefined, eventId: post.eventId || undefined, body: post.body, imageUrl: post.imageUrl || "", poll: post.poll ? parse(post.poll, undefined) : undefined, tags: parse<string[]>(post.tags, []), visibility: post.visibility || "public", likes: parse<string[]>(post.likes, []), reactions: parse(post.reactions, {}), shares: post.shares || 0, comments: (post.comments || []).map((c: any) => ({ id: c.id, userId: c.userId, text: c.text, parentId: c.parentId || undefined, likes: parse<string[]>(c.likes, []), createdAt: iso(c.createdAt) })), createdAt: iso(post.createdAt) };
}
function reactionCount(post: Post) { return Object.values(post.reactions || {}).reduce((sum, users) => sum + (users?.length || 0), 0); }
function engagementScore(post: Post) { return post.likes.length + reactionCount(post) + post.comments.length * 2 + (post.shares || 0) * 3; }
function publicReport(report: any, users: User[], post?: Post | null) {
  const reporter = users.find((user) => user.id === report.reporterId);
  const targetUser = report.targetType === "user" ? users.find((user) => user.id === report.targetId) : null;
  const postAuthor = post ? users.find((user) => user.id === post.authorId) : null;
  return { id: report.id, reporterId: report.reporterId, targetType: report.targetType, targetId: report.targetId, reason: report.reason, details: report.details, status: report.status, createdAt: iso(report.createdAt), reporter: reporter ? toSafeUser(reporter) : null, targetUser: targetUser ? toSafeUser(targetUser) : null, targetPost: post ? { ...post, author: postAuthor ? toSafeUser(postAuthor) : null } : null };
}

export async function analyticsPrisma(user: User) {
  const db = prisma();
  const [rawPosts, rawUsers] = await Promise.all([
    db.post.findMany({ where: { authorId: user.id }, include: { comments: true }, orderBy: { createdAt: "desc" }, take: 500 }),
    db.user.findMany({ take: 300 })
  ]);
  const users = rawUsers.map(prismaUserToUser);
  const myPosts = rawPosts.map(mapPost);
  const totalLikes = myPosts.reduce((sum, post) => sum + post.likes.length, 0);
  const totalComments = myPosts.reduce((sum, post) => sum + post.comments.length, 0);
  const totalShares = myPosts.reduce((sum, post) => sum + (post.shares || 0), 0);
  const totalReactions = myPosts.reduce((sum, post) => sum + reactionCount(post), 0);
  const totalEngagement = myPosts.reduce((sum, post) => sum + engagementScore(post), 0);
  const averageEngagement = myPosts.length ? Number((totalEngagement / myPosts.length).toFixed(1)) : 0;
  const topPosts = myPosts.slice().sort((a, b) => engagementScore(b) - engagementScore(a)).slice(0, 5).map((post) => ({ ...post, author: toSafeUser(user), comments: post.comments.map((comment) => ({ ...comment, author: users.find((u) => u.id === comment.userId) ? toSafeUser(users.find((u) => u.id === comment.userId)!) : null })), engagementScore: engagementScore(post) }));
  const tagMap = new Map<string, { tag: string; posts: number; engagement: number }>();
  myPosts.forEach((post) => post.tags.forEach((tag) => { const current = tagMap.get(tag) || { tag, posts: 0, engagement: 0 }; current.posts += 1; current.engagement += engagementScore(post); tagMap.set(tag, current); }));
  const tagPerformance = Array.from(tagMap.values()).sort((a, b) => b.engagement - a.engagement).slice(0, 8);
  const badges = [
    { id: "first-post", label: "First Post", description: "Published your first post", earned: myPosts.length >= 1 },
    { id: "five-posts", label: "Consistent Creator", description: "Published 5 posts", earned: myPosts.length >= 5 },
    { id: "ten-followers", label: "Growing Audience", description: "Reached 10 followers", earned: user.followers.length >= 10 },
    { id: "social", label: "Social Connector", description: "Made 3 friends", earned: user.friends.length >= 3 },
    { id: "engaged", label: "Conversation Starter", description: "Received 10 comments", earned: totalComments >= 10 },
    { id: "shareworthy", label: "Shareworthy", description: "Received 5 shares", earned: totalShares >= 5 },
    { id: "reaction-magnet", label: "Reaction Magnet", description: "Received 15 reactions/likes", earned: totalLikes + totalReactions >= 15 }
  ];
  const accountHealth = { profileComplete: Boolean(user.bio && user.avatar && user.niche && user.website), hasPosted: myPosts.length > 0, hasFriends: user.friends.length > 0, hasFollowers: user.followers.length > 0, safetyConfigured: user.blockedUsers.length > 0 || user.mutedUsers.length > 0 };
  return { summary: { posts: myPosts.length, followers: user.followers.length, following: user.following.length, friends: user.friends.length, totalLikes, totalComments, totalShares, totalReactions, totalEngagement, averageEngagement, estimatedReach: user.followers.length * Math.max(myPosts.length, 1) + totalShares * 12 + totalEngagement * 2 }, topPosts, tagPerformance, badges, accountHealth };
}

export async function listReportsPrisma(userId: string) {
  const reports = await prisma().report.findMany({ where: { reporterId: userId }, orderBy: { createdAt: "desc" } });
  return reports.map((report) => ({ id: report.id, reporterId: report.reporterId, targetType: report.targetType, targetId: report.targetId, reason: report.reason, details: report.details, status: report.status, createdAt: iso(report.createdAt) }));
}
export async function createReportPrisma(input: { reporterId: string; targetType: "post" | "user"; targetId: string; reason: ReportReason; details: string }) {
  const db = prisma();
  const targetExists = input.targetType === "post" ? await db.post.findUnique({ where: { id: input.targetId }, select: { id: true } }) : await db.user.findUnique({ where: { id: input.targetId }, select: { id: true } });
  if (!targetExists) return null;
  const report = await db.report.create({ data: { id: id("report"), reporterId: input.reporterId, targetType: input.targetType, targetId: input.targetId, reason: input.reason, details: input.details, status: "open" } });
  return { id: report.id, reporterId: report.reporterId, targetType: report.targetType, targetId: report.targetId, reason: report.reason, details: report.details, status: report.status, createdAt: iso(report.createdAt) };
}
export async function adminReportsPrisma(status: string) {
  const db = prisma();
  const [rawReports, rawUsers, rawPosts, stats] = await Promise.all([
    db.report.findMany({ where: status === "all" ? {} : { status }, orderBy: { createdAt: "desc" }, take: 500 }),
    db.user.findMany({ take: 500 }),
    db.post.findMany({ include: { comments: true }, take: 500 }),
    Promise.all([db.report.count(), db.report.count({ where: { status: "open" } }), db.report.count({ where: { status: "reviewed" } }), db.report.count({ where: { status: "dismissed" } }), db.user.count({ where: { suspended: true } }), db.user.count(), db.post.count()])
  ]);
  const users = rawUsers.map(prismaUserToUser);
  const posts = rawPosts.map(mapPost);
  const reports = rawReports.map((report) => publicReport(report, users, report.targetType === "post" ? posts.find((post) => post.id === report.targetId) : null));
  return { reports, stats: { totalReports: stats[0], openReports: stats[1], reviewedReports: stats[2], dismissedReports: stats[3], suspendedUsers: stats[4], totalUsers: stats[5], totalPosts: stats[6] } };
}
export async function updateReportStatusPrisma(reportId: string, status: ReportStatus) {
  const report = await prisma().report.update({ where: { id: reportId }, data: { status } }).catch(() => null);
  return report ? { id: report.id, reporterId: report.reporterId, targetType: report.targetType, targetId: report.targetId, reason: report.reason, details: report.details, status: report.status, createdAt: iso(report.createdAt) } : null;
}
export async function toggleSuspendUserPrisma(adminId: string, userId: string) {
  if (adminId === userId) throw new Error("You cannot suspend your own admin account.");
  const user = await prisma().user.findUnique({ where: { id: userId } });
  if (!user) return null;
  const updated = await prisma().user.update({ where: { id: userId }, data: { suspended: !user.suspended } });
  return toSafeUser(prismaUserToUser(updated));
}
