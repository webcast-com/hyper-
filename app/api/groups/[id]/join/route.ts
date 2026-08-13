import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { publicGroup, updateDb } from "@/lib/db";
import { toggleGroupJoinPrisma } from "@/lib/prisma-direct-community";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to join groups." }, { status: 401 });
  const { id } = await params;
  if (process.env.DATA_DRIVER !== "json") {
    const group = await toggleGroupJoinPrisma(id, user);
    if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });
    return NextResponse.json({ group });
  }

  const group = await updateDb((db) => {
    const found = db.groups.find((item) => item.id === id);
    if (!found) return null;
    if (found.memberIds.includes(user.id)) found.memberIds = found.memberIds.filter((memberId) => memberId !== user.id);
    else found.memberIds.push(user.id);
    return publicGroup(found, db.users, user.id);
  });
  if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  return NextResponse.json({ group });
}
