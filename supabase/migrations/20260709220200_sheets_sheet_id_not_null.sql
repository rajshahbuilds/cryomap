-- Tighten components.sheet_id / connections.sheet_id to NOT NULL
--
-- ⚠️  APPLY THIS LAST. It is the "contract" half of expand/contract, and it is
-- only safe once *every* deployed bundle writes `sheet_id` on insert. Applying
-- it while the pre-sheets bundle is still serving traffic breaks every
-- component and connection insert.
--
-- Order of operations for production:
--   1. 20260709220000_sheets.sql          (nullable column, empty table)
--   2. 20260709220100_sheets_backfill.sql (backfill; safe to replay)
--   3. deploy the sheet-aware bundle      (room-temp branch merges to main)
--   4. this migration
--
-- Between 2 and 4 the database tolerates both bundles, which is the whole point.

-- Fail loudly rather than half-applying if the backfill left orphans behind.
do $$
declare
  orphan_components integer;
  orphan_connections integer;
begin
  select count(*) into orphan_components
    from public.components where sheet_id is null;
  select count(*) into orphan_connections
    from public.connections where sheet_id is null;

  if orphan_components > 0 or orphan_connections > 0 then
    raise exception
      'refusing to set NOT NULL: % component(s) and % connection(s) still have a null sheet_id. Re-run the backfill, or delete the orphans.',
      orphan_components, orphan_connections;
  end if;
end $$;

alter table public.components alter column sheet_id set not null;
alter table public.connections alter column sheet_id set not null;
