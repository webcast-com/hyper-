import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { id, now, publicGroup, readDb, updateDb } from "@/lib/db";
import { createGroupPrisma, listGroupsPrisma } from "@/lib/prisma-direct-community";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (process.env.DATA_DRIVER !== "json") {
    const groups = await listGroupsPrisma(user?.id);
    return NextResponse.json({ groups });
  }

  const db = await readDb();
  const groups = db.groups
    .slice()
    .sort((a, b) => b.memberIds.length - a.memberIds.length)
    .map((group) => publicGroup(group, db.users, user?.id));
  return NextResponse.json({ groups });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to create groups." }, { status: 401 });
  const body = await request.json();
  const name = String(body.name || "").trim().slice(0, 60);
  const description = String(body.description || "").trim().slice(0, 180);
  if (!name) return NextResponse.json({ error: "Group name is required." }, { status: 400 });
  if (process.env.DATA_DRIVER !== "json") {
    const group = await createGroupPrisma(user, { name, description });
    return NextResponse.json({ group }, { status: 201 });
  }

  const group = await updateDb((db) => {
    const created = { id: id("grp"), name, description, cover: "linear-gradient(135deg,#111827,#2563eb)", ownerId: user.id, memberIds: [user.id], createdAt: now() };
    db.groups.push(created);
    return publicGroup(created, db.users, user.id);
  });
  return NextResponse.json({ group }, { status: 201 });
}
