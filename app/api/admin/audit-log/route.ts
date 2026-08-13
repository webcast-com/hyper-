import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listAuditLogs } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!hasPermission(user, "admin:audit")) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "all";
  const limit = Number(searchParams.get("limit") || 100);
  const logs = await listAuditLogs({ action, limit });
  const actions = Array.from(new Set(logs.map((log: any) => log.action))).sort();
  return NextResponse.json({ logs, actions });
}
