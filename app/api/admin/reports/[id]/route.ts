import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { updateDb } from "@/lib/db";
import type { ReportStatus } from "@/lib/types";
import { updateReportStatusPrisma } from "@/lib/prisma-direct-admin";
import { auditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

const STATUSES = new Set(["open", "reviewed", "dismissed"]);

export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!hasPermission(user, "admin:moderate")) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const status = STATUSES.has(body.status) ? (body.status as ReportStatus) : null;
  const reason = String(body.reason || "").trim().slice(0, 500);
  if (!status) return NextResponse.json({ error: "Valid status is required." }, { status: 400 });

  if (process.env.DATA_DRIVER !== "json") {
    const report = await updateReportStatusPrisma(id, status);
    if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    return NextResponse.json({ report });
  }

  const report = await updateDb((db) => {
    const found = db.reports.find((item) => item.id === id);
    if (!found) return null;
    found.status = status;
    return found;
  });

  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  await auditLog({ actorId: user!.id, action: "admin.report_status", targetType: "report", targetId: id, metadata: { status, reason }, request });
  return NextResponse.json({ report });
}
