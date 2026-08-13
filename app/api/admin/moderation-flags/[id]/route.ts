import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { updateModerationFlag } from "@/lib/moderation";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!hasPermission(user, "admin:moderate")) return NextResponse.json({ error: "Moderation permission required." }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  const status = ["open", "reviewed", "dismissed"].includes(body.status) ? body.status : null;
  const reason = String(body.reason || "").trim().slice(0, 500);
  if (!status) return NextResponse.json({ error: "Valid status is required." }, { status: 400 });
  const flag = await updateModerationFlag(id, status, user!.id, reason);
  if (!flag) return NextResponse.json({ error: "Moderation flag not found." }, { status: 404 });
  return NextResponse.json({ flag });
}
