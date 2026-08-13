import { NextResponse } from "next/server";
import { publicEvent, publicGroup, publicPost, readDb, toSafeUser } from "@/lib/db";
import { explorePrisma } from "@/lib/prisma-direct-discovery";

export const runtime = "nodejs";

function scorePost(post: { likes: string[]; comments: unknown[]; shares?: number; reactions?: Record<string, string[] | undefined>; createdAt: string }) {
  const reactionCount = Object.values(post.reactions || {}).reduce((sum, users) => sum + (users?.length || 0), 0);
  const engagement = post.likes.length + post.comments.length * 2 + (post.shares || 0) * 3 + reactionCount;
  const ageHours = Math.max((Date.now() - Date.parse(post.createdAt)) / 36e5, 1);
  return engagement / Math.pow(ageHours, 0.45);
}

export async function GET() {
  if (process.env.DATA_DRIVER !== "json") return NextResponse.json(await explorePrisma());

  const db = await readDb();

  const publicPosts = db.posts.filter((post) => (post.visibility || "public") === "public");

  const trendingPosts = publicPosts
    .slice()
    .sort((a, b) => scorePost(b) - scorePost(a))
    .slice(0, 12)
    .map((post) => ({ ...publicPost(post, db.users), trendScore: Number(scorePost(post).toFixed(2)) }));

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

  const trendingTags = Array.from(tagMap.values())
    .sort((a, b) => b.posts + b.engagement - (a.posts + a.engagement))
    .slice(0, 12);

  const suggestedCreators = db.users
    .slice()
    .sort((a, b) => b.followers.length + b.friends.length - (a.followers.length + a.friends.length))
    .slice(0, 10)
    .map(toSafeUser);

  const popularGroups = db.groups
    .slice()
    .sort((a, b) => b.memberIds.length - a.memberIds.length)
    .slice(0, 6)
    .map((group) => publicGroup(group, db.users));

  const upcomingEvents = db.events
    .slice()
    .filter((event) => Date.parse(event.startsAt) > Date.now())
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, 6)
    .map((event) => publicEvent(event, db.users));

  return NextResponse.json({ trendingPosts, trendingTags, suggestedCreators, popularGroups, upcomingEvents });
}
