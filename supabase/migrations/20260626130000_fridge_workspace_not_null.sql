-- Tighten fridges.workspace_id to NOT NULL
--
-- Every fridge now belongs to a workspace (created via the scoped flow; the one
-- legacy orphan was backfilled). With strict RLS in place, a null-workspace
-- fridge would be invisible to everyone anyway — so make the invariant explicit.
alter table public.fridges
  alter column workspace_id set not null;
