-- Scope profiles to self + shared-workspace members
--
-- After the RLS flip, profiles was the last table still readable by any signed-in
-- user. Restrict reads to your own profile and anyone you share a workspace with
-- (the app only ever needs co-members: member lists, lock holders, version
-- authors). Writes stay self-only; the signup trigger creates rows as definer.

create or replace function public.shares_workspace(other_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.workspace_members m1
    join public.workspace_members m2 on m1.workspace_id = m2.workspace_id
    where m1.user_id = auth.uid() and m2.user_id = other_user
  );
$$;

revoke execute on function public.shares_workspace(uuid) from public;
grant execute on function public.shares_workspace(uuid) to authenticated;

drop policy "profiles: authenticated full access" on public.profiles;

create policy "profiles: self or co-member read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_workspace(id));

create policy "profiles: insert own" on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
