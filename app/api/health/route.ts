import { NextResponse } from "next/server";
import { describeDataBackend, isJsonDriver } from "@/lib/data-driver";

export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();
  const backend = describeDataBackend();
  const checks: Record<string, unknown> = {
    app: "ok",
    dataDriver: backend.driver,
    dataStore: backend.store,
    nodeEnv: process.env.NODE_ENV || "development"
  };

  try {
    if (!isJsonDriver()) {
      const { prisma } = await import("@/lib/prisma");
      await prisma().$queryRaw`SELECT 1`;
      checks.database = "ok";
    } else {
      checks.database = "json";
    }
  } catch (error) {
    checks.database = "error";
    return NextResponse.json({ status: "error", checks, latencyMs: Date.now() - startedAt }, { status: 503 });
  }

  return NextResponse.json({ status: "ok", checks, latencyMs: Date.now() - startedAt, checkedAt: new Date().toISOString() });
}
