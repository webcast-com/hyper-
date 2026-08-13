import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { recordMediaAsset, storeMedia, validateImageFile } from "@/lib/media-storage";
import { auditLog } from "@/lib/audit";
import { requireFeature } from "@/lib/feature-flags";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const feature = await requireFeature("media_uploads");
  if (feature) return NextResponse.json(feature, { status: 403 });
  const limited = await rateLimit(request, "uploads:create", 12, 60000);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429, headers: rateLimitHeaders(limited) });
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to upload media." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  const validationError = validateImageFile(file);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const media = await storeMedia(file, user).catch((err) => ({ error: err.message } as const));
  if ("error" in media) return NextResponse.json({ error: media.error }, { status: 400 });

  const asset = await recordMediaAsset(user, media);
  await auditLog({ actorId: user.id, action: "media.upload", targetType: "media", targetId: asset.id, metadata: { provider: asset.provider, size: asset.size, mimeType: asset.mimeType }, request });

  return NextResponse.json({
    url: asset.url,
    filename: asset.filename,
    size: asset.size,
    type: asset.mimeType,
    provider: asset.provider,
    asset
  }, { status: 201 });
}
