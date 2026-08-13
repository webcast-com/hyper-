# Creator Connect

A full-stack Next.js MVP for a creator-focused social media platform.

## Features

- Email/password registration and login
- Email verification and password reset with token-based auth links
- Transactional email provider abstraction with console dev mail and Resend production support
- Secure HTTP-only session cookies
- Creator profiles with avatar, bio, niche, and website
- Dedicated public profile pages at `/u/[username]`
- Facebook-style stories that expire after 24 hours
- Feed with text posts, polls, uploaded images or optional image URLs, post privacy controls, feed filters, tags, likes, emoji reactions, shares, and comments
- Image upload API with provider abstraction: local fallback plus Cloudinary unsigned-upload support
- Discover creators
- Follow/unfollow creators
- Facebook-style friends with friend requests, accept/decline, suggestions, and remove-friend API
- Notifications for likes, comments, follows, friend requests, and accepted friend requests
- Explore/Trending page at `/explore`
- Infinite feed pagination and multi-mode feed filters
- Account safety controls: mute users, block users, block-aware feed and interaction protection
- Account settings for default post privacy, discoverability, message permissions, and notification preferences
- Creator analytics dashboard at `/analytics`
- Creator challenges at `/challenges` with submissions and community voting
- Creator marketplace at `/marketplace` for services, digital products, and collaborations
- Admin moderation dashboard at `/admin` with audit-log, feature-flag, moderation, and role-management panels
- PWA install support and mobile bottom navigation
- Invite/referral system
- Saved items library
- @mentions, clickable hashtags, nested comments, and comment likes
- Dedicated group pages and event hubs
- Direct messages with unread badges
- Zod request validation for high-risk write APIs
- Automated Vitest unit tests for validation schemas, permissions, and rate limiting
- API versioning with `/api/v1/*` aliases and version/deprecation headers
- Webhook integration system with delivery tracking, signing, and retry controls
- API rate limiting with Upstash Redis support and in-memory fallback, plus security headers
- Admin/cron maintenance jobs for expired stories, old read notifications, old audit logs, and orphaned local media
- **Prisma is now the primary runtime backend**
- Prisma-backed media asset records for uploads
- Feature flags for runtime control of registration, marketplace, challenges, webhooks, and media uploads
- Automated content moderation rules and flags for posts, comments, messages, and marketplace listings
- Role-based access control with roles: user, moderator, admin, owner
- Prisma-backed audit logs for auth, reports, admin actions, role changes, uploads, profile/settings changes, and safety controls
- Legacy JSON mode is still available for local/demo fallback with `DATA_DRIVER=json`

## Run locally with Prisma backend

```bash
cd creator-connect
npm install
cp .env.example .env
npm run db:setup
npm run dev
```

Open http://localhost:3000

`.env.example` defaults to:

```env
DATABASE_URL="file:./dev.db"
DATA_DRIVER="prisma"
```

## Legacy JSON mode

JSON mode remains available only as a quick local/demo fallback:

```bash
DATA_DRIVER=json npm run dev
# or
npm run dev:json
```

JSON mode uses:

```text
data/db.json
```

## Useful routes

- `/` — main feed
- `/explore` — trending/discovery
- `/marketplace` — creator monetization marketplace
- `/challenges` — creator challenges
- `/messages` — direct messages
- `/analytics` — creator analytics
- `/admin` — admin moderation dashboard
- `/settings` — account settings
- `/saved` — saved items
- `/invite` — referral dashboard
- `/u/mayamakes` — example public profile
- `/groups/grp_design` — example group
- `/events/evt_walk` — example event
- `/tags/design` — example hashtag page
- `/api-docs` — human-readable API docs
- `/api/v1/health` — versioned API health check

## Prisma backend

The active backend is Prisma when `DATA_DRIVER=prisma`. The full Prisma schema is in:

```text
prisma/schema.prisma
```

It covers users, posts, comments, messages, notifications, groups, events, challenges, marketplace, reports, referrals, settings, safety controls, and saved items.

Useful commands:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
npm run db:seed
npm run db:setup
npm run bootstrap:admin # production only; local demo DB already has seeded accounts
npm run test
npm run smoke
npm run maintenance
npm run data:export
npm run data:import -- backups/export.json
npm run backups:prune
npm run scripts:check
```

Maintenance can also be triggered by an admin session or cron secret:

```bash
curl -X POST http://localhost:3000/api/admin/maintenance?dryRun=true
curl -X POST -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/admin/maintenance
```

`db:setup` creates/syncs the SQLite database and seeds it from `data/db.json`:

```bash
npm run db:setup
```

For production Postgres, use the dedicated schema and migrations:

```bash
npm run prisma:generate:postgres
npm run migrate:deploy
```

Production schema:

```text
prisma/schema.postgres.prisma
```

Initial Postgres migration:

```text
prisma/migrations/0001_init_postgres/migration.sql
```

See `docs/DEPLOYMENT.md` for the safe migration workflow.

## Demo accounts

Seeded login accounts:

- Admin/design: `maya@example.com` / `password123` / `@mayamakes`
- Music: `zuri@example.com` / `password123` / `@zuribeats`
- Photography: `leo@example.com` / `password123` / `@leoframes`

## Production notes

Production admin bootstrap uses `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, and `ADMIN_USERNAME`. Run `npm run bootstrap:admin` after migrations. Demo JSON seeding is blocked in production unless `ALLOW_DEMO_SEED=true` is intentionally set.

Before production, configure real transactional email with `MAIL_PROVIDER="resend"`, `RESEND_API_KEY`, and `MAIL_FROM`; add monitoring and a production Postgres database. For production rate limiting, set `RATE_LIMIT_DRIVER="auto"` with `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. For production media uploads, set `MEDIA_PROVIDER="cloudinary"` with `CLOUDINARY_CLOUD_NAME` and `CLOUDINARY_UPLOAD_PRESET`, or extend the scaffolded provider abstraction for S3-compatible storage.
