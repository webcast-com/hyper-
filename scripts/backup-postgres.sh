#!/usr/bin/env sh
set -eu
: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/creator-connect-$(date +%Y%m%d-%H%M%S).sql"
pg_dump "$DATABASE_URL" > "$FILE"
echo "Backup written to $FILE"
