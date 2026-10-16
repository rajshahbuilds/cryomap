-- create_workspace RPC
--
-- Atomically creates a workspace and makes the caller its first admin. Needed
-- because RLS would otherwise deadlock the bootstrap: you can't insert your own
-- membership until you're an admin, and you can't see the workspace until you're
-- a member. SECURITY DEFINER does both inserts in one transaction as owner.
create or replace function public.create_workspace(workspace_name text)
returns public.workspaces
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_workspace public.workspaces;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.workspaces (name, created_by)
  values (workspace_name, v_uid)
  returning * into v_workspace;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace.id, v_uid, 'admin');

  return v_workspace;
end;
$$;

revoke execute on function public.create_workspace(text) from public, anon;
grant execute on function public.create_workspace(text) to authenticated;
