-- Fridge linking: a room-temperature endpoint points at a fridge line
--
-- The whole point of the project: a `fridge_port` component on a `room_temp`
-- sheet links to a named line on the fridge sheet, so clicking that line can
-- surface the bench chain that drives it. Because sheets live under a fridge,
-- `lines` is already in scope — this is a plain FK, not a cross-document lookup
-- or a match-by-name, so renaming a line keeps the link intact.
--
-- `on delete set null`: deleting a fridge line orphans the endpoint (it renders
-- as unlinked) rather than destroying the bench history it points from.
--
-- Additive column with no existing rows to backfill; no RLS change needed —
-- components are already scoped by can_read_fridge / can_edit_fridge.

alter table public.components
  add column linked_line_id uuid references public.lines (id) on delete set null;

create index components_linked_line_id_idx on public.components (linked_line_id);
