-- Annotations: free-floating text notes on a sheet
--
-- Room-temperature setups change constantly and the lab notebook is full of
-- marginalia — dates, "new part", cross-page references. An annotation is just
-- positioned text belonging to a sheet; it is not attached to any component.
--
-- A fresh table with no existing rows, so both foreign keys are NOT NULL from
-- the start — no expand/contract needed. `fridge_id` is carried (like every
-- other diagram-child table) so RLS reuses can_read_fridge / can_edit_fridge and
-- the row loads via listByFridge alongside components and connections.

create table public.annotations (
  id uuid primary key default gen_random_uuid(),
  fridge_id uuid not null references public.fridges (id) on delete cascade,
  sheet_id uuid not null references public.sheets (id) on delete cascade,
  text text not null default '',
  x_abs integer not null,
  y_abs integer not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.annotations enable row level security;

create index annotations_fridge_id_idx on public.annotations (fridge_id);
create index annotations_sheet_id_idx on public.annotations (sheet_id);

-- RLS: same workspace scoping as every other fridge-child table.
create policy "annotations: members read" on public.annotations for select to authenticated
  using (public.can_read_fridge(fridge_id));
create policy "annotations: editors insert" on public.annotations for insert to authenticated
  with check (public.can_edit_fridge(fridge_id));
create policy "annotations: editors update" on public.annotations for update to authenticated
  using (public.can_edit_fridge(fridge_id))
  with check (public.can_edit_fridge(fridge_id));
create policy "annotations: editors delete" on public.annotations for delete to authenticated
  using (public.can_edit_fridge(fridge_id));
