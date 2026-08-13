import { describe, expect, it } from "vitest";
import {
  commentSchema,
  createPostSchema,
  loginSchema,
  marketplaceCreateSchema,
  messageSchema,
  registerSchema,
  reportSchema,
  resetPasswordSchema,
  settingsSchema
} from "@/lib/validation";

describe("validation schemas", () => {
  it("accepts a valid login payload", () => {
    const result = loginSchema.parse({ email: "USER@Example.COM ", password: "secret" });
    expect(result.email).toBe("user@example.com");
  });

  it("rejects an invalid email", () => {
    expect(() => loginSchema.parse({ email: "bad", password: "secret" })).toThrow();
  });

  it("rejects short registration passwords", () => {
    expect(() => registerSchema.parse({ name: "A", email: "a@example.com", password: "123" })).toThrow();
  });

  it("defaults post fields safely", () => {
    const post = createPostSchema.parse({ body: "hello" });
    expect(post.imageUrl).toBe("");
    expect(post.tags).toBe("");
    expect(post.pollAllowMultiple).toBe(false);
  });

  it("limits comments and messages", () => {
    expect(commentSchema.parse({ text: "Nice" }).text).toBe("Nice");
    expect(() => messageSchema.parse({ recipientId: "usr_1", text: "" })).toThrow();
  });

  it("validates marketplace type enums", () => {
    expect(marketplaceCreateSchema.parse({ title: "Logo", description: "Design", type: "service" }).type).toBe("service");
    expect(() => marketplaceCreateSchema.parse({ title: "Logo", description: "Design", type: "invalid" })).toThrow();
  });

  it("validates report targets and settings enums", () => {
    expect(reportSchema.parse({ targetId: "post_1", reason: "spam" }).reason).toBe("spam");
    expect(settingsSchema.parse({ allowMessagesFrom: "friends" }).allowMessagesFrom).toBe("friends");
    expect(() => settingsSchema.parse({ allowMessagesFrom: "aliens" })).toThrow();
  });

  it("requires valid reset token and password", () => {
    expect(() => resetPasswordSchema.parse({ token: "short", password: "123456" })).toThrow();
    expect(resetPasswordSchema.parse({ token: "a".repeat(32), password: "123456" }).password).toBe("123456");
  });
});
