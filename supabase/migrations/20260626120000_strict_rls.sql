-- Strict workspace-scoped RLS — the flip
--
-- Replaces the permissive `using (true)` MVP policies on the diagram tables with
-- workspace-scoped, role-aware ones: members of a fridge's workspace may read;
-- editors+ may write. The new collaboration tables were already strict;
-- this is the existing-table flip that was deliberately deferred until the app
-- creates workspace memberships.
--
-- Prereq (run on prod before this): every fridge has a workspace_id (a legacy
-- orphan was backfilled into its workspace). `fridges.workspace_id` is set NOT
-- NULL in the follow-up migration, after access is verified.

-- Fridge-scoped helpers. SECURITY DEFINER so the workspace lookup bypasses the
-- fridges RLS being defined here (no recursion).
create or replace function public.can_read_fridge(fid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_workspace_member(
    (select workspace_id from public.fridges where id = fid)
  );
$$;

create or replace function public.can_edit_fridge(fid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.member_role(
    (select workspace_id from public.fridges where id = fid)
  ) in ('admin', 'editor');
$$;

-- fridges -------------------------------------------------------------------
drop policy "fridges: authenticated full access" on public.fridges;
create policy "fridges: members read" on public.fridges for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy "fridges: editors insert" on public.fridges for insert to authenticated
  with check (public.member_role(workspace_id) in ('admin', 'editor'));
create policy "fridges: editors update" on public.fridges for update to authenticated
  using (public.member_role(workspace_id) in ('admin', 'editor'))
  with check (public.member_role(workspace_id) in ('admin', 'editor'));
create policy "fridges: editors delete" on public.fridges for delete to authenticated
  using (public.member_role(workspace_id) in ('admin', 'editor'));

-- Child tables: scope via their fridge's workspace -------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'stages', 'lines', 'components', 'connections',
    'custom_component_defs', 'versions', 'locks'
  ] loop
    execute format('drop policy %I on public.%I',
      t || ': authenticated full access', t);
    execute format($f$create policy %I on public.%I for select to authenticated
      using (public.can_read_fridge(fridge_id))$f$, t || ': members read', t);
    execute format($f$create policy %I on public.%I for insert to authenticated
      with check (public.can_edit_fridge(fridge_id))$f$, t || ': editors insert', t);
    execute format($f$create policy %I on public.%I for update to authenticated
      using (public.can_edit_fridge(fridge_id))
      with check (public.can_edit_fridge(fridge_id))$f$, t || ': editors update', t);
    execute format($f$create policy %I on public.%I for delete to authenticated
      using (public.can_edit_fridge(fridge_id))$f$, t || ': editors delete', t);
  end loop;
end $$;
