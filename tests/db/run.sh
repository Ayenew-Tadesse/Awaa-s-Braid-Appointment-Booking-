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
# The starter salon (supabase/starter-salon.sql): loads on a fresh database, and refuses to run twice.
echo "== supabase/starter-salon.sql"
"${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB"
"${PSQL[@]}" -d "$DB" -f tests/db/supabase-stub.sql
for f in supabase/migrations/*.sql; do "${PSQL[@]}" -d "$DB" -f "$f"; done
"${PSQL[@]}" -d "$DB" -f supabase/starter-salon.sql
PGOPTIONS="" "${PSQL[@]}" -d "$DB" -c "do \$\$ begin
  if (select count(*) from styles) <> 7 or (select count(*) from style_options) <> 26 or (select count(*) from working_hours) <> 6
     or (select timezone || ' ' || currency from salon) <> 'America/New_York USD'
     or (select travel_minutes from salon) <> 60 or (select cardinality(service_zips) from salon) <> 10 then raise exception 'FAILED: starter salon'; end if;
  raise notice 'ok - the starter salon loads: 7 styles, 26 options, one stylist Monday to Saturday, USD and Eastern Time, home visits to ZIP codes 200-209';
end \$\$;" 2>&1 | sed -n "s/.*NOTICE:  //p"
if "${PSQL[@]}" -d "$DB" -f supabase/starter-salon.sql >/dev/null 2>&1; then echo "FAILED: starter salon ran twice"; exit 1; fi
echo "ok - the starter salon refuses to run twice"
echo "Database tests passed."
