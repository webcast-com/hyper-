import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();
  const checks: Record<string, unknown> = {
    app: "ok",
    dataDriver: process.env.DATA_DRIVER || "prisma",
    nodeEnv: process.env.NODE_ENV || "development"
  };

  try {
    if (process.env.DATA_DRIVER !== "json") {
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
