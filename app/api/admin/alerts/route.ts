import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { listAdminAlerts } from "@/lib/admin-alerts";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!hasPermission(user, "admin:read")) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "open";
  const limit = Number(searchParams.get("limit") || 100);
  return NextResponse.json({ alerts: await listAdminAlerts(status, limit) });
}
