import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readDb, toSafeUser, updateDb } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { prismaUserToUser } from "@/lib/prisma-direct-auth";
import { auditLog } from "@/lib/audit";
import { canManageRole, hasPermission, hasRole } from "@/lib/permissions";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

const ROLES: Role[] = ["user", "moderator", "admin", "owner"];

function normalizeRoles(value: unknown): Role[] {
  const roles = Array.isArray(value) ? value.filter((role): role is Role => ROLES.includes(role)) : [];
  return Array.from(new Set([...roles, "user"]));
}

export async function PATCH(request: Request, { params }: Params) {
  const actor = await getCurrentUser();
  if (!actor || !hasPermission(actor, "admin:roles")) return NextResponse.json({ error: "Role management permission required." }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  const roles = normalizeRoles(body.roles);
  const reason = String(body.reason || "").trim().slice(0, 500);
  const confirm = String(body.confirm || "");

  if (id === actor.id && !roles.includes("owner") && hasRole(actor, "owner")) {
    return NextResponse.json({ error: "Owners cannot remove their own owner role." }, { status: 400 });
  }
  if (roles.some((role) => !canManageRole(actor, role))) return NextResponse.json({ error: "You cannot assign one or more requested roles." }, { status: 403 });
  if ((roles.includes("admin") || roles.includes("owner")) && confirm !== "CONFIRM") {
    return NextResponse.json({ error: "Type CONFIRM to assign admin or owner roles." }, { status: 400 });
  }

  if (process.env.DATA_DRIVER !== "json") {
    const found = await prisma().user.findUnique({ where: { id } });
    if (!found) return NextResponse.json({ error: "User not found." }, { status: 404 });
    const updated = await prisma().user.update({ where: { id }, data: { roles: JSON.stringify(roles), isAdmin: roles.includes("admin") || roles.includes("owner") } });
    const user = toSafeUser(prismaUserToUser(updated));
    await auditLog({ actorId: actor.id, action: "admin.roles_update", targetType: "user", targetId: id, metadata: { roles, reason }, request });
    return NextResponse.json({ user });
  }

  const updated = await updateDb((db) => {
    const user = db.users.find((candidate) => candidate.id === id);
    if (!user) return null;
    user.roles = roles;
    user.isAdmin = roles.includes("admin") || roles.includes("owner");
    return toSafeUser(user);
  });

  if (!updated) return NextResponse.json({ error: "User not found." }, { status: 404 });
  await auditLog({ actorId: actor.id, action: "admin.roles_update", targetType: "user", targetId: id, metadata: { roles, reason }, request });
  return NextResponse.json({ user: updated });
}
