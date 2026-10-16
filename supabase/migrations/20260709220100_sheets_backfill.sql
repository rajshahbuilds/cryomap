-- Backfill sheets for existing fridges
--
-- Every fridge gets its one kind='fridge' sheet, and every existing component
-- and connection is pointed at it. Idempotent: re-running is a no-op, so it is
-- safe to replay against a database where it partly ran.
--
-- Still additive — `sheet_id` stays nullable here. The NOT NULL tightening is a
-- separate migration, applied only after the sheet-aware bundle is live.

-- One "Fridge wiring" sheet per fridge.
insert into public.sheets (fridge_id, kind, name, sort_order)
select f.id, 'fridge', 'Fridge wiring', 0
from public.fridges f
on conflict do nothing;

-- Point existing rows at their fridge's sheet.
update public.components c
set sheet_id = s.id
from public.sheets s
where s.fridge_id = c.fridge_id
  and s.kind = 'fridge'
  and c.sheet_id is null;

update public.connections x
set sheet_id = s.id
from public.sheets s
where s.fridge_id = x.fridge_id
  and s.kind = 'fridge'
  and x.sheet_id is null;

-- `components.fridge_id` / `connections.fridge_id` are nullable, so a row
-- orphaned from its fridge cannot be assigned a sheet. None are expected. Shout
-- rather than silently leaving rows that would later break the NOT NULL step.
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
    raise warning
      'sheets backfill: % component(s) and % connection(s) have no sheet_id (fridge_id is null). Resolve before the NOT NULL migration.',
      orphan_components, orphan_connections;
  end if;
end $$;
