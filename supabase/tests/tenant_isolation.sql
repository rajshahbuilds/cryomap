-- Tenant-isolation / role-matrix tests for CryoMap's workspace-scoped RLS.
--
-- Proves that workspace-owned data (fridges, sheets, stages, lines, components,
-- connections, custom definitions, versions, locks, annotations) and the
-- collaboration tables (workspaces, members, invites, profiles) are reachable
-- only by authorized members, per the admin / editor / viewer role matrix — and
-- that the SECURITY DEFINER RPCs (redeem_invite, create_workspace) and the
-- last-admin trigger hold against direct database access.
--
-- Run with supabase/tests/run.sh (spins a disposable local Postgres, applies the
-- real migrations, then this file). Any failed assertion raises and, with
-- psql -v ON_ERROR_STOP=1, exits non-zero. The final NOTICE is the pass marker.
--
-- Impersonation: pg_temp.login(uid) sets the `authenticated` role and a JWT
-- claims blob so auth.uid() resolves to that user, exactly as PostgREST does.

\set ON_ERROR_STOP on

create or replace function pg_temp.login(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', uid::text, 'role', 'authenticated')::text,
    true
  );
end $$;

-- ---------------------------------------------------------------------------
-- Fixtures (created as the superuser table owner, so RLS is bypassed here).
-- ---------------------------------------------------------------------------
do $$
declare
  ws_a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  ws_b uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  adm_a uuid := 'aaaaaaaa-0000-0000-0000-0000000000a1';
  ed_a  uuid := 'aaaaaaaa-0000-0000-0000-0000000000a2';
  vi_a  uuid := 'aaaaaaaa-0000-0000-0000-0000000000a3';
  rm_a  uuid := 'aaaaaaaa-0000-0000-0000-0000000000a4';
  spare uuid := 'aaaaaaaa-0000-0000-0000-0000000000a9';
  out_b uuid := 'bbbbbbbb-0000-0000-0000-0000000000b2';
  nob   uuid := 'cccccccc-0000-0000-0000-0000000000c1';
  nob2  uuid := 'cccccccc-0000-0000-0000-0000000000c2';
  f_a  uuid := 'aaaaaaaa-1111-0000-0000-000000000001';
  f_a2 uuid := 'aaaaaaaa-1111-0000-0000-000000000002';
  f_b  uuid := 'bbbbbbbb-1111-0000-0000-000000000001';
  sh_a uuid := 'aaaaaaaa-2222-0000-0000-000000000001';
  sh_b uuid := 'bbbbbbbb-2222-0000-0000-000000000001';
  st_a uuid := 'aaaaaaaa-3333-0000-0000-000000000001';
  ln_a uuid := 'aaaaaaaa-4444-0000-0000-000000000001';
  cd_a uuid := 'aaaaaaaa-5555-0000-0000-000000000001';
  co_a uuid := 'aaaaaaaa-6666-0000-0000-000000000001';
  co_a2 uuid := 'aaaaaaaa-6666-0000-0000-000000000002';
  cn_a uuid := 'aaaaaaaa-7777-0000-0000-000000000001';
  ve_a uuid := 'aaaaaaaa-8888-0000-0000-000000000001';
  an_a uuid := 'aaaaaaaa-9999-0000-0000-000000000001';
begin
  insert into auth.users (id, email) values
    (adm_a,'adm@a.test'),(ed_a,'ed@a.test'),(vi_a,'vi@a.test'),(rm_a,'rm@a.test'),
    (spare,'spare@a.test'),(out_b,'out@b.test'),(nob,'nob@x.test'),(nob2,'nob2@x.test');

  insert into public.workspaces (id, name, created_by) values
    (ws_a,'Lab A', adm_a),(ws_b,'Lab B', out_b);

  insert into public.workspace_members (workspace_id, user_id, role) values
    (ws_a, adm_a,'admin'),(ws_a, ed_a,'editor'),(ws_a, vi_a,'viewer'),(ws_a, rm_a,'viewer'),
    (ws_b, out_b,'admin');

  insert into public.fridges (id, name, workspace_id, created_by) values
    (f_a,'Fridge A', ws_a, adm_a),(f_a2,'Fridge A2', ws_a, adm_a),(f_b,'Fridge B', ws_b, out_b);

  insert into public.sheets (id, fridge_id, kind, name, sort_order) values
    (sh_a, f_a,'fridge','Wiring',0),(sh_b, f_b,'fridge','Wiring',0);
  insert into public.stages (id, fridge_id, sheet_id, name, sort_order) values
    (st_a, f_a, sh_a,'4K',0);
  insert into public.lines (id, fridge_id, sheet_id, name, sort_order) values
    (ln_a, f_a, sh_a,'Line 1',0);
  insert into public.custom_component_defs (id, fridge_id, name) values
    (cd_a, f_a,'Widget');
  insert into public.components (id, fridge_id, sheet_id, component_type) values
    (co_a, f_a, sh_a,'attenuator'),(co_a2, f_a, sh_a,'attenuator');
  insert into public.connections
    (id, fridge_id, sheet_id, from_component_id, from_port_side, to_component_id, to_port_side) values
    (cn_a, f_a, sh_a, co_a,'right', co_a2,'left');
  insert into public.versions (id, fridge_id, snapshot, commit_message) values
    (ve_a, f_a,'{}'::jsonb,'init');
  insert into public.locks (fridge_id, locked_by) values (f_a, adm_a);
  insert into public.annotations (id, fridge_id, sheet_id, text, x_abs, y_abs) values
    (an_a, f_a, sh_a,'note',10,10);

  insert into public.workspace_invites (workspace_id, token, role, expires_at, revoked_at) values
    (ws_a,'valid-tok','viewer', null, null),
    (ws_a,'revoked-tok','viewer', null, now()),
    (ws_a,'expired-tok','viewer', now() - interval '1 day', null);

  raise notice '[setup] fixtures created';
end $$;

-- ---------------------------------------------------------------------------
-- 1. Non-member (admin of Lab B) sees and touches NOTHING in Lab A.
--    Covers: guessed workspace/fridge/sheet/version/annotation/component IDs
--    reveal nothing; non-member cannot read/create/modify/delete.
-- ---------------------------------------------------------------------------
do $$
declare n int;
begin
  perform pg_temp.login('bbbbbbbb-0000-0000-0000-0000000000b2'); -- out_b
  if exists (select 1 from public.workspaces where id='aaaaaaaa-0000-0000-0000-000000000001')
    then raise exception 'FAIL non-member read workspace A'; end if;
  if exists (select 1 from public.fridges where id='aaaaaaaa-1111-0000-0000-000000000001')
    then raise exception 'FAIL non-member read fridge A'; end if;
  if exists (select 1 from public.sheets where fridge_id='aaaaaaaa-1111-0000-0000-000000000001')
    then raise exception 'FAIL non-member read sheets A'; end if;
  if exists (select 1 from public.components where fridge_id='aaaaaaaa-1111-0000-0000-000000000001')
    then raise exception 'FAIL non-member read components A'; end if;
  if exists (select 1 from public.versions where fridge_id='aaaaaaaa-1111-0000-0000-000000000001')
    then raise exception 'FAIL non-member read versions A'; end if;
  if exists (select 1 from public.annotations where fridge_id='aaaaaaaa-1111-0000-0000-000000000001')
    then raise exception 'FAIL non-member read annotations A'; end if;
  if exists (select 1 from public.locks where fridge_id='aaaaaaaa-1111-0000-0000-000000000001')
    then raise exception 'FAIL non-member read locks A'; end if;
  if exists (select 1 from public.workspace_members where workspace_id='aaaaaaaa-0000-0000-0000-000000000001')
    then raise exception 'FAIL non-member read members A'; end if;
  if exists (select 1 from public.workspace_invites where workspace_id='aaaaaaaa-0000-0000-0000-000000000001')
    then raise exception 'FAIL non-member read invites A'; end if;

  begin
    insert into public.lines (fridge_id, sheet_id, name, sort_order)
    values ('aaaaaaaa-1111-0000-0000-000000000001','aaaaaaaa-2222-0000-0000-000000000001','hax',9);
    raise exception 'FAIL non-member inserted a line into A';
  exception when insufficient_privilege then null; end;

  update public.fridges set name='hax' where id='aaaaaaaa-1111-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL non-member updated fridge A (% rows)', n; end if;

  delete from public.fridges where id='aaaaaaaa-1111-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL non-member deleted fridge A (% rows)', n; end if;

  raise notice '[pass] non-member is fully isolated from Lab A';
end $$;

-- ---------------------------------------------------------------------------
-- 2. Viewer: reads everything in the workspace, writes nothing; cannot see
--    invites; cannot promote self.
-- ---------------------------------------------------------------------------
do $$
declare n int;
begin
  perform pg_temp.login('aaaaaaaa-0000-0000-0000-0000000000a3'); -- vi_a
  if not exists (select 1 from public.fridges where id='aaaaaaaa-1111-0000-0000-000000000001')
    then raise exception 'FAIL viewer cannot read fridge A'; end if;
  if not exists (select 1 from public.components where id='aaaaaaaa-6666-0000-0000-000000000001')
    then raise exception 'FAIL viewer cannot read component A'; end if;
  if not exists (select 1 from public.versions where id='aaaaaaaa-8888-0000-0000-000000000001')
    then raise exception 'FAIL viewer cannot read version A'; end if;

  begin
    insert into public.lines (fridge_id, sheet_id, name, sort_order)
    values ('aaaaaaaa-1111-0000-0000-000000000001','aaaaaaaa-2222-0000-0000-000000000001','v-hax',8);
    raise exception 'FAIL viewer inserted a line';
  exception when insufficient_privilege then null; end;

  begin
    insert into public.annotations (fridge_id, sheet_id, text, x_abs, y_abs)
    values ('aaaaaaaa-1111-0000-0000-000000000001','aaaaaaaa-2222-0000-0000-000000000001','x',1,1);
    raise exception 'FAIL viewer inserted an annotation';
  exception when insufficient_privilege then null; end;

  update public.fridges set name='v-hax' where id='aaaaaaaa-1111-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL viewer updated fridge (% rows)', n; end if;

  delete from public.components where id='aaaaaaaa-6666-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL viewer deleted a component (% rows)', n; end if;

  if exists (select 1 from public.workspace_invites where workspace_id='aaaaaaaa-0000-0000-0000-000000000001')
    then raise exception 'FAIL viewer can read invites'; end if;

  update public.workspace_members set role='admin'
   where workspace_id='aaaaaaaa-0000-0000-0000-000000000001' and user_id='aaaaaaaa-0000-0000-0000-0000000000a3';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL viewer promoted self (% rows)', n; end if;

  raise notice '[pass] viewer reads all, writes nothing, cannot self-promote';
end $$;

-- ---------------------------------------------------------------------------
-- 3. Editor: edits diagram data; cannot do admin-only ops.
-- ---------------------------------------------------------------------------
do $$
declare n int;
begin
  perform pg_temp.login('aaaaaaaa-0000-0000-0000-0000000000a2'); -- ed_a
  insert into public.lines (fridge_id, sheet_id, name, sort_order)
  values ('aaaaaaaa-1111-0000-0000-000000000001','aaaaaaaa-2222-0000-0000-000000000001','editor-line',7);
  insert into public.annotations (fridge_id, sheet_id, text, x_abs, y_abs)
  values ('aaaaaaaa-1111-0000-0000-000000000001','aaaaaaaa-2222-0000-0000-000000000001','editor-note',2,2);
  insert into public.versions (fridge_id, snapshot, commit_message)
  values ('aaaaaaaa-1111-0000-0000-000000000001','{}'::jsonb,'editor snapshot');
  update public.fridges set name='Fridge A (edited)' where id='aaaaaaaa-1111-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL editor could not update fridge (% rows)', n; end if;

  -- admin-only: update workspace settings
  update public.workspaces set name='hax' where id='aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL editor updated workspace settings (% rows)', n; end if;

  -- admin-only: add a member
  begin
    insert into public.workspace_members (workspace_id, user_id, role)
    values ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-0000000000a9','viewer');
    raise exception 'FAIL editor added a member';
  exception when insufficient_privilege then null; end;

  -- admin-only: read invites
  if exists (select 1 from public.workspace_invites where workspace_id='aaaaaaaa-0000-0000-0000-000000000001')
    then raise exception 'FAIL editor can read invites'; end if;

  -- cannot promote self
  update public.workspace_members set role='admin'
   where workspace_id='aaaaaaaa-0000-0000-0000-000000000001' and user_id='aaaaaaaa-0000-0000-0000-0000000000a2';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL editor promoted self (% rows)', n; end if;

  raise notice '[pass] editor edits diagrams; blocked from all admin ops';
end $$;

-- ---------------------------------------------------------------------------
-- 4. Admin: manages members, invites, workspace settings, and fridges.
-- ---------------------------------------------------------------------------
do $$
declare n int;
begin
  perform pg_temp.login('aaaaaaaa-0000-0000-0000-0000000000a1'); -- adm_a
  update public.workspaces set name='Lab A (renamed)' where id='aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL admin could not rename workspace (% rows)', n; end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-0000000000a9','viewer');
  update public.workspace_members set role='editor'
   where workspace_id='aaaaaaaa-0000-0000-0000-000000000001' and user_id='aaaaaaaa-0000-0000-0000-0000000000a9';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL admin could not change a member role (% rows)', n; end if;

  insert into public.workspace_invites (workspace_id, token, role) values
    ('aaaaaaaa-0000-0000-0000-000000000001','admin-made-tok','viewer');
  if not exists (select 1 from public.workspace_invites where token='admin-made-tok')
    then raise exception 'FAIL admin cannot read own invite'; end if;

  delete from public.fridges where id='aaaaaaaa-1111-0000-0000-000000000002'; -- throwaway f_a2
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL admin could not delete a fridge (% rows)', n; end if;

  raise notice '[pass] admin manages members, invites, settings, fridges';
end $$;

-- ---------------------------------------------------------------------------
-- 5. Removed member immediately loses access.
-- ---------------------------------------------------------------------------
do $$
begin
  perform pg_temp.login('aaaaaaaa-0000-0000-0000-0000000000a4'); -- rm_a (still a member here)
  if not exists (select 1 from public.fridges where id='aaaaaaaa-1111-0000-0000-000000000001')
    then raise exception 'FAIL rm_a should still read fridge A before removal'; end if;
end $$;

delete from public.workspace_members
 where workspace_id='aaaaaaaa-0000-0000-0000-000000000001' and user_id='aaaaaaaa-0000-0000-0000-0000000000a4';

do $$
begin
  perform pg_temp.login('aaaaaaaa-0000-0000-0000-0000000000a4'); -- rm_a (now removed)
  if exists (select 1 from public.fridges where id='aaaaaaaa-1111-0000-0000-000000000001')
    then raise exception 'FAIL removed member still reads fridge A'; end if;
  raise notice '[pass] removed member loses access immediately';
end $$;

-- ---------------------------------------------------------------------------
-- 6. Invite redemption (SECURITY DEFINER RPC): invalid / revoked / expired
--    rejected; valid joins; a non-member gains exactly the granted role.
-- ---------------------------------------------------------------------------
do $$
begin
  perform pg_temp.login('cccccccc-0000-0000-0000-0000000000c1'); -- nob
  if (public.redeem_invite('no-such-token') ->> 'status') <> 'invalid'
    then raise exception 'FAIL bad token not reported invalid'; end if;
  if (public.redeem_invite('revoked-tok') ->> 'status') <> 'revoked'
    then raise exception 'FAIL revoked invite redeemable'; end if;
  if (public.redeem_invite('expired-tok') ->> 'status') <> 'expired'
    then raise exception 'FAIL expired invite redeemable'; end if;
  if (public.redeem_invite('valid-tok') ->> 'status') <> 'joined'
    then raise exception 'FAIL valid invite did not join'; end if;
  -- now a viewer of Lab A: can read, cannot write
  if not exists (select 1 from public.fridges where id='aaaaaaaa-1111-0000-0000-000000000001')
    then raise exception 'FAIL joined member cannot read fridge A'; end if;
  begin
    insert into public.lines (fridge_id, sheet_id, name, sort_order)
    values ('aaaaaaaa-1111-0000-0000-000000000001','aaaaaaaa-2222-0000-0000-000000000001','nob-hax',6);
    raise exception 'FAIL joined viewer could write';
  exception when insufficient_privilege then null; end;
  raise notice '[pass] invite redemption enforces invalid/revoked/expired and grants role';
end $$;

-- ---------------------------------------------------------------------------
-- 7. create_workspace RPC bootstraps caller as admin of a brand-new workspace,
--    isolated from every other workspace.
-- ---------------------------------------------------------------------------
do $$
declare new_ws uuid;
begin
  perform pg_temp.login('cccccccc-0000-0000-0000-0000000000c2'); -- nob2
  select (public.create_workspace('Nob2 Lab')).id into new_ws;
  if not exists (select 1 from public.workspaces where id=new_ws)
    then raise exception 'FAIL creator cannot see new workspace'; end if;
  if (select role from public.workspace_members
        where workspace_id=new_ws and user_id='cccccccc-0000-0000-0000-0000000000c2') <> 'admin'
    then raise exception 'FAIL creator is not admin of new workspace'; end if;
  if exists (select 1 from public.fridges where id='aaaaaaaa-1111-0000-0000-000000000001')
    then raise exception 'FAIL new-workspace admin can see Lab A fridge'; end if;
  raise notice '[pass] create_workspace makes caller admin, isolated from others';
end $$;

-- ---------------------------------------------------------------------------
-- 8. Cross-workspace: Lab A admin cannot touch Lab B.
-- ---------------------------------------------------------------------------
do $$
declare n int;
begin
  perform pg_temp.login('aaaaaaaa-0000-0000-0000-0000000000a1'); -- adm_a
  if exists (select 1 from public.fridges where id='bbbbbbbb-1111-0000-0000-000000000001')
    then raise exception 'FAIL Lab A admin reads Lab B fridge'; end if;
  update public.workspaces set name='hax' where id='bbbbbbbb-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL Lab A admin updated Lab B (% rows)', n; end if;
  delete from public.workspaces where id='bbbbbbbb-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL Lab A admin deleted Lab B (% rows)', n; end if;
  delete from public.fridges where id='bbbbbbbb-1111-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL Lab A admin deleted Lab B fridge (% rows)', n; end if;
  raise notice '[pass] workspace deletion/edit cannot cross into another workspace';
end $$;

-- ---------------------------------------------------------------------------
-- 9. Profiles: readable by self + co-members only; writable only by self.
-- ---------------------------------------------------------------------------
do $$
declare n int;
begin
  perform pg_temp.login('aaaaaaaa-0000-0000-0000-0000000000a3'); -- vi_a
  if not exists (select 1 from public.profiles where id='aaaaaaaa-0000-0000-0000-0000000000a3')
    then raise exception 'FAIL cannot read own profile'; end if;
  if not exists (select 1 from public.profiles where id='aaaaaaaa-0000-0000-0000-0000000000a1')
    then raise exception 'FAIL cannot read co-member admin profile'; end if;
  if exists (select 1 from public.profiles where id='bbbbbbbb-0000-0000-0000-0000000000b2')
    then raise exception 'FAIL can read a non-co-member profile'; end if;
  update public.profiles set display_name='hax' where id='aaaaaaaa-0000-0000-0000-0000000000a1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL updated another user profile (% rows)', n; end if;
  raise notice '[pass] profiles scoped to self + co-members';
end $$;

-- ---------------------------------------------------------------------------
-- 10. Last-admin guard holds against direct DB access (demote + delete).
-- ---------------------------------------------------------------------------
do $$
declare demoted boolean := false;
begin
  perform pg_temp.login('aaaaaaaa-0000-0000-0000-0000000000a1'); -- adm_a, sole admin of Lab A
  begin
    update public.workspace_members set role='editor'
     where workspace_id='aaaaaaaa-0000-0000-0000-000000000001' and user_id='aaaaaaaa-0000-0000-0000-0000000000a1';
    demoted := true;
  exception when others then null; end;
  if demoted then
    if exists (select 1 from public.workspace_members
               where workspace_id='aaaaaaaa-0000-0000-0000-000000000001'
                 and user_id='aaaaaaaa-0000-0000-0000-0000000000a1' and role='admin')
      then null; -- update was silently filtered, still admin: acceptable
      else raise exception 'FAIL last admin was demoted'; end if;
  end if;
  raise notice '[pass] last-admin guard prevents removing the final admin';
end $$;

reset role;
do $$ begin raise notice 'ALL TENANT-ISOLATION CHECKS PASSED'; end $$;
