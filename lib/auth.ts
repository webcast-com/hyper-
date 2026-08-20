import crypto from "crypto";
import { cookies } from "next/headers";
import { findUserById, readDb, toSafeUser } from "./db";
import { isJsonDriver } from "./data-driver";
import type { SafeUser, User } from "./types";

const COOKIE_NAME = "creator_session";
const ONE_WEEK = 60 * 60 * 24 * 7;

function secret() {
  return process.env.SESSION_SECRET || "dev-secret-change-me";
}

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

function verify(value: string, signature: string) {
  const expected = sign(value);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function checkPassword(password: string, stored: string) {
  if (!stored.includes(":")) return false;
  const [salt, originalHash] = stored.split(":");
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(originalHash));
}

export function makeSession(userId: string) {
  const payload = JSON.stringify({ userId, expiresAt: Date.now() + ONE_WEEK * 1000 });
  const value = base64url(payload);
  return `${value}.${sign(value)}`;
}

export function parseSession(token?: string) {
  if (!token) return null;
  const [value, signature] = token.split(".");
  if (!value || !signature) return null;
  try {
    if (!verify(value, signature)) return null;
    const payload = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!payload.userId || payload.expiresAt < Date.now()) return null;
    return payload as { userId: string; expiresAt: number };
  } catch {
    return null;
  }
}

/**
 * Session cookie attributes.
 *
 * Default is `SameSite=Lax`, which is also this app's CSRF defence (there are no
 * CSRF tokens), so it must stay the default in production.
 *
 * When the app is served inside a cross-site iframe — e.g. the hosted HTTPS dev
 * preview — a `Lax` cookie is never sent back by the browser, so the user appears
 * to be logged out again immediately after signing in. Setting
 * `CROSS_SITE_COOKIES="true"` switches to `SameSite=None; Secure`, which browsers
 * require for cookies in a third-party context. Only enable it when the app is
 * served over HTTPS and framed by a trusted origin.
 */
function sessionCookieOptions() {
  const crossSite = process.env.CROSS_SITE_COOKIES === "true";
  return {
    httpOnly: true,
    // SameSite=None is only honoured by browsers when the cookie is also Secure.
    sameSite: crossSite ? ("none" as const) : ("lax" as const),
    secure: crossSite || process.env.NODE_ENV === "production",
    path: "/"
  };
}

export async function setSessionCookie(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, makeSession(userId), {
    ...sessionCookieOptions(),
    maxAge: ONE_WEEK
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  // Must match the attributes used when setting, or the browser keeps the original cookie.
  cookieStore.set(COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    maxAge: 0
  });
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = parseSession(token);
  if (!session) return null;
  return findUserById(session.userId);
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function getCurrentSafeUser(): Promise<SafeUser | null> {
  const user = await getCurrentUser();
  return user ? toSafeUser(user) : null;
}

export async function uniqueUsername(base: string) {
  if (!isJsonDriver()) {
    const { uniqueUsernamePrisma } = await import("./prisma-direct-auth");
    return uniqueUsernamePrisma(base);
  }
  const db = await readDb();
  const clean = base.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 18) || "creator";
  let candidate = clean;
  let i = 1;
  while (db.users.some((u) => u.username === candidate)) {
    candidate = `${clean}${i}`;
    i += 1;
  }
  return candidate;
}
