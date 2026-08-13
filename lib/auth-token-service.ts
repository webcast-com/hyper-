import crypto from "crypto";
import { hashPassword } from "./auth";
import { id, now, updateDb } from "./db";
import { prisma } from "./prisma";
import type { AuthTokenType } from "./types";

const tokenHash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
const randomToken = () => crypto.randomBytes(32).toString("base64url");
const expiryMs = (type: AuthTokenType) => type === "email_verification" ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;

export async function createAuthToken(userId: string, type: AuthTokenType) {
  const token = randomToken();
  const record = {
    id: id("token"),
    userId,
    type,
    tokenHash: tokenHash(token),
    expiresAt: new Date(Date.now() + expiryMs(type)).toISOString(),
    createdAt: now()
  };
  if (process.env.DATA_DRIVER !== "json") {
    await prisma().authToken.create({ data: { ...record, expiresAt: new Date(record.expiresAt), createdAt: new Date(record.createdAt) } });
  } else {
    await updateDb((db) => { db.authTokens.push(record); return record; });
  }
  return token;
}

export async function verifyEmailToken(token: string) {
  const hash = tokenHash(token);
  if (process.env.DATA_DRIVER !== "json") {
    const found = await prisma().authToken.findUnique({ where: { tokenHash: hash } });
    if (!found || found.type !== "email_verification" || found.usedAt || found.expiresAt.getTime() < Date.now()) return null;
    await prisma().$transaction([
      prisma().authToken.update({ where: { id: found.id }, data: { usedAt: new Date() } }),
      prisma().user.update({ where: { id: found.userId }, data: { emailVerified: true } })
    ]);
    return found.userId;
  }
  return updateDb((db) => {
    const found = db.authTokens.find((item) => item.tokenHash === hash && item.type === "email_verification");
    if (!found || found.usedAt || Date.parse(found.expiresAt) < Date.now()) return null;
    found.usedAt = now();
    const user = db.users.find((u) => u.id === found.userId);
    if (user) user.emailVerified = true;
    return found.userId;
  });
}

export async function resetPasswordWithToken(token: string, password: string) {
  const hash = tokenHash(token);
  const passwordHash = hashPassword(password);
  if (process.env.DATA_DRIVER !== "json") {
    const found = await prisma().authToken.findUnique({ where: { tokenHash: hash } });
    if (!found || found.type !== "password_reset" || found.usedAt || found.expiresAt.getTime() < Date.now()) return null;
    await prisma().$transaction([
      prisma().authToken.update({ where: { id: found.id }, data: { usedAt: new Date() } }),
      prisma().user.update({ where: { id: found.userId }, data: { passwordHash } })
    ]);
    return found.userId;
  }
  return updateDb((db) => {
    const found = db.authTokens.find((item) => item.tokenHash === hash && item.type === "password_reset");
    if (!found || found.usedAt || Date.parse(found.expiresAt) < Date.now()) return null;
    found.usedAt = now();
    const user = db.users.find((u) => u.id === found.userId);
    if (user) user.passwordHash = passwordHash;
    return found.userId;
  });
}
