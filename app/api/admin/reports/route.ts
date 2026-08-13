import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readDb, toSafeUser } from "@/lib/db";
import { adminReportsPrisma } from "@/lib/prisma-direct-admin";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

function publicReport(report: any, db: any) {
  const reporter = db.users.find((user: any) => user.id === report.reporterId);
  const targetUser = report.targetType === "user" ? db.users.find((user: any) => user.id === report.targetId) : null;
  const targetPost = report.targetType === "post" ? db.posts.find((post: any) => post.id === report.targetId) : null;
  const postAuthor = targetPost ? db.users.find((user: any) => user.id === targetPost.authorId) : null;
  return {
    ...report,
    reporter: reporter ? toSafeUser(reporter) : null,
    targetUser: targetUser ? toSafeUser(targetUser) : null,
    targetPost: targetPost ? { ...targetPost, author: postAuthor ? toSafeUser(postAuthor) : null } : null
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!hasPermission(user, "admin:read")) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "all";
  if (process.env.DATA_DRIVER !== "json") return NextResponse.json(await adminReportsPrisma(status));

  const db = await readDb();
  const reports = db.reports
    .filter((report) => status === "all" || report.status === status)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((report) => publicReport(report, db));

  const stats = {
    totalReports: db.reports.length,
    openReports: db.reports.filter((report) => report.status === "open").length,
    reviewedReports: db.reports.filter((report) => report.status === "reviewed").length,
    dismissedReports: db.reports.filter((report) => report.status === "dismissed").length,
    suspendedUsers: db.users.filter((candidate) => candidate.suspended).length,
    totalUsers: db.users.length,
    totalPosts: db.posts.length
  };

  return NextResponse.json({ reports, stats });
}
