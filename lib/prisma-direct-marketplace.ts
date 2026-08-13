import { id } from "./db";
import { prisma } from "./prisma";
import { prismaUserToUser } from "./prisma-direct-auth";
import type { MarketplaceListing, MarketplaceListingType, User } from "./types";

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

function mapListing(listing: any): MarketplaceListing {
  return {
    id: listing.id,
    sellerId: listing.sellerId,
    title: listing.title,
    description: listing.description,
    type: listing.type as MarketplaceListingType,
    category: listing.category,
    price: listing.price,
    currency: listing.currency,
    imageUrl: listing.imageUrl || "",
    tags: parse<string[]>(listing.tags, []),
    saves: parse<string[]>(listing.saves, []),
    active: listing.active,
    createdAt: iso(listing.createdAt)
  };
}

function publicListing(listing: MarketplaceListing, users: User[], currentUserId?: string) {
  const seller = users.find((user) => user.id === listing.sellerId);
  return {
    ...listing,
    seller: seller ? toSafeUser(seller) : null,
    saveCount: listing.saves.length,
    isSaved: currentUserId ? listing.saves.includes(currentUserId) : false
  };
}

function publicInquiry(inquiry: any, buyer: User | null, seller: User | null, listing: MarketplaceListing | null) {
  return {
    id: inquiry.id,
    listingId: inquiry.listingId,
    buyerId: inquiry.buyerId,
    sellerId: inquiry.sellerId,
    message: inquiry.message,
    status: inquiry.status,
    createdAt: iso(inquiry.createdAt),
    buyer: buyer ? toSafeUser(buyer) : null,
    seller: seller ? toSafeUser(seller) : null,
    listing: listing ? { id: listing.id, title: listing.title, price: listing.price, currency: listing.currency } : null
  };
}

export async function listMarketplacePrisma({ q, category, type, currentUserId }: { q: string; category: string; type: string; currentUserId?: string }) {
  const db = prisma();
  const rawListings = await db.marketplaceListing.findMany({
    where: {
      active: true,
      ...(type ? { type } : {}),
      ...(category ? { category: { equals: category } } : {})
    },
    orderBy: [{ createdAt: "desc" }],
    take: 200
  });

  let listings = rawListings.map(mapListing);
  if (q) {
    const clean = q.toLowerCase();
    listings = listings.filter((listing) => [listing.title, listing.description, listing.category, ...listing.tags].some((value) => value.toLowerCase().includes(clean)));
  }
  listings.sort((a, b) => b.saves.length - a.saves.length || Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const sellerIds = Array.from(new Set(listings.map((listing) => listing.sellerId)));
  const users = sellerIds.length ? (await db.user.findMany({ where: { id: { in: sellerIds } } })).map(prismaUserToUser) : [];

  const rawCategories = await db.marketplaceListing.findMany({ where: { active: true }, select: { category: true } });
  const categories = Array.from(new Set(rawCategories.map((item) => item.category))).sort();

  return { listings: listings.map((listing) => publicListing(listing, users, currentUserId)), categories };
}

export async function createMarketplaceListingPrisma(input: {
  seller: User;
  title: string;
  description: string;
  type: MarketplaceListingType;
  category: string;
  price: number;
  currency: string;
  imageUrl: string;
  tags: string[];
}) {
  const created = await prisma().marketplaceListing.create({
    data: {
      id: id("lst"),
      sellerId: input.seller.id,
      title: input.title,
      description: input.description,
      type: input.type,
      category: input.category,
      price: input.price,
      currency: input.currency,
      imageUrl: input.imageUrl || null,
      tags: json(input.tags, []),
      saves: "[]",
      active: true
    }
  });
  return publicListing(mapListing(created), [input.seller], input.seller.id);
}

export async function toggleMarketplaceSavePrisma(listingId: string, userId: string) {
  const db = prisma();
  const listing = await db.marketplaceListing.findFirst({ where: { id: listingId, active: true } });
  if (!listing) return null;
  const saves = parse<string[]>(listing.saves, []);
  const nextSaves = saves.includes(userId) ? saves.filter((id) => id !== userId) : [...saves, userId];
  const updated = await db.marketplaceListing.update({ where: { id: listingId }, data: { saves: json(nextSaves, []) } });
  const seller = await db.user.findUnique({ where: { id: updated.sellerId } });
  const users = seller ? [prismaUserToUser(seller)] : [];
  return publicListing(mapListing(updated), users, userId);
}

export async function inquireMarketplacePrisma({ listingId, buyer, message }: { listingId: string; buyer: User; message: string }) {
  const db = prisma();
  const listingRaw = await db.marketplaceListing.findFirst({ where: { id: listingId, active: true } });
  if (!listingRaw) return null;
  const listing = mapListing(listingRaw);
  if (listing.sellerId === buyer.id) throw new Error("You cannot inquire about your own listing.");

  const sellerRaw = await db.user.findUnique({ where: { id: listing.sellerId } });
  if (!sellerRaw) return null;
  const seller = prismaUserToUser(sellerRaw);

  const createdInquiry = await db.$transaction(async (tx) => {
    const inquiry = await tx.marketplaceInquiry.create({
      data: { id: id("inq"), listingId, buyerId: buyer.id, sellerId: seller.id, message, status: "open" }
    });

    const rawConversations = await tx.conversation.findMany({
      where: { AND: [{ participantIds: { contains: buyer.id } }, { participantIds: { contains: seller.id } }] }
    });
    let conversation = rawConversations.find((item) => {
      const participants = parse<string[]>(item.participantIds, []);
      return participants.includes(buyer.id) && participants.includes(seller.id);
    });

    const now = new Date();
    if (!conversation) {
      conversation = await tx.conversation.create({
        data: { id: id("conv"), participantIds: json([buyer.id, seller.id], []), createdAt: now, updatedAt: now }
      });
    }

    await tx.message.create({
      data: {
        id: id("msg"),
        conversationId: conversation.id,
        senderId: buyer.id,
        recipientId: seller.id,
        text: `Marketplace inquiry for “${listing.title}”: ${message}`,
        read: false,
        createdAt: now
      }
    });
    await tx.conversation.update({ where: { id: conversation.id }, data: { updatedAt: now } });
    if (seller.settings.notifyMessages) {
      await tx.notification.create({ data: { id: id("notif"), recipientId: seller.id, actorId: buyer.id, type: "message", read: false, createdAt: now } });
    }
    return inquiry;
  });

  return publicInquiry(createdInquiry, buyer, seller, listing);
}
