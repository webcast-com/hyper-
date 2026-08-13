import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readDb, toSafeUser } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { prismaUserToUser } from "@/lib/prisma-direct-auth";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET() {
  const actor = await getCurrentUser();
  if (!hasPermission(actor, "admin:read")) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  if (process.env.DATA_DRIVER !== "json") {
    const users = await prisma().user.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return NextResponse.json({ users: users.map((user) => toSafeUser(prismaUserToUser(user))) });
  }

  const db = await readDb();
  return NextResponse.json({ users: db.users.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 200).map(toSafeUser) });
}
