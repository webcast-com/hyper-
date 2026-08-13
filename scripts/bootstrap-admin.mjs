import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for admin bootstrap.`);
  return value;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function referralCodeFor(name) {
  const base = name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "OWNER";
  return `${base}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function defaultSettings() {
  return {
    defaultPostVisibility: "public",
    allowMessagesFrom: "everyone",
    profileDiscoverable: true,
    notifyLikes: true,
    notifyComments: true,
    notifyFollows: true,
    notifyFriendRequests: true,
    notifyMessages: true,
    notifyMentions: true
  };
}

async function main() {
  const existingUsers = await prisma.user.count();
  const allowWhenUsersExist = process.env.ADMIN_BOOTSTRAP_FORCE === "true";

  if (existingUsers > 0 && !allowWhenUsersExist) {
    console.log(`Admin bootstrap skipped: ${existingUsers} user(s) already exist. Set ADMIN_BOOTSTRAP_FORCE=true to upsert the configured admin.`);
    return;
  }

  const email = required("ADMIN_EMAIL").trim().toLowerCase();
  const password = required("ADMIN_PASSWORD");
  const name = process.env.ADMIN_NAME?.trim() || "Platform Owner";
  const username = (process.env.ADMIN_USERNAME?.trim() || "owner").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24) || "owner";

  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
  const roles = ["owner", "admin", "moderator", "user"];

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        emailVerified: true,
        isAdmin: true,
        roles: JSON.stringify(roles),
        suspended: false,
        ...(process.env.ADMIN_PASSWORD_ROTATE === "true" ? { passwordHash: hashPassword(password) } : {})
      }
    });
    console.log(`Admin bootstrap updated existing owner account: ${email}`);
    return;
  }

  let referralCode = referralCodeFor(name);
  while (await prisma.user.findUnique({ where: { referralCode }, select: { id: true } })) referralCode = referralCodeFor(name);

  await prisma.user.create({
    data: {
      id: `usr_${crypto.randomBytes(8).toString("hex")}`,
      name,
      username,
      email,
      emailVerified: true,
      passwordHash: hashPassword(password),
      bio: "Platform owner account.",
      niche: "Admin",
      website: "",
      avatar: `https://api.dicebear.com/8.x/adventurer/svg?seed=${encodeURIComponent(name)}`,
      banner: "linear-gradient(135deg,#111827,#7c3aed)",
      followers: "[]",
      following: "[]",
      friends: "[]",
      blockedUsers: "[]",
      mutedUsers: "[]",
      savedPosts: "[]",
      settings: JSON.stringify(defaultSettings()),
      isAdmin: true,
      roles: JSON.stringify(roles),
      suspended: false,
      referralCode
    }
  });

  console.log(`Admin bootstrap created owner account: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
