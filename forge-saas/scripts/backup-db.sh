#!/usr/bin/env bash
#
# Take a full backup of the FORGE Supabase database.
#
# The free tier has no automated backups, so this is the only copy that exists
# besides production itself. Run it before any schema change, and on a regular
# cadence otherwise.
#
#   ./scripts/backup-db.sh
#
# Needs SUPABASE_DB_URL — the direct Postgres connection string, which is NOT
# the same as NEXT_PUBLIC_SUPABASE_URL. Get it from:
#   Supabase dashboard -> Project Settings -> Database -> Connection string -> URI
#
# Put it in .env.local (already gitignored) as:
#   SUPABASE_DB_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres
#
# See docs/backups.md for restore instructions and what this does and does not
# cover.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${ROOT}/backups"

# Load .env.local without echoing anything in it.
if [[ -f "${ROOT}/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  . "${ROOT}/.env.local"
  set +a
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  cat >&2 <<'MSG'
SUPABASE_DB_URL is not set.

This is the direct Postgres connection string, not the API URL. Find it at:
  Supabase dashboard -> Project Settings -> Database -> Connection string -> URI

Then add it to .env.local:
  SUPABASE_DB_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres

.env.local is gitignored, so it will not be committed.
MSG
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  cat >&2 <<'MSG'
pg_dump is not installed.

  macOS:          brew install libpq && brew link --force libpq
  Debian/Ubuntu:  sudo apt-get install postgresql-client
  Windows:        install PostgreSQL, or use WSL

Alternative without pg_dump: the Supabase CLI can do this too —
  npx supabase db dump --db-url "$SUPABASE_DB_URL" -f backup.sql
MSG
  exit 1
fi

mkdir -p "${OUT_DIR}"
STAMP="$(date -u +%Y-%m-%d-%H%M)"
OUT_FILE="${OUT_DIR}/forge-${STAMP}.sql.gz"

echo "Dumping database…"

# Dump the schemas we own. Supabase's internal schemas (storage, realtime,
# extensions, vault) are managed by Supabase and are not ours to restore, but
# `auth` IS included on purpose: profiles.id references auth.users(id), so a
# public-only dump could not be restored without orphaning every row.
pg_dump "${SUPABASE_DB_URL}" \
  --schema=public \
  --schema=auth \
  --no-owner \
  --no-privileges \
  --quote-all-identifiers \
  | gzip > "${OUT_FILE}"

SIZE_BYTES="$(wc -c < "${OUT_FILE}" | tr -d ' ')"

# A dump that came back nearly empty means something failed quietly — better to
# fail loudly now than to discover it when the backup is needed.
if [[ "${SIZE_BYTES}" -lt 10240 ]]; then
  echo "ERROR: the dump is only ${SIZE_BYTES} bytes, which is too small to be real." >&2
  echo "Not treating this as a valid backup. Check the connection string and try again." >&2
  exit 1
fi

echo
echo "Backup written:"
echo "  ${OUT_FILE}  ($(du -h "${OUT_FILE}" | cut -f1))"
echo
cat <<'MSG'
This file contains real user data — email addresses, health metrics and cycle
tracking entries. Treat it accordingly:

  * backups/ is gitignored. Never commit it, and never attach it to an issue.
  * Copy it somewhere durable. A backup that only exists on the machine that
    made it is not a backup.
  * Delete old copies you no longer need. Data you do not keep cannot leak.
MSG
