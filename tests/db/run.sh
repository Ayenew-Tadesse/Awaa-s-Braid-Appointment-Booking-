#!/usr/bin/env bash
# For each SQL test file: a throwaway database with the Supabase stub and every
# migration, then the tests (any failed check aborts). Needs PostgreSQL 15+.
set -eo pipefail
cd "$(dirname "$0")/../.."
DB=${TEST_DB:-awaa_test}
export PGOPTIONS="-c client_min_messages=warning"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)
for test in tests/db/*.test.sql; do
  echo "== $test"
  "${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB"
  "${PSQL[@]}" -d "$DB" -f tests/db/supabase-stub.sql
  for f in supabase/migrations/*.sql; do "${PSQL[@]}" -d "$DB" -f "$f"; done
  PGOPTIONS="" "${PSQL[@]}" -d "$DB" -f "$test" 2>&1 >/dev/null | sed -n "s/.*NOTICE:  //p; /ERROR/p"
done
echo "Database tests passed."
