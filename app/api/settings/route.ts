import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toSafeUser, updateDb } from "@/lib/db";
import type { MessagePermission, PostVisibility } from "@/lib/types";
import { updateSettingsPrisma } from "@/lib/prisma-direct-users";
import { auditLog } from "@/lib/audit";
import { parseJson, settingsSchema } from "@/lib/validation";

export const runtime = "nodejs";

const VISIBILITY = new Set(["public", "followers", "friends", "only_me"]);
const MESSAGE_PERMISSIONS = new Set(["everyone", "friends", "none"]);

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view settings." }, { status: 401 });
  return NextResponse.json({ user: toSafeUser(user), settings: user.settings });
}

export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Sign in to update settings." }, { status: 401 });
  const parsed = await parseJson(request, settingsSchema);
  if ("response" in parsed) return parsed.response;
  const body = parsed.data;

  if (process.env.DATA_DRIVER !== "json") {
    const updated = await updateSettingsPrisma(currentUser, body);
    await auditLog({ actorId: currentUser.id, action: "settings.update", targetType: "user", targetId: currentUser.id, request });
    return NextResponse.json(updated);
  }

  const updated = await updateDb((db) => {
    const user = db.users.find((item) => item.id === currentUser.id);
    if (!user) return null;

    user.settings = {
      ...user.settings,
      defaultPostVisibility: body.defaultPostVisibility && VISIBILITY.has(body.defaultPostVisibility) ? (body.defaultPostVisibility as PostVisibility) : user.settings.defaultPostVisibility,
      allowMessagesFrom: body.allowMessagesFrom && MESSAGE_PERMISSIONS.has(body.allowMessagesFrom) ? (body.allowMessagesFrom as MessagePermission) : user.settings.allowMessagesFrom,
      profileDiscoverable: typeof body.profileDiscoverable === "boolean" ? body.profileDiscoverable : user.settings.profileDiscoverable,
      notifyLikes: typeof body.notifyLikes === "boolean" ? body.notifyLikes : user.settings.notifyLikes,
      notifyComments: typeof body.notifyComments === "boolean" ? body.notifyComments : user.settings.notifyComments,
      notifyFollows: typeof body.notifyFollows === "boolean" ? body.notifyFollows : user.settings.notifyFollows,
      notifyFriendRequests: typeof body.notifyFriendRequests === "boolean" ? body.notifyFriendRequests : user.settings.notifyFriendRequests,
      notifyMessages: typeof body.notifyMessages === "boolean" ? body.notifyMessages : user.settings.notifyMessages,
      notifyMentions: typeof body.notifyMentions === "boolean" ? body.notifyMentions : user.settings.notifyMentions,
      digestFrequency: ["off", "daily", "weekly"].includes((body as any).digestFrequency) ? (body as any).digestFrequency : user.settings.digestFrequency
    };

    return { user: toSafeUser(user), settings: user.settings };
  });

  if (!updated) return NextResponse.json({ error: "User not found." }, { status: 404 });
  await auditLog({ actorId: currentUser.id, action: "settings.update", targetType: "user", targetId: currentUser.id, request });
  return NextResponse.json(updated);
}
