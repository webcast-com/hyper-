import type { PrismaClient } from "@prisma/client";
import { isJsonDriver } from "./data-driver";

declare global {
  // eslint-disable-next-line no-var
  var __creatorPrisma: PrismaClient | undefined;
}

function loadPrismaClient(): new () => PrismaClient {
  // Keep this out of the static module graph so JSON mode can boot without
  // `prisma generate`. eval("require") is Node-only and is not bundled by Next.
  const nodeRequire = eval("require") as NodeRequire;
  const mod = nodeRequire("@prisma/" + "client") as { PrismaClient: new () => PrismaClient };
  return mod.PrismaClient;
}

export function prisma(): PrismaClient {
  if (isJsonDriver()) {
    throw new Error("Prisma client is not used when DATA_DRIVER=json. JSON mode reads data/db.json only.");
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required for Prisma runtime. Copy .env.example to .env, set DATABASE_URL, then run npm run db:setup. Use DATA_DRIVER=json only for legacy JSON mode."
    );
  }

  if (!globalThis.__creatorPrisma) {
    const PrismaClient = loadPrismaClient();
    globalThis.__creatorPrisma = new PrismaClient();
  }
  return globalThis.__creatorPrisma;
}
