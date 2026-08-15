-- Adds the eight tables that exist in schema.prisma but were missing from
-- 0001_init_postgres: without them any query against these models fails with
-- "relation does not exist", crashing the route with an empty HTTP 500.
--
-- IF NOT EXISTS is used so this migration is safe to apply to a database that
-- was already patched by hand or synced with `prisma db push`.

-- CreateTable
CREATE TABLE IF NOT EXISTS "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "statusCode" INTEGER,
    "response" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FeatureFlag" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ModerationRule" (
    "id" TEXT NOT NULL,
    "phrase" TEXT NOT NULL,
    "targetTypes" TEXT NOT NULL DEFAULT '[]',
    "action" TEXT NOT NULL DEFAULT 'flag',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ModerationFlag" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "actorId" TEXT,
    "excerpt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NotificationDigest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDigest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminMetricSnapshot" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "metrics" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminAlert" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "source" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "AdminAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WebhookEndpoint_active_idx" ON "WebhookEndpoint"("active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WebhookEndpoint_createdAt_idx" ON "WebhookEndpoint"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WebhookDelivery_endpointId_idx" ON "WebhookDelivery"("endpointId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WebhookDelivery_event_idx" ON "WebhookDelivery"("event");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WebhookDelivery_status_idx" ON "WebhookDelivery"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WebhookDelivery_createdAt_idx" ON "WebhookDelivery"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FeatureFlag_enabled_idx" ON "FeatureFlag"("enabled");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ModerationRule_active_idx" ON "ModerationRule"("active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ModerationRule_action_idx" ON "ModerationRule"("action");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ModerationFlag_targetType_idx" ON "ModerationFlag"("targetType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ModerationFlag_targetId_idx" ON "ModerationFlag"("targetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ModerationFlag_actorId_idx" ON "ModerationFlag"("actorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ModerationFlag_status_idx" ON "ModerationFlag"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ModerationFlag_createdAt_idx" ON "ModerationFlag"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationDigest_userId_idx" ON "NotificationDigest"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationDigest_frequency_idx" ON "NotificationDigest"("frequency");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationDigest_status_idx" ON "NotificationDigest"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationDigest_createdAt_idx" ON "NotificationDigest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AdminMetricSnapshot_date_key" ON "AdminMetricSnapshot"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminMetricSnapshot_createdAt_idx" ON "AdminMetricSnapshot"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminAlert_type_idx" ON "AdminAlert"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminAlert_severity_idx" ON "AdminAlert"("severity");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminAlert_status_idx" ON "AdminAlert"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminAlert_createdAt_idx" ON "AdminAlert"("createdAt");

-- AddForeignKey
ALTER TABLE "WebhookDelivery" DROP CONSTRAINT IF EXISTS "WebhookDelivery_endpointId_fkey";
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationFlag" DROP CONSTRAINT IF EXISTS "ModerationFlag_ruleId_fkey";
ALTER TABLE "ModerationFlag" ADD CONSTRAINT "ModerationFlag_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ModerationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
