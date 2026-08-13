import { NextResponse } from "next/server";
import { z, type ZodError, type ZodSchema } from "zod";

export function validationError(error: ZodError) {
  return NextResponse.json({
    error: "Validation failed.",
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }))
  }, { status: 400 });
}

export async function parseJson<T>(request: Request, schema: ZodSchema<T>): Promise<{ data: T } | { response: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { response: NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }) };
  }

  const result = schema.safeParse(body);
  if (!result.success) return { response: validationError(result.error) };
  return { data: result.data };
}

const cleanString = (max: number) => z.string().trim().max(max);
const optionalString = (max: number) => z.string().trim().max(max).optional().default("");

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200)
});

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6).max(200),
  niche: z.string().trim().max(40).optional().default("Creator"),
  inviteCode: z.string().trim().max(40).optional().default(""),
  referralCode: z.string().trim().max(40).optional().default("")
});

export const createPostSchema = z.object({
  body: z.string().trim().max(2000).optional().default(""),
  imageUrl: z.string().trim().max(500).optional().default(""),
  visibility: z.enum(["public", "followers", "friends", "only_me"]).optional(),
  tags: z.string().trim().max(160).optional().default(""),
  pollQuestion: z.string().trim().max(140).optional().default(""),
  pollOptions: z.string().trim().max(500).optional().default(""),
  pollAllowMultiple: z.boolean().optional().default(false)
});

export const commentSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  parentId: z.string().trim().max(80).optional()
});

export const messageSchema = z.object({
  recipientId: z.string().trim().min(1).max(80),
  text: z.string().trim().min(1).max(1000)
});

export const marketplaceCreateSchema = z.object({
  title: z.string().trim().min(1).max(90),
  description: z.string().trim().min(1).max(500),
  type: z.enum(["service", "digital_product", "collaboration"]).optional().default("service"),
  category: z.string().trim().max(50).optional().default(""),
  price: z.coerce.number().min(0).max(1_000_000).optional().default(0),
  currency: z.string().trim().max(4).optional().default("USD"),
  imageUrl: z.string().trim().max(500).optional().default(""),
  tags: z.string().trim().max(180).optional().default("")
});

export const marketplaceInquirySchema = z.object({
  message: z.string().trim().min(1).max(600)
});

export const reportSchema = z.object({
  targetType: z.enum(["post", "user"]).optional().default("post"),
  targetId: z.string().trim().min(1).max(100),
  reason: z.enum(["spam", "harassment", "nudity", "hate", "other"]).optional().default("other"),
  details: z.string().trim().max(500).optional().default("")
});

export const settingsSchema = z.object({
  defaultPostVisibility: z.enum(["public", "followers", "friends", "only_me"]).optional(),
  allowMessagesFrom: z.enum(["everyone", "friends", "none"]).optional(),
  profileDiscoverable: z.boolean().optional(),
  notifyLikes: z.boolean().optional(),
  notifyComments: z.boolean().optional(),
  notifyFollows: z.boolean().optional(),
  notifyFriendRequests: z.boolean().optional(),
  notifyMessages: z.boolean().optional(),
  notifyMentions: z.boolean().optional(),
  digestFrequency: z.enum(["off", "daily", "weekly"]).optional()
});

export const profileSchema = z.object({
  name: cleanString(60).optional(),
  bio: z.string().trim().max(240).optional(),
  niche: cleanString(40).optional(),
  website: optionalString(120),
  avatar: optionalString(500)
});

export const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().email() });
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(200), password: z.string().min(6).max(200) });
export const verifyEmailSchema = z.object({ token: z.string().min(20).max(200) });
