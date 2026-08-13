import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

export async function GET() {
  const file = await fs.readFile(path.join(process.cwd(), "public", "openapi.json"), "utf8");
  return NextResponse.json(JSON.parse(file));
}
