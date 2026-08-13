import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { listModerationRules, upsertModerationRule } from "@/lib/moderation";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!hasPermission(user, "admin:moderate")) return NextResponse.json({ error: "Moderation permission required." }, { status: 403 });
  return NextResponse.json({ rules: await listModerationRules() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!hasPermission(user, "admin:moderate")) return NextResponse.json({ error: "Moderation permission required." }, { status: 403 });
  const body = await request.json();
  const phrase = String(body.phrase || "").trim();
  if (!phrase) return NextResponse.json({ error: "Phrase is required." }, { status: 400 });
  const action = body.action === "block" ? "block" : "flag";
  const targetTypes = Array.isArray(body.targetTypes) ? body.targetTypes.map(String) : [];
  const rule = await upsertModerationRule({ id: body.id ? String(body.id) : undefined, phrase, action, targetTypes, active: body.active !== false, actorId: user!.id });
  return NextResponse.json({ rule }, { status: body.id ? 200 : 201 });
}
