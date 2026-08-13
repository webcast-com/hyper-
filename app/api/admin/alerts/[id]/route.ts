import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { updateAdminAlert, type AlertStatus } from "@/lib/admin-alerts";

type Params = { params: Promise<{ id: string }> };
const STATUSES = new Set(["open", "acknowledged", "resolved"]);

export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!hasPermission(user, "admin:moderate")) return NextResponse.json({ error: "Moderation permission required." }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  const status = STATUSES.has(body.status) ? body.status as AlertStatus : null;
  if (!status) return NextResponse.json({ error: "Valid alert status is required." }, { status: 400 });
  const alert = await updateAdminAlert(id, status, user!.id, String(body.reason || "").slice(0, 500));
  if (!alert) return NextResponse.json({ error: "Alert not found." }, { status: 404 });
  return NextResponse.json({ alert });
}
