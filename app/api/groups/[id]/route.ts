import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canViewPost, publicGroup, publicPost, readDb } from "@/lib/db";
import { getGroupPrisma } from "@/lib/prisma-direct-community";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (process.env.DATA_DRIVER !== "json") {
    const result = await getGroupPrisma(id, user);
    if (!result) return NextResponse.json({ error: "Group not found." }, { status: 404 });
    return NextResponse.json(result);
  }

  const db = await readDb();
  const group = db.groups.find((item) => item.id === id);
  if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });

  const posts = db.posts
    .filter((post) => post.groupId === group.id && canViewPost(post, user, db.users))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((post) => publicPost(post, db.users, db.groups));

  return NextResponse.json({ group: publicGroup(group, db.users, user?.id), posts });
}
