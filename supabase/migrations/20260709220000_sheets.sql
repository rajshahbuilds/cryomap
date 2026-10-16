-- Sheets: a named canvas belonging to a fridge
--
-- A fridge grows from "one diagram" into "a set of sheets". Exactly one sheet
-- has kind='fridge' (it owns the stages and lines); any number have
-- kind='room_temp' (bench instrumentation, drawn left→right).
--
-- Deliberately NOT sheet-scoped:
--   * stages/lines           — only ever exist on the single fridge sheet
--   * custom_component_defs  — shared across a fridge's sheets by design
--
-- This migration is additive and NON-BREAKING: `sheet_id` is nullable so the
-- currently-deployed bundle, which knows nothing about sheets, keeps inserting
-- rows successfully. The backfill lands in the next migration; NOT NULL is
-- tightened in a third, only once the sheet-aware code is deployed everywhere.
-- Collapsing those steps would leave a window where the old bundle is still
-- serving and inserting rows without a sheet_id.

-- sheets ---------------------------------------------------------------------
create table public.sheets (
  id uuid primary key default gen_random_uuid(),
  fridge_id uuid not null references public.fridges (id) on delete cascade,
  kind text not null default 'room_temp',
  name text not null,
  sort_order integer not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint sheets_kind_check check (kind in ('fridge', 'room_temp'))
);

alter table public.sheets enable row level security;

create index sheets_fridge_id_idx on public.sheets (fridge_id);

-- At most one fridge-wiring sheet per fridge. Partial, so room_temp sheets are
-- unconstrained.
create unique index sheets_one_fridge_kind_idx
  on public.sheets (fridge_id) where kind = 'fridge';

-- RLS: same workspace scoping as every other fridge-child table.
create policy "sheets: members read" on public.sheets for select to authenticated
  using (public.can_read_fridge(fridge_id));
create policy "sheets: editors insert" on public.sheets for insert to authenticated
  with check (public.can_edit_fridge(fridge_id));
create policy "sheets: editors update" on public.sheets for update to authenticated
  using (public.can_edit_fridge(fridge_id))
  with check (public.can_edit_fridge(fridge_id));
create policy "sheets: editors delete" on public.sheets for delete to authenticated
  using (public.can_edit_fridge(fridge_id));

-- components.sheet_id / connections.sheet_id ---------------------------------
-- Nullable for now (see header). Backfilled next; tightened last.
alter table public.components
  add column sheet_id uuid references public.sheets (id) on delete cascade;

alter table public.connections
  add column sheet_id uuid references public.sheets (id) on delete cascade;

create index components_sheet_id_idx on public.components (sheet_id);
create index connections_sheet_id_idx on public.connections (sheet_id);
