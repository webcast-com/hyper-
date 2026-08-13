import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canViewPost, isBlockedBetween, publicPost, updateDb } from "@/lib/db";
import { votePollPrisma } from "@/lib/prisma-direct-interactions";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to vote in polls." }, { status: 401 });

  const { id: postId } = await params;
  const body = await request.json();
  const optionId = String(body.optionId || "");
  if (!optionId) return NextResponse.json({ error: "Poll option is required." }, { status: 400 });

  if (process.env.DATA_DRIVER !== "json") {
    const post = await votePollPrisma(postId, user, optionId).catch((err) => ({ error: err.message } as const));
    if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    if ("error" in post) return NextResponse.json({ error: post.error }, { status: 400 });
    return NextResponse.json({ post });
  }

  const result = await updateDb((db) => {
    const post = db.posts.find((item) => item.id === postId);
    if (!post) return null;
    if (!canViewPost(post, user, db.users)) throw new Error("You cannot vote on this poll.");
    const author = db.users.find((item) => item.id === post.authorId);
    if (isBlockedBetween(author, user)) throw new Error("You cannot interact with this poll.");
    if (!post.poll) throw new Error("This post does not have a poll.");
    if (post.poll.closesAt && Date.parse(post.poll.closesAt) < Date.now()) throw new Error("This poll is closed.");

    const option = post.poll.options.find((item) => item.id === optionId);
    if (!option) throw new Error("Poll option not found.");

    const alreadyVoted = option.votes.includes(user.id);
    if (!post.poll.allowMultiple) {
      post.poll.options.forEach((item) => {
        item.votes = item.votes.filter((voterId) => voterId !== user.id);
      });
    }

    if (!alreadyVoted) option.votes.push(user.id);
    else if (post.poll.allowMultiple) option.votes = option.votes.filter((voterId) => voterId !== user.id);

    return publicPost(post, db.users);
  }).catch((err) => ({ error: err.message } as const));

  if (!result) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ post: result });
}
