import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toSafeUser, updateDb } from "@/lib/db";
import { toggleSuspendUserPrisma } from "@/lib/prisma-direct-admin";
import { auditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const admin = await getCurrentUser();
  if (!hasPermission(admin, "admin:suspend")) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reason = String(body.reason || "").trim().slice(0, 500);
  if (id === admin!.id) return NextResponse.json({ error: "You cannot suspend your own admin account." }, { status: 400 });

  if (process.env.DATA_DRIVER !== "json") {
    const result = await toggleSuspendUserPrisma(admin!.id, id).catch((err) => ({ error: err.message } as const));
    if (!result) return NextResponse.json({ error: "User not found." }, { status: 404 });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ user: result });
  }

  const result = await updateDb((db) => {
    const user = db.users.find((candidate) => candidate.id === id);
    if (!user) return null;
    user.suspended = !user.suspended;
    return toSafeUser(user);
  });

  if (!result) return NextResponse.json({ error: "User not found." }, { status: 404 });
  await auditLog({ actorId: admin!.id, action: "admin.user_suspend_toggle", targetType: "user", targetId: id, metadata: { suspended: result.suspended, reason }, request });
  return NextResponse.json({ user: result });
}
