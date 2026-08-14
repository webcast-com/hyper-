# Creator Connect Deployment Guide

## Production runtime

Prisma is the primary backend runtime.

Required environment variables:

```env
DATA_DRIVER="prisma"
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
SESSION_SECRET="a-long-random-secret"
CRON_SECRET="a-random-cron-secret"
APP_URL="https://your-domain.com"
```

Recommended media settings:

```env
MEDIA_PROVIDER="cloudinary"
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_UPLOAD_PRESET="your-unsigned-upload-preset"
CLOUDINARY_FOLDER="creator-connect"
```

## Local Docker Compose

The Compose setup uses Postgres and runs Prisma migrations before starting the app.

```bash
docker compose up --build
```

Open:

```text
http://localhost:3000
```

Health check:

```bash
curl http://localhost:3000/api/health
```

## First production setup

Use the Postgres Prisma schema and migration files in production:

```bash
npm ci
npm run prisma:generate:postgres
npm run migrate:deploy
npm run bootstrap:admin
npm run build
npm start
```

Do **not** use `prisma db push` for production schema changes. Do not seed demo JSON data in production unless `ALLOW_DEMO_SEED=true` is intentionally set. Use migrations and deploy them with:

```bash
npm run migrate:deploy
```


## Migration workflow

This project keeps two Prisma schemas:

- `prisma/schema.prisma` — Postgres schema. This is the default schema used by `prisma generate`, `prisma migrate deploy`, and all deploys.
- `prisma/schema.sqlite.prisma` — optional SQLite schema for lightweight local development only (never used in deploys).

The initial Postgres migration is stored in:

```text
prisma/migrations/0001_init_postgres/migration.sql
```

For future production schema changes:

1. Update both Prisma schemas if the model shape changes.
2. Generate a migration against the Postgres schema in a development Postgres database.
3. Commit the migration folder.
4. Deploy with `npm run migrate:deploy`.

Example with a dev Postgres database:

```bash
DATABASE_URL="postgresql://..." npx prisma migrate dev --name your_change
```


## Admin bootstrap

Production should not rely on demo accounts. Create the first owner account with environment variables:

```env
ADMIN_EMAIL="owner@your-domain.com"
ADMIN_PASSWORD="a-strong-password"
ADMIN_NAME="Platform Owner"
ADMIN_USERNAME="owner"
```

Run:

```bash
npm run bootstrap:admin
```

Behavior:

- If no users exist, it creates the first owner/admin/moderator/user account.
- If users already exist, it safely skips by default.
- Set `ADMIN_BOOTSTRAP_FORCE=true` to upsert the configured admin.
- Set `ADMIN_PASSWORD_ROTATE=true` only when intentionally rotating the existing admin password.

## Maintenance cron

Call daily/hourly from your scheduler:

```bash
curl -X POST -H "x-cron-secret: $CRON_SECRET" https://your-domain.com/api/admin/maintenance
```

Dry run:

```bash
curl -X POST -H "x-cron-secret: $CRON_SECRET" "https://your-domain.com/api/admin/maintenance?dryRun=true"
```

## Backups

Install Postgres client tools, then:

```bash
DATABASE_URL="postgresql://..." scripts/backup-postgres.sh
```

Restore:

```bash
DATABASE_URL="postgresql://..." scripts/restore-postgres.sh backups/file.sql
```

## Production notes

- Use Postgres, not SQLite, in production.
- Use Cloudinary/S3/R2 for media instead of local uploads.
- Replace in-memory rate limiting with Redis/Upstash.
- Set strong `SESSION_SECRET` and `CRON_SECRET`.
- Run maintenance on a schedule.
- Configure monitoring and error tracking.
