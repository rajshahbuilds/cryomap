-- Keep at least one admin per workspace
--
-- A DB trigger is the real guard (RLS can't express "≥1 admin"), so it holds
-- even against direct API calls — not just the server actions. Blocks deleting
-- or demoting a workspace's last admin.
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

create trigger workspace_members_keep_admin
  before update or delete on public.workspace_members
  for each row execute function public.prevent_last_admin_removal();
