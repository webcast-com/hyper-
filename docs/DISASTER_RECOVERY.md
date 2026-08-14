# Disaster Recovery Runbook

Creator Connect supports two complementary backup types:

1. **Postgres SQL backups** — best for full production database recovery.
2. **App-level JSON exports** — portable logical exports for migrations, audits, and emergency recovery.

## Backup types

### SQL backup

Use this for production Postgres snapshots:

```bash
DATABASE_URL="postgresql://..." scripts/backup-postgres.sh
```

Restore:

```bash
DATABASE_URL="postgresql://..." scripts/restore-postgres.sh backups/creator-connect-YYYYMMDD-HHMMSS.sql
```

### App-level JSON export

Use this for portable exports through the running app:

```bash
APP_URL="https://your-domain.com" \
CRON_SECRET="your-cron-secret" \
npm run data:export
```

Secret-bearing export, only for secure encrypted storage:

```bash
INCLUDE_SECRETS=true \
APP_URL="https://your-domain.com" \
CRON_SECRET="your-cron-secret" \
npm run data:export
```

By default, JSON exports redact password hashes and auth tokens.

## Restore app-level JSON export

For non-production/local restore:

```bash
DATABASE_URL="postgresql://creator:creator_password_change_me@localhost:5432/creator_connect?schema=public" npm run data:import -- backups/export.json
```

For production restore, explicit confirmation is required:

```bash
ALLOW_DATA_IMPORT=true \
DATABASE_URL="postgresql://..." \
npm run data:import -- backups/export.json
```

## Recommended backup schedule

Example cron schedule:

```cron
# SQL backup every 6 hours
0 */6 * * * cd /app && DATABASE_URL="postgresql://..." scripts/backup-postgres.sh

# App-level export daily
15 2 * * * cd /app && APP_URL="https://your-domain.com" CRON_SECRET="..." npm run data:export

# Prune backups daily, retaining 30 days
30 3 * * * cd /app && BACKUP_RETENTION_DAYS=30 npm run backups:prune
```

## Backup retention

Dry run:

```bash
DRY_RUN=true BACKUP_RETENTION_DAYS=30 npm run backups:prune
```

Delete old backups:

```bash
BACKUP_RETENTION_DAYS=30 npm run backups:prune
```

The prune script deletes old `.json` and `.sql` files from `BACKUP_DIR`.

## Recovery checklist

1. Identify incident start time.
2. Stop write traffic if data corruption is ongoing.
3. Take a fresh backup of current broken state for forensics.
4. Choose restore source:
   - SQL backup for full database rollback.
   - JSON export for logical data restore/migration.
5. Restore into a staging database first.
6. Run health checks:
   ```bash
   curl https://staging.example.com/api/health
   ```
7. Run smoke tests:
   ```bash
   APP_URL=https://staging.example.com npm run smoke
   ```
8. Promote restored database to production.
9. Run maintenance:
   ```bash
   curl -X POST -H "x-cron-secret: $CRON_SECRET" https://your-domain.com/api/admin/maintenance
   ```
10. Review `/admin` audit log and system health.

## Security notes

- Store SQL backups and secret-bearing JSON exports in encrypted storage.
- Limit access to `CRON_SECRET`.
- Rotate `CRON_SECRET` after any incident.
- Prefer non-secret JSON exports for routine portability.
- Do not run `ALLOW_DATA_IMPORT=true` unless you are intentionally restoring data.
