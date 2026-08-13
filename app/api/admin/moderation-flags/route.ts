import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { listModerationFlags } from "@/lib/moderation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!hasPermission(user, "admin:moderate")) return NextResponse.json({ error: "Moderation permission required." }, { status: 403 });
  const status = new URL(request.url).searchParams.get("status") || "open";
  return NextResponse.json({ flags: await listModerationFlags(status) });
}
