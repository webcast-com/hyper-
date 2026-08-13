import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createAuthToken } from "@/lib/auth-token-service";
import { sendVerificationEmail } from "@/lib/mail";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to resend verification." }, { status: 401 });
  if (user.emailVerified) return NextResponse.json({ ok: true, message: "Email already verified." });
  const token = await createAuthToken(user.id, "email_verification");
  await sendVerificationEmail(user, token, request);
  return NextResponse.json({ ok: true });
}
