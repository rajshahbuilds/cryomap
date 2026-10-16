-- Self-serve account deletion
--
-- 1. Authorship columns referencing public.profiles were created with the
--    default NO ACTION, which would block deleting a profile that ever created
--    a fridge, version, annotation, etc. Shared workspace data must outlive the
--    person who made it, so those references become ON DELETE SET NULL. A lock
--    held by a deleted user is meaningless, so locks cascade instead.
--
-- 2. delete_account(confirmed_workspace_ids) deletes the caller's auth user,
--    which cascades to their profile and memberships. A workspace where the
--    caller is the ONLY admin can't keep running without them (the last-admin
--    trigger would block removing that membership anyway), so it's deleted with
--    everything in it — but only if the caller explicitly listed it in
--    confirmed_workspace_ids. That way a stale UI (e.g. another admin was
--    demoted after the page loaded) can never delete a lab the user didn't see
--    in the warning.

alter table public.fridges
  drop constraint fridges_created_by_fkey,
  add constraint fridges_created_by_fkey
    foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.custom_component_defs
  drop constraint custom_component_defs_created_by_fkey,
  add constraint custom_component_defs_created_by_fkey
    foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.components
  drop constraint components_last_edited_by_fkey,
  add constraint components_last_edited_by_fkey
    foreign key (last_edited_by) references public.profiles (id) on delete set null;

alter table public.locks
  drop constraint locks_locked_by_fkey,
  add constraint locks_locked_by_fkey
    foreign key (locked_by) references public.profiles (id) on delete cascade;

alter table public.versions
  drop constraint versions_author_id_fkey,
  add constraint versions_author_id_fkey
    foreign key (author_id) references public.profiles (id) on delete set null;

alter table public.workspaces
  drop constraint workspaces_created_by_fkey,
  add constraint workspaces_created_by_fkey
    foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.workspace_invites
  drop constraint workspace_invites_created_by_fkey,
  add constraint workspace_invites_created_by_fkey
    foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.annotations
  drop constraint annotations_created_by_fkey,
  add constraint annotations_created_by_fkey
    foreign key (created_by) references public.profiles (id) on delete set null;

-- Guard: fail the migration if any reference to profiles would still block a
-- profile delete (e.g. a constraint added later with the default action).
do $$
declare v_blocking text;
begin
  select string_agg(conrelid::regclass || '.' || conname, ', ')
    into v_blocking
  from pg_constraint
  where contype = 'f'
    and confrelid = 'public.profiles'::regclass
    and confdeltype in ('a', 'r'); -- NO ACTION / RESTRICT
  if v_blocking is not null then
    raise exception 'References to profiles still block deletion: %', v_blocking;
  end if;
end $$;

create or replace function public.delete_account(
  confirmed_workspace_ids uuid[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sole uuid[];
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Workspaces where the caller is the only admin.
  select coalesce(array_agg(m.workspace_id), '{}')
    into v_sole
  from public.workspace_members m
  where m.user_id = v_uid
    and m.role = 'admin'
    and not exists (
      select 1 from public.workspace_members o
      where o.workspace_id = m.workspace_id
        and o.role = 'admin'
        and o.user_id <> v_uid
    );

  if not (v_sole <@ coalesce(confirmed_workspace_ids, '{}')) then
    raise exception 'You are the only admin of a workspace that was not confirmed for deletion. Reload and try again.';
  end if;

  delete from public.workspaces where id = any (v_sole);

  -- Cascades to public.profiles → workspace_members; authorship is nulled.
  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_account(uuid[]) from public, anon;
grant execute on function public.delete_account(uuid[]) to authenticated;
