import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { id, now, updateDb } from "@/lib/db";
import { createReportPrisma, listReportsPrisma } from "@/lib/prisma-direct-admin";
import { parseJson, reportSchema } from "@/lib/validation";
import { emitWebhook } from "@/lib/webhooks";
import type { ReportReason } from "@/lib/types";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

export const runtime = "nodejs";

const REASONS = new Set(["spam", "harassment", "nudity", "hate", "other"]);

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view reports." }, { status: 401 });

  if (process.env.DATA_DRIVER !== "json") {
    const reports = await listReportsPrisma(user.id);
    return NextResponse.json({ reports });
  }

  const reports = await updateDb((db) => db.reports.filter((report) => report.reporterId === user.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
  return NextResponse.json({ reports });
}

export async function POST(request: Request) {
  const limited = await rateLimit(request, "reports:create", 10, 60000);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429, headers: rateLimitHeaders(limited) });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to report content." }, { status: 401 });

  const parsed = await parseJson(request, reportSchema);
  if ("response" in parsed) return parsed.response;
  const { targetType, targetId, reason, details } = parsed.data;

  if (process.env.DATA_DRIVER !== "json") {
    const report = await createReportPrisma({ reporterId: user.id, targetType, targetId, reason, details });
    if (!report) return NextResponse.json({ error: "Reported item not found." }, { status: 404 });
    return NextResponse.json({ report }, { status: 201 });
  }

  const report = await updateDb((db) => {
    const targetExists = targetType === "post" ? db.posts.some((post) => post.id === targetId) : db.users.some((candidate) => candidate.id === targetId);
    if (!targetExists) return null;
    const created = { id: id("report"), reporterId: user.id, targetType, targetId, reason, details, status: "open" as const, createdAt: now() };
    db.reports.push(created);
    return created;
  });

  if (!report) return NextResponse.json({ error: "Reported item not found." }, { status: 404 });
  await emitWebhook({ event: "report.created", actorId: user.id, payload: { reportId: report.id, targetType, targetId, reason } });
  await auditLog({ actorId: user.id, action: "report.create", targetType, targetId, metadata: { reason }, request });
  return NextResponse.json({ report }, { status: 201 });
}
