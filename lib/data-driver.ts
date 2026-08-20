export type DataDriver = "json" | "prisma";
export type PrismaProvider = "postgresql" | "sqlite";

/**
 * Dual-backend switch.
 * - json   → data/db.json only. Prisma Client is never loaded.
 * - prisma → DATABASE_URL. Postgres in production; sqlite only when the URL is a file: DSN
 *            used with prisma/schema.sqlite.prisma (npm run db:setup).
 */
export function isJsonDriver() {
  return process.env.DATA_DRIVER === "json";
}

export function dataDriver(): DataDriver {
  return isJsonDriver() ? "json" : "prisma";
}

export function prismaProviderFromUrl(url = process.env.DATABASE_URL || ""): PrismaProvider {
  if (url.startsWith("file:") || url.includes("mode=memory") || /sqlite/i.test(url)) return "sqlite";
  return "postgresql";
}

export function describeDataBackend() {
  if (isJsonDriver()) {
    return {
      driver: "json" as const,
      store: "data/db.json",
      provider: "json" as const,
      databaseUrlConfigured: Boolean(process.env.DATABASE_URL)
    };
  }

  const url = process.env.DATABASE_URL || "";
  const provider = prismaProviderFromUrl(url);
  return {
    driver: "prisma" as const,
    store: provider,
    provider,
    databaseUrlConfigured: Boolean(url)
  };
}
