-- Relational projections of JSON graph fields, plus missing FKs.
-- JSON columns remain the API source of truth.

UPDATE "AuditLog" SET "actorId" = NULL
WHERE "actorId" IS NOT NULL AND "actorId" NOT IN (SELECT "id" FROM "User");

DELETE FROM "FriendRequest"
WHERE "senderId" NOT IN (SELECT "id" FROM "User")
   OR "recipientId" NOT IN (SELECT "id" FROM "User");

DELETE FROM "NotificationDigest"
WHERE "userId" NOT IN (SELECT "id" FROM "User");

ALTER TABLE "FriendRequest" DROP CONSTRAINT IF EXISTS "FriendRequest_senderId_fkey";
ALTER TABLE "FriendRequest" ADD CONSTRAINT "FriendRequest_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FriendRequest" DROP CONSTRAINT IF EXISTS "FriendRequest_recipientId_fkey";
ALTER TABLE "FriendRequest" ADD CONSTRAINT "FriendRequest_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_actorId_fkey";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NotificationDigest" DROP CONSTRAINT IF EXISTS "NotificationDigest_userId_fkey";
ALTER TABLE "NotificationDigest" ADD CONSTRAINT "NotificationDigest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "Follow" (
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Follow_pkey" PRIMARY KEY ("followerId","followingId")
);

CREATE TABLE IF NOT EXISTS "Friendship" (
    "userId" TEXT NOT NULL,
    "friendId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("userId","friendId")
);

CREATE TABLE IF NOT EXISTS "UserBlock" (
    "userId" TEXT NOT NULL,
    "blockedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("userId","blockedUserId")
);

CREATE TABLE IF NOT EXISTS "UserMute" (
    "userId" TEXT NOT NULL,
    "mutedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserMute_pkey" PRIMARY KEY ("userId","mutedUserId")
);

CREATE TABLE IF NOT EXISTS "SavedPost" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedPost_pkey" PRIMARY KEY ("userId","postId")
);

CREATE TABLE IF NOT EXISTS "PostLike" (
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostLike_pkey" PRIMARY KEY ("postId","userId")
);

CREATE TABLE IF NOT EXISTS "CommentLike" (
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommentLike_pkey" PRIMARY KEY ("commentId","userId")
);

CREATE TABLE IF NOT EXISTS "PostTag" (
    "postId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostTag_pkey" PRIMARY KEY ("postId","tag")
);

CREATE TABLE IF NOT EXISTS "GroupMember" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("groupId","userId")
);

CREATE TABLE IF NOT EXISTS "EventAttendee" (
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventAttendee_pkey" PRIMARY KEY ("eventId","userId")
);

CREATE TABLE IF NOT EXISTS "ConversationParticipant" (
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("conversationId","userId")
);

CREATE TABLE IF NOT EXISTS "ListingSave" (
    "listingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListingSave_pkey" PRIMARY KEY ("listingId","userId")
);

CREATE TABLE IF NOT EXISTS "ChallengeEntryVote" (
    "entryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChallengeEntryVote_pkey" PRIMARY KEY ("entryId","userId")
);

CREATE INDEX IF NOT EXISTS "Follow_followingId_idx" ON "Follow"("followingId");
CREATE INDEX IF NOT EXISTS "Friendship_friendId_idx" ON "Friendship"("friendId");
CREATE INDEX IF NOT EXISTS "UserBlock_blockedUserId_idx" ON "UserBlock"("blockedUserId");
CREATE INDEX IF NOT EXISTS "UserMute_mutedUserId_idx" ON "UserMute"("mutedUserId");
CREATE INDEX IF NOT EXISTS "SavedPost_postId_idx" ON "SavedPost"("postId");
CREATE INDEX IF NOT EXISTS "PostLike_userId_idx" ON "PostLike"("userId");
CREATE INDEX IF NOT EXISTS "CommentLike_userId_idx" ON "CommentLike"("userId");
CREATE INDEX IF NOT EXISTS "PostTag_tag_idx" ON "PostTag"("tag");
CREATE INDEX IF NOT EXISTS "GroupMember_userId_idx" ON "GroupMember"("userId");
CREATE INDEX IF NOT EXISTS "EventAttendee_userId_idx" ON "EventAttendee"("userId");
CREATE INDEX IF NOT EXISTS "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");
CREATE INDEX IF NOT EXISTS "ListingSave_userId_idx" ON "ListingSave"("userId");
CREATE INDEX IF NOT EXISTS "ChallengeEntryVote_userId_idx" ON "ChallengeEntryVote"("userId");

ALTER TABLE "Follow" DROP CONSTRAINT IF EXISTS "Follow_followerId_fkey";
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Follow" DROP CONSTRAINT IF EXISTS "Follow_followingId_fkey";
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Friendship" DROP CONSTRAINT IF EXISTS "Friendship_userId_fkey";
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Friendship" DROP CONSTRAINT IF EXISTS "Friendship_friendId_fkey";
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserBlock" DROP CONSTRAINT IF EXISTS "UserBlock_userId_fkey";
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBlock" DROP CONSTRAINT IF EXISTS "UserBlock_blockedUserId_fkey";
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedUserId_fkey" FOREIGN KEY ("blockedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserMute" DROP CONSTRAINT IF EXISTS "UserMute_userId_fkey";
ALTER TABLE "UserMute" ADD CONSTRAINT "UserMute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserMute" DROP CONSTRAINT IF EXISTS "UserMute_mutedUserId_fkey";
ALTER TABLE "UserMute" ADD CONSTRAINT "UserMute_mutedUserId_fkey" FOREIGN KEY ("mutedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SavedPost" DROP CONSTRAINT IF EXISTS "SavedPost_userId_fkey";
ALTER TABLE "SavedPost" ADD CONSTRAINT "SavedPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedPost" DROP CONSTRAINT IF EXISTS "SavedPost_postId_fkey";
ALTER TABLE "SavedPost" ADD CONSTRAINT "SavedPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostLike" DROP CONSTRAINT IF EXISTS "PostLike_postId_fkey";
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostLike" DROP CONSTRAINT IF EXISTS "PostLike_userId_fkey";
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommentLike" DROP CONSTRAINT IF EXISTS "CommentLike_commentId_fkey";
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommentLike" DROP CONSTRAINT IF EXISTS "CommentLike_userId_fkey";
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostTag" DROP CONSTRAINT IF EXISTS "PostTag_postId_fkey";
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupMember" DROP CONSTRAINT IF EXISTS "GroupMember_groupId_fkey";
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupMember" DROP CONSTRAINT IF EXISTS "GroupMember_userId_fkey";
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventAttendee" DROP CONSTRAINT IF EXISTS "EventAttendee_eventId_fkey";
ALTER TABLE "EventAttendee" ADD CONSTRAINT "EventAttendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventAttendee" DROP CONSTRAINT IF EXISTS "EventAttendee_userId_fkey";
ALTER TABLE "EventAttendee" ADD CONSTRAINT "EventAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationParticipant" DROP CONSTRAINT IF EXISTS "ConversationParticipant_conversationId_fkey";
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationParticipant" DROP CONSTRAINT IF EXISTS "ConversationParticipant_userId_fkey";
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ListingSave" DROP CONSTRAINT IF EXISTS "ListingSave_listingId_fkey";
ALTER TABLE "ListingSave" ADD CONSTRAINT "ListingSave_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketplaceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingSave" DROP CONSTRAINT IF EXISTS "ListingSave_userId_fkey";
ALTER TABLE "ListingSave" ADD CONSTRAINT "ListingSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChallengeEntryVote" DROP CONSTRAINT IF EXISTS "ChallengeEntryVote_entryId_fkey";
ALTER TABLE "ChallengeEntryVote" ADD CONSTRAINT "ChallengeEntryVote_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ChallengeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChallengeEntryVote" DROP CONSTRAINT IF EXISTS "ChallengeEntryVote_userId_fkey";
ALTER TABLE "ChallengeEntryVote" ADD CONSTRAINT "ChallengeEntryVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from existing JSON columns. Invalid ids are skipped by the FK checks above
-- because we only insert ids that already exist.

INSERT INTO "Follow" ("followerId", "followingId", "createdAt")
SELECT u."id", j.value, CURRENT_TIMESTAMP
FROM "User" u
CROSS JOIN LATERAL json_array_elements_text(u."following"::json) AS j(value)
WHERE j.value IN (SELECT "id" FROM "User") AND j.value <> u."id"
ON CONFLICT DO NOTHING;

INSERT INTO "Follow" ("followerId", "followingId", "createdAt")
SELECT j.value, u."id", CURRENT_TIMESTAMP
FROM "User" u
CROSS JOIN LATERAL json_array_elements_text(u."followers"::json) AS j(value)
WHERE j.value IN (SELECT "id" FROM "User") AND j.value <> u."id"
ON CONFLICT DO NOTHING;

INSERT INTO "Friendship" ("userId", "friendId", "createdAt")
SELECT u."id", j.value, CURRENT_TIMESTAMP
FROM "User" u
CROSS JOIN LATERAL json_array_elements_text(u."friends"::json) AS j(value)
WHERE j.value IN (SELECT "id" FROM "User") AND j.value <> u."id"
ON CONFLICT DO NOTHING;

INSERT INTO "UserBlock" ("userId", "blockedUserId", "createdAt")
SELECT u."id", j.value, CURRENT_TIMESTAMP
FROM "User" u
CROSS JOIN LATERAL json_array_elements_text(u."blockedUsers"::json) AS j(value)
WHERE j.value IN (SELECT "id" FROM "User") AND j.value <> u."id"
ON CONFLICT DO NOTHING;

INSERT INTO "UserMute" ("userId", "mutedUserId", "createdAt")
SELECT u."id", j.value, CURRENT_TIMESTAMP
FROM "User" u
CROSS JOIN LATERAL json_array_elements_text(u."mutedUsers"::json) AS j(value)
WHERE j.value IN (SELECT "id" FROM "User") AND j.value <> u."id"
ON CONFLICT DO NOTHING;

INSERT INTO "SavedPost" ("userId", "postId", "createdAt")
SELECT u."id", j.value, CURRENT_TIMESTAMP
FROM "User" u
CROSS JOIN LATERAL json_array_elements_text(u."savedPosts"::json) AS j(value)
WHERE j.value IN (SELECT "id" FROM "Post")
ON CONFLICT DO NOTHING;

INSERT INTO "PostLike" ("postId", "userId", "createdAt")
SELECT p."id", j.value, CURRENT_TIMESTAMP
FROM "Post" p
CROSS JOIN LATERAL json_array_elements_text(p."likes"::json) AS j(value)
WHERE j.value IN (SELECT "id" FROM "User")
ON CONFLICT DO NOTHING;

INSERT INTO "CommentLike" ("commentId", "userId", "createdAt")
SELECT c."id", j.value, CURRENT_TIMESTAMP
FROM "Comment" c
CROSS JOIN LATERAL json_array_elements_text(c."likes"::json) AS j(value)
WHERE j.value IN (SELECT "id" FROM "User")
ON CONFLICT DO NOTHING;

INSERT INTO "PostTag" ("postId", "tag", "createdAt")
SELECT p."id", lower(j.value), CURRENT_TIMESTAMP
FROM "Post" p
CROSS JOIN LATERAL json_array_elements_text(p."tags"::json) AS j(value)
WHERE length(j.value) > 0
ON CONFLICT DO NOTHING;

INSERT INTO "GroupMember" ("groupId", "userId", "createdAt")
SELECT g."id", j.value, CURRENT_TIMESTAMP
FROM "Group" g
CROSS JOIN LATERAL json_array_elements_text(g."memberIds"::json) AS j(value)
WHERE j.value IN (SELECT "id" FROM "User")
ON CONFLICT DO NOTHING;

INSERT INTO "EventAttendee" ("eventId", "userId", "createdAt")
SELECT e."id", j.value, CURRENT_TIMESTAMP
FROM "Event" e
CROSS JOIN LATERAL json_array_elements_text(e."attendeeIds"::json) AS j(value)
WHERE j.value IN (SELECT "id" FROM "User")
ON CONFLICT DO NOTHING;

INSERT INTO "ConversationParticipant" ("conversationId", "userId", "createdAt")
SELECT c."id", j.value, CURRENT_TIMESTAMP
FROM "Conversation" c
CROSS JOIN LATERAL json_array_elements_text(c."participantIds"::json) AS j(value)
WHERE j.value IN (SELECT "id" FROM "User")
ON CONFLICT DO NOTHING;

INSERT INTO "ListingSave" ("listingId", "userId", "createdAt")
SELECT l."id", j.value, CURRENT_TIMESTAMP
FROM "MarketplaceListing" l
CROSS JOIN LATERAL json_array_elements_text(l."saves"::json) AS j(value)
WHERE j.value IN (SELECT "id" FROM "User")
ON CONFLICT DO NOTHING;

INSERT INTO "ChallengeEntryVote" ("entryId", "userId", "createdAt")
SELECT e."id", j.value, CURRENT_TIMESTAMP
FROM "ChallengeEntry" e
CROSS JOIN LATERAL json_array_elements_text(e."votes"::json) AS j(value)
WHERE j.value IN (SELECT "id" FROM "User")
ON CONFLICT DO NOTHING;
