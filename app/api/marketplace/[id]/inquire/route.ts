import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addNotification, id, now, publicMarketplaceInquiry, updateDb } from "@/lib/db";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { inquireMarketplacePrisma } from "@/lib/prisma-direct-marketplace";
import { marketplaceInquirySchema, parseJson } from "@/lib/validation";
import { emitWebhook } from "@/lib/webhooks";
import { requireFeature } from "@/lib/feature-flags";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const feature = await requireFeature("marketplace");
  if (feature) return NextResponse.json(feature, { status: 403 });
  const limited = await rateLimit(request, "marketplace:inquire", 20, 60000);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429, headers: rateLimitHeaders(limited) });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to inquire about listings." }, { status: 401 });
  const { id: listingId } = await params;
  const parsed = await parseJson(request, marketplaceInquirySchema);
  if ("response" in parsed) return parsed.response;
  const { message } = parsed.data;

  if (process.env.DATA_DRIVER !== "json") {
    const inquiry = await inquireMarketplacePrisma({ listingId, buyer: user, message }).catch((err) => ({ error: err.message } as const));
    if (!inquiry) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    if ("error" in inquiry) return NextResponse.json({ error: inquiry.error }, { status: 400 });
    await emitWebhook({ event: "marketplace.inquiry", actorId: user.id, payload: { listingId, inquiryId: inquiry.id } });
  return NextResponse.json({ inquiry }, { status: 201 });
  }

  const inquiry = await updateDb((db) => {
    const listing = db.marketplaceListings.find((item) => item.id === listingId && item.active);
    if (!listing) return null;
    if (listing.sellerId === user.id) throw new Error("You cannot inquire about your own listing.");
    const created = { id: id("inq"), listingId, buyerId: user.id, sellerId: listing.sellerId, message, status: "open" as const, createdAt: now() };
    db.marketplaceInquiries.push(created);

    let conversation = db.conversations.find((item) => item.participantIds.includes(user.id) && item.participantIds.includes(listing.sellerId));
    if (!conversation) {
      conversation = { id: id("conv"), participantIds: [user.id, listing.sellerId], messages: [], createdAt: now(), updatedAt: now() };
      db.conversations.push(conversation);
    }
    conversation.messages.push({ id: id("msg"), senderId: user.id, recipientId: listing.sellerId, text: `Marketplace inquiry for “${listing.title}”: ${message}`, read: false, createdAt: now() });
    conversation.updatedAt = now();
    addNotification(db, { recipientId: listing.sellerId, actorId: user.id, type: "message" });
    return publicMarketplaceInquiry(created, db.users, db.marketplaceListings);
  }).catch((err) => ({ error: err.message } as const));

  if (!inquiry) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  if ("error" in inquiry) return NextResponse.json({ error: inquiry.error }, { status: 400 });
  await emitWebhook({ event: "marketplace.inquiry", actorId: user.id, payload: { listingId, inquiryId: inquiry.id } });
  return NextResponse.json({ inquiry }, { status: 201 });
}
