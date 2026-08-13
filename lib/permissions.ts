import type { Role, User } from "./types";

export type Permission =
  | "admin:read"
  | "admin:moderate"
  | "admin:suspend"
  | "admin:roles"
  | "admin:maintenance"
  | "admin:audit"
  | "admin:system";

const rolePermissions: Record<Role, Permission[]> = {
  user: [],
  moderator: ["admin:read", "admin:moderate"],
  admin: ["admin:read", "admin:moderate", "admin:suspend", "admin:maintenance", "admin:audit", "admin:system"],
  owner: ["admin:read", "admin:moderate", "admin:suspend", "admin:roles", "admin:maintenance", "admin:audit", "admin:system"]
};

export function rolesFor(user?: User | null): Role[] {
  if (!user) return [];
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const withFallback = user.isAdmin ? [...roles, "admin", "moderator", "user"] : [...roles, "user"];
  return Array.from(new Set(withFallback)) as Role[];
}

export function hasRole(user: User | null | undefined, role: Role) {
  return rolesFor(user).includes(role);
}

export function hasPermission(user: User | null | undefined, permission: Permission) {
  return rolesFor(user).some((role) => rolePermissions[role]?.includes(permission));
}

export function canManageRole(actor: User, targetRole: Role) {
  if (hasRole(actor, "owner")) return true;
  if (targetRole === "owner") return false;
  return hasPermission(actor, "admin:roles");
}
