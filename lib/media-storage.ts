import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { id, now, updateDb } from "./db";
import { prisma } from "./prisma";
import type { MediaAsset, User } from "./types";

export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

type StoredMedia = {
  url: string;
  filename: string;
  provider: MediaAsset["provider"];
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
};

function provider() {
  return (process.env.MEDIA_PROVIDER || "local").toLowerCase();
}

export function validateImageFile(file: File) {
  if (!ALLOWED_TYPES[file.type]) return "Only JPG, PNG, WebP, and GIF images are supported.";
  if (file.size > MAX_FILE_SIZE) return "Image must be 5MB or smaller.";
  return null;
}

async function storeLocal(file: File, user: User): Promise<StoredMedia> {
  const extension = ALLOWED_TYPES[file.type];
  const filename = `${user.id}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${extension}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  const uploadPath = path.join(uploadDir, filename);
  await fs.mkdir(uploadDir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(uploadPath, bytes);
  return { url: `/uploads/${filename}`, filename, provider: "local", size: file.size, mimeType: file.type };
}

async function storeCloudinary(file: File, user: User): Promise<StoredMedia> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) throw new Error("Cloudinary upload requires CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET.");

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", uploadPreset);
  form.append("folder", process.env.CLOUDINARY_FOLDER || `creator-connect/${user.id}`);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: form });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Cloudinary upload failed.");

  return {
    url: data.secure_url,
    filename: data.public_id,
    provider: "cloudinary",
    size: file.size,
    mimeType: file.type,
    width: data.width,
    height: data.height
  };
}

export async function storeMedia(file: File, user: User) {
  if (provider() === "cloudinary") return storeCloudinary(file, user);
  if (provider() === "s3") throw new Error("S3 media provider is scaffolded but not configured yet. Use MEDIA_PROVIDER=local or cloudinary.");
  return storeLocal(file, user);
}

export async function recordMediaAsset(user: User, media: StoredMedia) {
  const asset: MediaAsset = {
    id: id("media"),
    ownerId: user.id,
    url: media.url,
    provider: media.provider,
    filename: media.filename,
    mimeType: media.mimeType,
    size: media.size,
    width: media.width,
    height: media.height,
    createdAt: now()
  };

  if (process.env.DATA_DRIVER !== "json") {
    await prisma().mediaAsset.create({
      data: {
        id: asset.id,
        ownerId: asset.ownerId,
        url: asset.url,
        provider: asset.provider,
        filename: asset.filename,
        mimeType: asset.mimeType,
        size: asset.size,
        width: asset.width || null,
        height: asset.height || null,
        createdAt: new Date(asset.createdAt)
      }
    });
  } else {
    await updateDb((db) => {
      db.mediaAssets.push(asset);
      return asset;
    });
  }

  return asset;
}
