import { NextResponse } from "next/server";
import { createAuthToken } from "@/lib/auth-token-service";
import { sendPasswordResetEmail } from "@/lib/mail";
import { findUserByEmailPrisma } from "@/lib/prisma-direct-auth";
import { readDb } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { parseJson, forgotPasswordSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await parseJson(request, forgotPasswordSchema);
  if ("response" in parsed) return parsed.response;
  const { email } = parsed.data;
  const user = process.env.DATA_DRIVER !== "json"
    ? await findUserByEmailPrisma(email)
    : (await readDb()).users.find((u) => u.email === email) || null;
  if (user) {
    const token = await createAuthToken(user.id, "password_reset");
    await sendPasswordResetEmail(user, token, request);
    await auditLog({ actorId: user.id, action: "auth.password_reset_requested", targetType: "user", targetId: user.id, request });
  }
  return NextResponse.json({ ok: true, message: "If that email exists, a reset link has been sent." });
}
