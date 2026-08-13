import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { listNotificationDigests } from "@/lib/digests";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!hasPermission(user, "admin:system")) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const limit = Number(new URL(request.url).searchParams.get("limit") || 100);
  return NextResponse.json({ digests: await listNotificationDigests(limit) });
}
