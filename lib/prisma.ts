import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __creatorPrisma: PrismaClient | undefined;
}

export function prisma() {
  if (process.env.DATA_DRIVER !== "json" && !process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required for Prisma runtime. Copy .env.example to .env, set DATABASE_URL, then run npm run db:setup. Use DATA_DRIVER=json only for legacy JSON mode."
    );
  }

  if (!globalThis.__creatorPrisma) {
    globalThis.__creatorPrisma = new PrismaClient();
  }
  return globalThis.__creatorPrisma;
}
