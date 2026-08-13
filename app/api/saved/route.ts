import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canViewPost, publicMarketplaceListing, publicPost, readDb } from "@/lib/db";
import { savedItemsPrisma } from "@/lib/prisma-direct-personal";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view saved items." }, { status: 401 });

  if (process.env.DATA_DRIVER !== "json") return NextResponse.json(await savedItemsPrisma(user));

  const db = await readDb();
  const me = db.users.find((candidate) => candidate.id === user.id);
  if (!me) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const savedPosts = me.savedPosts
    .map((postId) => db.posts.find((post) => post.id === postId))
    .filter((post) => post && canViewPost(post, me, db.users))
    .map((post) => publicPost(post!, db.users));

  const savedListings = db.marketplaceListings
    .filter((listing) => listing.active && listing.saves.includes(user.id))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((listing) => publicMarketplaceListing(listing, db.users, user.id));

  return NextResponse.json({ savedPosts, savedListings, counts: { posts: savedPosts.length, listings: savedListings.length } });
}
