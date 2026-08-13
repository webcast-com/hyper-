import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { auditLog, listAuditLogs } from "@/lib/audit";
import { readDb } from "@/lib/db";
import { hasPermission, hasRole } from "@/lib/permissions";

export const runtime = "nodejs";

function hasCronSecret(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("x-cron-secret") === secret || new URL(request.url).searchParams.get("secret") === secret;
}

function redactSecrets(snapshot: any) {
  return {
    ...snapshot,
    users: (snapshot.users || []).map((user: any) => ({ ...user, passwordHash: "[redacted]" })),
    authTokens: []
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const cronAccess = hasCronSecret(request);
  if (!cronAccess && !hasPermission(user, "admin:system")) {
    return NextResponse.json({ error: "Admin or cron access required." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const includeSecrets = searchParams.get("includeSecrets") === "true";
  if (includeSecrets && !cronAccess && !hasRole(user, "owner")) {
    return NextResponse.json({ error: "Owner role or cron secret required for secret-bearing exports." }, { status: 403 });
  }

  const snapshot: any = await readDb();
  snapshot.auditLogs = await listAuditLogs({ limit: 10_000 });
  snapshot.exportedAt = new Date().toISOString();
  snapshot.exportVersion = 1;

  await auditLog({ actorId: user?.id, action: "admin.data_export", targetType: "system", metadata: { includeSecrets, cronAccess }, request });

  return NextResponse.json(includeSecrets ? snapshot : redactSecrets(snapshot));
}
