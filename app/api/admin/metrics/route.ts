import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { currentAdminMetrics, listAdminMetricSnapshots } from "@/lib/admin-metrics";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!hasPermission(user, "admin:system")) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const limit = Number(new URL(request.url).searchParams.get("limit") || 30);
  const [current, history] = await Promise.all([currentAdminMetrics(), listAdminMetricSnapshots(limit)]);
  return NextResponse.json({ current, history });
}
