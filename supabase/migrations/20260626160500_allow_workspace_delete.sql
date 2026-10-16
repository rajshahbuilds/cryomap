-- Let the last-admin guard yield to a workspace delete
--
-- prevent_last_admin_removal blocks deleting/demoting a workspace's last admin.
-- But deleting the whole workspace cascades to remove that membership, which the
-- guard would (wrongly) block. Skip the guard when the workspace no longer
-- exists — during a cascade the parent row is already gone, so keeping an admin
-- for it is meaningless.
create or replace function public.prevent_last_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace uuid := coalesce(old.workspace_id, new.workspace_id);
  v_admins int;
begin
  if not exists (select 1 from public.workspaces where id = v_workspace) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if (tg_op = 'DELETE' and old.role = 'admin')
     or (tg_op = 'UPDATE' and old.role = 'admin' and new.role <> 'admin') then
    select count(*) into v_admins
    from public.workspace_members
    where workspace_id = v_workspace and role = 'admin';
    if v_admins <= 1 then
      raise exception 'Cannot remove the last admin of a workspace.';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
