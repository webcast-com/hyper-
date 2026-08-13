import { NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/auth-token-service";
import { auditLog } from "@/lib/audit";
import { parseJson, resetPasswordSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await parseJson(request, resetPasswordSchema);
  if ("response" in parsed) return parsed.response;
  const { token, password } = parsed.data;
  const userId = token ? await resetPasswordWithToken(token, password) : null;
  if (!userId) return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 });
  await auditLog({ actorId: userId, action: "auth.password_reset_completed", targetType: "user", targetId: userId, request });
  return NextResponse.json({ ok: true });
}
