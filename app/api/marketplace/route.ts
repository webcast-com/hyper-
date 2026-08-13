import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { id, now, publicMarketplaceListing, readDb, updateDb } from "@/lib/db";
import type { MarketplaceListingType } from "@/lib/types";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { createMarketplaceListingPrisma, listMarketplacePrisma } from "@/lib/prisma-direct-marketplace";
import { marketplaceCreateSchema, parseJson } from "@/lib/validation";
import { requireFeature } from "@/lib/feature-flags";
import { checkModeration, createModerationFlags } from "@/lib/moderation";

export const runtime = "nodejs";

const TYPES = new Set(["service", "digital_product", "collaboration"]);

export async function GET(request: Request) {
  const feature = await requireFeature("marketplace");
  if (feature) return NextResponse.json(feature, { status: 403 });
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const category = (searchParams.get("category") || "").trim().toLowerCase();
  const type = (searchParams.get("type") || "").trim().toLowerCase();
  const user = await getCurrentUser();
  if (process.env.DATA_DRIVER !== "json") return NextResponse.json(await listMarketplacePrisma({ q, category, type, currentUserId: user?.id }));

  const db = await readDb();
  const listings = db.marketplaceListings
    .filter((listing) => listing.active)
    .filter((listing) => !q || [listing.title, listing.description, listing.category, ...listing.tags].some((value) => value.toLowerCase().includes(q)))
    .filter((listing) => !category || listing.category.toLowerCase() === category)
    .filter((listing) => !type || listing.type === type)
    .sort((a, b) => b.saves.length - a.saves.length || Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((listing) => publicMarketplaceListing(listing, db.users, user?.id));

  const categories = Array.from(new Set(db.marketplaceListings.filter((listing) => listing.active).map((listing) => listing.category))).sort();

  return NextResponse.json({ listings, categories });
}

export async function POST(request: Request) {
  const feature = await requireFeature("marketplace");
  if (feature) return NextResponse.json(feature, { status: 403 });
  const limited = await rateLimit(request, "marketplace:create", 10, 60000);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429, headers: rateLimitHeaders(limited) });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to create marketplace listings." }, { status: 401 });

  const parsed = await parseJson(request, marketplaceCreateSchema);
  if ("response" in parsed) return parsed.response;
  const body = parsed.data;
  const title = body.title;
  const description = body.description;
  const type = TYPES.has(body.type) ? (body.type as MarketplaceListingType) : "service";
  const category = String(body.category || user.niche || "Creator").trim().slice(0, 50);
  const price = body.price;
  const currency = body.currency.toUpperCase().slice(0, 4);
  const imageUrl = body.imageUrl;
  const moderation = await checkModeration(`${title} ${description}`, "marketplace_listing");
  if (!moderation.allowed) return NextResponse.json({ error: "Listing blocked by moderation rules." }, { status: 400 });
  const tags = body.tags
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, "").toLowerCase())
    .filter(Boolean)
    .slice(0, 6);


  if (process.env.DATA_DRIVER !== "json") {
    const listing = await createMarketplaceListingPrisma({ seller: user, title, description, type, category, price, currency, imageUrl, tags });
    await createModerationFlags({ text: `${title} ${description}`, targetType: "marketplace_listing", targetId: listing.id, actorId: user.id });
  return NextResponse.json({ listing }, { status: 201 });
  }

  const listing = await updateDb((db) => {
    const created = {
      id: id("lst"),
      sellerId: user.id,
      title,
      description,
      type,
      category,
      price,
      currency,
      imageUrl,
      tags,
      saves: [],
      active: true,
      createdAt: now()
    };
    db.marketplaceListings.push(created);
    return publicMarketplaceListing(created, db.users, user.id);
  });

  await createModerationFlags({ text: `${title} ${description}`, targetType: "marketplace_listing", targetId: listing.id, actorId: user.id });
  return NextResponse.json({ listing }, { status: 201 });
}
