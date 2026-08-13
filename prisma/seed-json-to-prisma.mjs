import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();

const sourceFile = process.env.SEED_SOURCE_FILE || path.join(process.cwd(), "data", "db.json");
if (process.env.NODE_ENV === "production") {
  if (process.env.SEED_SOURCE_FILE && process.env.ALLOW_DATA_IMPORT !== "true") {
    console.error("Refusing to import data in production. Set ALLOW_DATA_IMPORT=true to confirm restore/import intent.");
    process.exit(1);
  }
  if (!process.env.SEED_SOURCE_FILE && process.env.ALLOW_DEMO_SEED !== "true") {
    console.error("Refusing to seed demo JSON data in production. Set ALLOW_DEMO_SEED=true only if you intentionally want demo data.");
    process.exit(1);
  }
}

const dbPath = sourceFile;
const db = JSON.parse(await readFile(dbPath, "utf8"));

const json = (value, fallback) => JSON.stringify(value ?? fallback);
const date = (value) => new Date(value || Date.now());

async function main() {
  console.log("Seeding Prisma database from data/db.json...");

  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany();
    await tx.message.deleteMany();
    await tx.conversation.deleteMany();
    await tx.marketplaceInquiry.deleteMany();
    await tx.marketplaceListing.deleteMany();
    await tx.challengeEntry.deleteMany();
    await tx.challenge.deleteMany();
    await tx.story.deleteMany();
    await tx.comment.deleteMany();
    await tx.post.deleteMany();
    await tx.group.deleteMany();
    await tx.event.deleteMany();
    await tx.friendRequest.deleteMany();
    await tx.report.deleteMany();
    await tx.adminMetricSnapshot.deleteMany();
    await tx.moderationFlag.deleteMany();
    await tx.moderationRule.deleteMany();
    await tx.featureFlag.deleteMany();
    await tx.webhookDelivery.deleteMany();
    await tx.webhookEndpoint.deleteMany();
    await tx.authToken.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.mediaAsset.deleteMany();
    await tx.referral.deleteMany();
    await tx.user.deleteMany();

    for (const user of db.users || []) {
      await tx.user.create({
        data: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          emailVerified: Boolean(user.emailVerified),
          passwordHash: user.passwordHash,
          bio: user.bio,
          niche: user.niche,
          website: user.website || null,
          avatar: user.avatar,
          banner: user.banner,
          followers: json(user.followers, []),
          following: json(user.following, []),
          friends: json(user.friends, []),
          blockedUsers: json(user.blockedUsers, []),
          mutedUsers: json(user.mutedUsers, []),
          savedPosts: json(user.savedPosts, []),
          settings: json(user.settings, {}),
          roles: json(user.roles, user.username === "mayamakes" ? ["owner", "admin", "moderator", "user"] : (user.isAdmin ? ["admin", "moderator", "user"] : ["user"])),
          isAdmin: Boolean(user.isAdmin),
          suspended: Boolean(user.suspended),
          referralCode: user.referralCode,
          createdAt: date(user.createdAt)
        }
      });
    }

    for (const group of db.groups || []) {
      await tx.group.create({
        data: {
          id: group.id,
          name: group.name,
          description: group.description,
          cover: group.cover,
          ownerId: group.ownerId,
          memberIds: json(group.memberIds, []),
          createdAt: date(group.createdAt)
        }
      });
    }

    for (const event of db.events || []) {
      await tx.event.create({
        data: {
          id: event.id,
          title: event.title,
          description: event.description,
          location: event.location,
          startsAt: date(event.startsAt),
          hostId: event.hostId,
          attendeeIds: json(event.attendeeIds, []),
          cover: event.cover,
          createdAt: date(event.createdAt)
        }
      });
    }

    for (const post of db.posts || []) {
      await tx.post.create({
        data: {
          id: post.id,
          authorId: post.authorId,
          groupId: post.groupId || null,
          eventId: post.eventId || null,
          body: post.body,
          imageUrl: post.imageUrl || null,
          poll: post.poll ? json(post.poll, null) : null,
          tags: json(post.tags, []),
          visibility: post.visibility || "public",
          likes: json(post.likes, []),
          reactions: json(post.reactions, {}),
          shares: post.shares || 0,
          createdAt: date(post.createdAt)
        }
      });

      for (const comment of post.comments || []) {
        await tx.comment.create({
          data: {
            id: comment.id,
            postId: post.id,
            userId: comment.userId,
            parentId: comment.parentId || null,
            text: comment.text,
            likes: json(comment.likes, []),
            createdAt: date(comment.createdAt)
          }
        });
      }
    }

    for (const story of db.stories || []) {
      await tx.story.create({
        data: {
          id: story.id,
          authorId: story.authorId,
          body: story.body,
          imageUrl: story.imageUrl || null,
          views: json(story.views, []),
          createdAt: date(story.createdAt),
          expiresAt: date(story.expiresAt)
        }
      });
    }

    for (const challenge of db.challenges || []) {
      await tx.challenge.create({
        data: {
          id: challenge.id,
          title: challenge.title,
          description: challenge.description,
          theme: challenge.theme,
          prize: challenge.prize,
          startsAt: date(challenge.startsAt),
          endsAt: date(challenge.endsAt),
          hostId: challenge.hostId,
          createdAt: date(challenge.createdAt)
        }
      });
    }

    for (const entry of db.challengeEntries || []) {
      await tx.challengeEntry.create({
        data: {
          id: entry.id,
          challengeId: entry.challengeId,
          authorId: entry.authorId,
          title: entry.title,
          body: entry.body,
          imageUrl: entry.imageUrl || null,
          votes: json(entry.votes, []),
          createdAt: date(entry.createdAt)
        }
      });
    }

    for (const listing of db.marketplaceListings || []) {
      await tx.marketplaceListing.create({
        data: {
          id: listing.id,
          sellerId: listing.sellerId,
          title: listing.title,
          description: listing.description,
          type: listing.type,
          category: listing.category,
          price: Number(listing.price || 0),
          currency: listing.currency,
          imageUrl: listing.imageUrl || null,
          tags: json(listing.tags, []),
          saves: json(listing.saves, []),
          active: listing.active !== false,
          createdAt: date(listing.createdAt)
        }
      });
    }

    for (const inquiry of db.marketplaceInquiries || []) {
      await tx.marketplaceInquiry.create({
        data: {
          id: inquiry.id,
          listingId: inquiry.listingId,
          buyerId: inquiry.buyerId,
          sellerId: inquiry.sellerId,
          message: inquiry.message,
          status: inquiry.status,
          createdAt: date(inquiry.createdAt)
        }
      });
    }

    for (const conversation of db.conversations || []) {
      await tx.conversation.create({
        data: {
          id: conversation.id,
          participantIds: json(conversation.participantIds, []),
          createdAt: date(conversation.createdAt),
          updatedAt: date(conversation.updatedAt)
        }
      });
      for (const message of conversation.messages || []) {
        await tx.message.create({
          data: {
            id: message.id,
            conversationId: conversation.id,
            senderId: message.senderId,
            recipientId: message.recipientId,
            text: message.text,
            read: Boolean(message.read),
            createdAt: date(message.createdAt)
          }
        });
      }
    }

    for (const notification of db.notifications || []) {
      await tx.notification.create({
        data: {
          id: notification.id,
          recipientId: notification.recipientId,
          actorId: notification.actorId,
          type: notification.type,
          postId: notification.postId || null,
          commentId: notification.commentId || null,
          read: Boolean(notification.read),
          createdAt: date(notification.createdAt)
        }
      });
    }

    for (const request of db.friendRequests || []) {
      await tx.friendRequest.create({
        data: {
          id: request.id,
          senderId: request.senderId,
          recipientId: request.recipientId,
          status: request.status,
          createdAt: date(request.createdAt),
          respondedAt: request.respondedAt ? date(request.respondedAt) : null
        }
      });
    }

    for (const report of db.reports || []) {
      await tx.report.create({
        data: {
          id: report.id,
          reporterId: report.reporterId,
          targetType: report.targetType,
          targetId: report.targetId,
          reason: report.reason,
          details: report.details,
          status: report.status,
          createdAt: date(report.createdAt)
        }
      });
    }

    for (const referral of db.referrals || []) {
      await tx.referral.create({
        data: {
          id: referral.id,
          inviterId: referral.inviterId,
          invitedUserId: referral.invitedUserId,
          code: referral.code,
          createdAt: date(referral.createdAt)
        }
      });
    }

    for (const asset of db.mediaAssets || []) {
      await tx.mediaAsset.create({
        data: {
          id: asset.id,
          ownerId: asset.ownerId,
          url: asset.url,
          provider: asset.provider,
          filename: asset.filename,
          mimeType: asset.mimeType,
          size: Number(asset.size || 0),
          width: asset.width || null,
          height: asset.height || null,
          createdAt: date(asset.createdAt)
        }
      });
    }

    for (const token of db.authTokens || []) {
      await tx.authToken.create({
        data: {
          id: token.id,
          userId: token.userId,
          type: token.type,
          tokenHash: token.tokenHash,
          expiresAt: date(token.expiresAt),
          usedAt: token.usedAt ? date(token.usedAt) : null,
          createdAt: date(token.createdAt)
        }
      });
    }

    for (const rule of db.moderationRules || []) {
      await tx.moderationRule.create({
        data: {
          id: rule.id,
          phrase: rule.phrase,
          targetTypes: json(rule.targetTypes, []),
          action: rule.action,
          active: Boolean(rule.active),
          createdBy: rule.createdBy || null,
          createdAt: date(rule.createdAt),
          updatedAt: date(rule.updatedAt)
        }
      });
    }

    for (const flag of db.moderationFlags || []) {
      await tx.moderationFlag.create({
        data: {
          id: flag.id,
          ruleId: flag.ruleId || null,
          targetType: flag.targetType,
          targetId: flag.targetId,
          actorId: flag.actorId || null,
          excerpt: flag.excerpt,
          status: flag.status || "open",
          createdAt: date(flag.createdAt)
        }
      });
    }

    for (const flag of db.featureFlags || []) {
      await tx.featureFlag.create({
        data: {
          key: flag.key,
          enabled: Boolean(flag.enabled),
          description: flag.description || null,
          updatedBy: flag.updatedBy || null,
          updatedAt: date(flag.updatedAt),
          createdAt: date(flag.createdAt)
        }
      });
    }

    for (const log of db.auditLogs || []) {
      await tx.auditLog.create({
        data: {
          id: log.id,
          actorId: log.actorId || null,
          action: log.action,
          targetType: log.targetType || null,
          targetId: log.targetId || null,
          metadata: JSON.stringify(log.metadata || {}),
          ip: log.ip || null,
          userAgent: log.userAgent || null,
          createdAt: date(log.createdAt)
        }
      });
    }
  }, { timeout: 30_000 });

  console.log("Prisma seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
