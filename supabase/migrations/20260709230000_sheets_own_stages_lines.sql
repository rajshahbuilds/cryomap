-- Move stages and lines from fridge-scoped to sheet-scoped
--
-- A fridge may now hold more than one fridge-wiring sheet — e.g. an input chain
-- and an output chain of the same cryostat, each with its own temperature bands
-- and trunk lines. That requires two changes:
--
--   1. `stages` and `lines` gain a `sheet_id`, so each fridge sheet owns its own.
--   2. The "at most one fridge sheet per fridge" unique index is dropped.
--
-- Expand half of expand/contract: `sheet_id` is nullable here and tightened in
-- 20260709230100, which must not run until the sheet-aware bundle is deployed.
-- A null `sheet_id` means "pre-sheets", which the app reads as fridge wiring.

alter table public.stages
  add column sheet_id uuid references public.sheets (id) on delete cascade;

alter table public.lines
  add column sheet_id uuid references public.sheets (id) on delete cascade;

-- Everything that exists today belongs to its fridge's one fridge sheet, which
-- 20260709220100 created. Replayable: the null guard makes a second run a no-op.
update public.stages s
   set sheet_id = sh.id
  from public.sheets sh
 where sh.fridge_id = s.fridge_id
   and sh.kind = 'fridge'
   and s.sheet_id is null;

update public.lines l
   set sheet_id = sh.id
  from public.sheets sh
 where sh.fridge_id = l.fridge_id
   and sh.kind = 'fridge'
   and l.sheet_id is null;

create index stages_sheet_id_idx on public.stages (sheet_id);
create index lines_sheet_id_idx on public.lines (sheet_id);

-- Multiple fridge sheets per fridge are now the point.
drop index if exists public.sheets_one_fridge_kind_idx;

do $$
declare
  orphan_stages integer;
  orphan_lines integer;
begin
  select count(*) into orphan_stages from public.stages where sheet_id is null;
  select count(*) into orphan_lines from public.lines where sheet_id is null;

  if orphan_stages > 0 or orphan_lines > 0 then
    raise warning
      'backfill left % stage(s) and % line(s) with a null sheet_id — their fridge has no fridge sheet. Run 20260709220100 first.',
      orphan_stages, orphan_lines;
  end if;
end $$;
