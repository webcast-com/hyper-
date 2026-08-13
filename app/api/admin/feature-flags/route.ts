import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { listFeatureFlags, setFeatureFlag } from "@/lib/feature-flags";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!hasPermission(user, "admin:system")) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  return NextResponse.json({ flags: await listFeatureFlags() });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!hasPermission(user, "admin:system")) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const body = await request.json();
  const key = String(body.key || "");
  if (!key || typeof body.enabled !== "boolean") return NextResponse.json({ error: "Feature key and enabled boolean are required." }, { status: 400 });
  const flag = await setFeatureFlag(key, body.enabled, user!.id, request).catch((err) => ({ error: err.message } as const));
  if ("error" in flag) return NextResponse.json({ error: flag.error }, { status: 400 });
  return NextResponse.json({ flag });
}
