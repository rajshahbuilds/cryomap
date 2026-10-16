-- Workspace RLS: helper functions + new-table policies
--
-- Scope: this migration covers ONLY the new collaboration tables. The existing
-- tables (fridges/stages/lines/components/connections/custom_component_defs/
-- versions/locks) keep their permissive `using (true)` policies for now — the
-- strict, workspace-scoped flip for those is authored and applied in a later migration,
-- once the app creates workspace memberships. Flipping them before that would
-- lock the live app out of all its data.

-- Membership helpers -------------------------------------------------------
-- SECURITY DEFINER so they can read workspace_members without tripping that
-- table's own RLS (which would otherwise recurse when a policy calls these).
-- Pinned search_path; everything schema-qualified.
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

create or replace function public.member_role(ws uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.workspace_members
  where workspace_id = ws and user_id = auth.uid();
$$;

-- workspaces ---------------------------------------------------------------
create policy "workspaces: members read"
  on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));

create policy "workspaces: owner creates"
  on public.workspaces for insert to authenticated
  with check (created_by = auth.uid());

create policy "workspaces: admins update"
  on public.workspaces for update to authenticated
  using (public.member_role(id) = 'admin')
  with check (public.member_role(id) = 'admin');

create policy "workspaces: admins delete"
  on public.workspaces for delete to authenticated
  using (public.member_role(id) = 'admin');

-- workspace_members --------------------------------------------------------
create policy "workspace_members: members read"
  on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "workspace_members: admins add"
  on public.workspace_members for insert to authenticated
  with check (public.member_role(workspace_id) = 'admin');

create policy "workspace_members: admins update roles"
  on public.workspace_members for update to authenticated
  using (public.member_role(workspace_id) = 'admin')
  with check (public.member_role(workspace_id) = 'admin');

-- Admins remove anyone; any member may remove themselves (leave).
create policy "workspace_members: admins remove or self-leave"
  on public.workspace_members for delete to authenticated
  using (
    public.member_role(workspace_id) = 'admin' or user_id = auth.uid()
  );

-- workspace_invites --------------------------------------------------------
-- Admin-only across the board. Non-members redeem via redeem_invite(),
-- which is SECURITY DEFINER and never needs SELECT here.
create policy "workspace_invites: admins read"
  on public.workspace_invites for select to authenticated
  using (public.member_role(workspace_id) = 'admin');

create policy "workspace_invites: admins create"
  on public.workspace_invites for insert to authenticated
  with check (public.member_role(workspace_id) = 'admin');

create policy "workspace_invites: admins update"
  on public.workspace_invites for update to authenticated
  using (public.member_role(workspace_id) = 'admin')
  with check (public.member_role(workspace_id) = 'admin');

create policy "workspace_invites: admins delete"
  on public.workspace_invites for delete to authenticated
  using (public.member_role(workspace_id) = 'admin');
