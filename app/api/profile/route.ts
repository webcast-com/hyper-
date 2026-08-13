import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toSafeUser, updateDb } from "@/lib/db";
import { updateProfilePrisma } from "@/lib/prisma-direct-users";
import { auditLog } from "@/lib/audit";
import { parseJson, profileSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Sign in to update profile." }, { status: 401 });
  const parsed = await parseJson(request, profileSchema);
  if ("response" in parsed) return parsed.response;
  const body = parsed.data;

  if (process.env.DATA_DRIVER !== "json") {
    const user = await updateProfilePrisma(currentUser, body);
    return NextResponse.json({ user });
  }

  const updated = await updateDb((db) => {
    const user = db.users.find((u) => u.id === currentUser.id);
    if (!user) return null;
    user.name = String(body.name ?? user.name).trim().slice(0, 60) || user.name;
    user.bio = String(body.bio ?? user.bio).trim().slice(0, 240);
    user.niche = String(body.niche ?? user.niche).trim().slice(0, 40) || "Creator";
    user.website = String(body.website ?? user.website ?? "").trim().slice(0, 120);
    user.avatar = String(body.avatar ?? user.avatar).trim() || user.avatar;
    return toSafeUser(user);
  });

  if (!updated) return NextResponse.json({ error: "User not found." }, { status: 404 });
  await auditLog({ actorId: currentUser.id, action: "profile.update", targetType: "user", targetId: currentUser.id, request });
  return NextResponse.json({ user: updated });
}
