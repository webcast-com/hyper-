import { describe, expect, it } from "vitest";
import { canManageRole, hasPermission, hasRole, rolesFor } from "@/lib/permissions";
import type { User } from "@/lib/types";

function user(overrides: Partial<User> = {}): User {
  return {
    id: "usr_test",
    name: "Test",
    username: "test",
    email: "test@example.com",
    emailVerified: true,
    passwordHash: "hash",
    bio: "",
    niche: "Testing",
    website: "",
    avatar: "",
    banner: "",
    followers: [],
    following: [],
    friends: [],
    blockedUsers: [],
    mutedUsers: [],
    isAdmin: false,
    roles: ["user"],
    suspended: false,
    referralCode: "TEST",
    savedPosts: [],
    settings: {
      defaultPostVisibility: "public",
      allowMessagesFrom: "everyone",
      profileDiscoverable: true,
      notifyLikes: true,
      notifyComments: true,
      notifyFollows: true,
      notifyFriendRequests: true,
      notifyMessages: true,
      notifyMentions: true
    },
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

describe("permissions", () => {
  it("falls back isAdmin users to admin permissions", () => {
    const admin = user({ isAdmin: true, roles: ["user"] });
    expect(hasRole(admin, "admin")).toBe(true);
    expect(hasPermission(admin, "admin:suspend")).toBe(true);
  });

  it("gives moderators moderation but not suspension", () => {
    const mod = user({ roles: ["user", "moderator"] });
    expect(hasPermission(mod, "admin:moderate")).toBe(true);
    expect(hasPermission(mod, "admin:suspend")).toBe(false);
  });

  it("only owners can manage owner role", () => {
    const admin = user({ roles: ["user", "admin"] });
    const owner = user({ roles: ["user", "admin", "owner"] });
    expect(canManageRole(admin, "owner")).toBe(false);
    expect(canManageRole(owner, "owner")).toBe(true);
  });

  it("deduplicates roles", () => {
    expect(rolesFor(user({ roles: ["user", "user", "moderator"] }))).toEqual(["user", "moderator"]);
  });
});
