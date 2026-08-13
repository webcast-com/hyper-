#!/usr/bin/env sh
set -eu
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${1:?Usage: scripts/restore-postgres.sh path/to/backup.sql}"
psql "$DATABASE_URL" < "$1"
echo "Restored $1"
