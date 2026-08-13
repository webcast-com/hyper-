import crypto from "crypto";
import { cookies } from "next/headers";
import { findUserById, readDb, toSafeUser } from "./db";
import { uniqueUsernamePrisma } from "./prisma-direct-auth";
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

export async function setSessionCookie(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, makeSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_WEEK,
    path: "/"
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
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
  if (process.env.DATA_DRIVER !== "json") return uniqueUsernamePrisma(base);
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
