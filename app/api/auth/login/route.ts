import { NextResponse } from "next/server";
import { checkPassword, setSessionCookie } from "@/lib/auth";
import { readDb, toSafeUser } from "@/lib/db";
import { findUserByEmailPrisma } from "@/lib/prisma-direct-auth";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { loginSchema, parseJson } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = await rateLimit(request, "auth:login", 8, 60000);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429, headers: rateLimitHeaders(limited) });
  const parsed = await parseJson(request, loginSchema);
  if ("response" in parsed) return parsed.response;
  const { email, password } = parsed.data;
  const cleanEmail = email;
  const user = process.env.DATA_DRIVER !== "json"
    ? await findUserByEmailPrisma(cleanEmail)
    : (await readDb()).users.find((u) => u.email === cleanEmail);
  if (!user || !checkPassword(password, user.passwordHash)) {
    await auditLog({ action: "auth.login_failed", targetType: "user", targetId: cleanEmail, request });
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  if (user.suspended) {
    return NextResponse.json({ error: "This account is suspended. Contact support if you believe this is a mistake." }, { status: 403 });
  }
  await setSessionCookie(user.id);
  await auditLog({ actorId: user.id, action: "auth.login", targetType: "user", targetId: user.id, request });
  return NextResponse.json({ user: toSafeUser(user) });
}
