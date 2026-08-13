import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { publicPost, readDb } from "@/lib/db";
import { analyticsPrisma } from "@/lib/prisma-direct-admin";

export const runtime = "nodejs";

function reactionCount(post: { reactions?: Record<string, string[] | undefined> }) {
  return Object.values(post.reactions || {}).reduce((sum, users) => sum + (users?.length || 0), 0);
}

function engagementScore(post: { likes: string[]; comments: unknown[]; shares?: number; reactions?: Record<string, string[] | undefined> }) {
  return post.likes.length + reactionCount(post) + post.comments.length * 2 + (post.shares || 0) * 3;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view analytics." }, { status: 401 });
  if (process.env.DATA_DRIVER !== "json") return NextResponse.json(await analyticsPrisma(user));

  const db = await readDb();
  const myPosts = db.posts
    .filter((post) => post.authorId === user.id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const totalLikes = myPosts.reduce((sum, post) => sum + post.likes.length, 0);
  const totalComments = myPosts.reduce((sum, post) => sum + post.comments.length, 0);
  const totalShares = myPosts.reduce((sum, post) => sum + (post.shares || 0), 0);
  const totalReactions = myPosts.reduce((sum, post) => sum + reactionCount(post), 0);
  const totalEngagement = myPosts.reduce((sum, post) => sum + engagementScore(post), 0);
  const averageEngagement = myPosts.length ? Number((totalEngagement / myPosts.length).toFixed(1)) : 0;

  const topPosts = myPosts
    .slice()
    .sort((a, b) => engagementScore(b) - engagementScore(a))
    .slice(0, 5)
    .map((post) => ({ ...publicPost(post, db.users), engagementScore: engagementScore(post) }));

  const tagMap = new Map<string, { tag: string; posts: number; engagement: number }>();
  myPosts.forEach((post) => {
    post.tags.forEach((tag) => {
      const current = tagMap.get(tag) || { tag, posts: 0, engagement: 0 };
      current.posts += 1;
      current.engagement += engagementScore(post);
      tagMap.set(tag, current);
    });
  });

  const tagPerformance = Array.from(tagMap.values())
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 8);

  const badges = [
    { id: "first-post", label: "First Post", description: "Published your first post", earned: myPosts.length >= 1 },
    { id: "five-posts", label: "Consistent Creator", description: "Published 5 posts", earned: myPosts.length >= 5 },
    { id: "ten-followers", label: "Growing Audience", description: "Reached 10 followers", earned: user.followers.length >= 10 },
    { id: "social", label: "Social Connector", description: "Made 3 friends", earned: user.friends.length >= 3 },
    { id: "engaged", label: "Conversation Starter", description: "Received 10 comments", earned: totalComments >= 10 },
    { id: "shareworthy", label: "Shareworthy", description: "Received 5 shares", earned: totalShares >= 5 },
    { id: "reaction-magnet", label: "Reaction Magnet", description: "Received 15 reactions/likes", earned: totalLikes + totalReactions >= 15 }
  ];

  const accountHealth = {
    profileComplete: Boolean(user.bio && user.avatar && user.niche && user.website),
    hasPosted: myPosts.length > 0,
    hasFriends: user.friends.length > 0,
    hasFollowers: user.followers.length > 0,
    safetyConfigured: user.blockedUsers.length > 0 || user.mutedUsers.length > 0
  };

  return NextResponse.json({
    summary: {
      posts: myPosts.length,
      followers: user.followers.length,
      following: user.following.length,
      friends: user.friends.length,
      totalLikes,
      totalComments,
      totalShares,
      totalReactions,
      totalEngagement,
      averageEngagement,
      estimatedReach: user.followers.length * Math.max(myPosts.length, 1) + totalShares * 12 + totalEngagement * 2
    },
    topPosts,
    tagPerformance,
    badges,
    accountHealth
  });
}
