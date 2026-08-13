import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { publicMarketplaceListing, updateDb } from "@/lib/db";
import { toggleMarketplaceSavePrisma } from "@/lib/prisma-direct-marketplace";
import { requireFeature } from "@/lib/feature-flags";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const feature = await requireFeature("marketplace");
  if (feature) return NextResponse.json(feature, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to save listings." }, { status: 401 });
  const { id } = await params;

  if (process.env.DATA_DRIVER !== "json") {
    const listing = await toggleMarketplaceSavePrisma(id, user.id);
    if (!listing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    return NextResponse.json({ listing });
  }

  const listing = await updateDb((db) => {
    const found = db.marketplaceListings.find((item) => item.id === id && item.active);
    if (!found) return null;
    if (found.saves.includes(user.id)) found.saves = found.saves.filter((userId) => userId !== user.id);
    else found.saves.push(user.id);
    return publicMarketplaceListing(found, db.users, user.id);
  });

  if (!listing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  return NextResponse.json({ listing });
}
