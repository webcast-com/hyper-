import { NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/auth-token-service";
import { auditLog } from "@/lib/audit";
import { parseJson, verifyEmailSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await parseJson(request, verifyEmailSchema);
  if ("response" in parsed) return parsed.response;
  const { token } = parsed.data;
  const userId = token ? await verifyEmailToken(token) : null;
  if (!userId) return NextResponse.json({ error: "Invalid or expired verification link." }, { status: 400 });
  await auditLog({ actorId: userId, action: "auth.email_verified", targetType: "user", targetId: userId, request });
  return NextResponse.json({ ok: true });
}
