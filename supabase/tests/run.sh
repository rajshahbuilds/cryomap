#!/usr/bin/env bash
#
# Run CryoMap's tenant-isolation RLS tests against a disposable local Postgres.
#
# Spins up a throwaway Postgres cluster (no Docker, no Supabase CLI), applies the
# Supabase-compatible bootstrap, every migration in supabase/migrations in order,
# the grants finalizer, and finally tenant_isolation.sql. Any failed assertion
# aborts with a non-zero exit (psql ON_ERROR_STOP). The cluster is deleted on
# exit. Requires a local Postgres (initdb/pg_ctl/psql) on PATH — e.g.
# `brew install postgresql@16`.
#
# Usage: supabase/tests/run.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGR="$HERE/../migrations"

# Locate Postgres server binaries even when they're not on PATH (Homebrew keeps
# them keg-only; Debian/Ubuntu put them under /usr/lib/postgresql/<ver>/bin).
if ! command -v initdb >/dev/null 2>&1; then
  for d in /opt/homebrew/opt/postgresql@*/bin /usr/local/opt/postgresql@*/bin \
           /usr/lib/postgresql/*/bin /usr/pgsql-*/bin; do
    [ -x "$d/initdb" ] && PATH="$d:$PATH" && break
  done
fi

for bin in initdb pg_ctl psql createdb; do
  command -v "$bin" >/dev/null 2>&1 || { echo "error: '$bin' not found on PATH (install postgresql)"; exit 2; }
done

TMP="$(mktemp -d)"
PGDATA="$TMP/data"
SOCK="$TMP/sock"
mkdir -p "$SOCK"
export PGHOST="$SOCK"
export PGPORT="${PGPORT:-54399}"
export PGUSER=postgres
export PGDATABASE=cryomap_test

cleanup() {
  pg_ctl -D "$PGDATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

echo "• initializing disposable cluster"
initdb -D "$PGDATA" -U postgres --auth=trust >/dev/null
pg_ctl -D "$PGDATA" -w -o "-p $PGPORT -k $SOCK -c listen_addresses=''" start >/dev/null
createdb -U postgres "$PGDATABASE"

run() { psql -v ON_ERROR_STOP=1 -q -U postgres -d "$PGDATABASE" -f "$1" >/dev/null; }

echo "• applying Supabase-compatible bootstrap"
run "$HERE/_bootstrap.sql"

echo "• applying migrations"
for f in "$MIGR"/*.sql; do run "$f"; done

echo "• applying grants finalizer"
run "$HERE/_grants.sql"

echo "• running tenant-isolation suite"
# Surface the suite's NOTICEs (pass/fail markers) on stderr→stdout.
psql -v ON_ERROR_STOP=1 -q -U postgres -d "$PGDATABASE" -f "$HERE/tenant_isolation.sql" 2>&1

echo "✓ tenant-isolation tests passed"
