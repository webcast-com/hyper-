import { NextResponse } from "next/server";
import { getCurrentSafeUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentSafeUser();
  return NextResponse.json({ user });
}
