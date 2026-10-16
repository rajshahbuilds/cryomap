-- redeem_invite RPC
--
-- Lets a signed-in user join a workspace via an invite link's token. SECURITY
-- DEFINER so a not-yet-member can insert their own membership without read
-- access to workspace_invites and without an RLS chicken-and-egg on
-- workspace_members. Returns a JSON status the app branches on; never throws for
-- the expected failure cases (invalid/expired/revoked) so the UI can message
-- them cleanly.
create or replace function public.redeem_invite(invite_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.workspace_invites;
  v_workspace public.workspaces;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'unauthenticated');
  end if;

  select * into v_invite
  from public.workspace_invites
  where token = invite_token;

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;
  if v_invite.revoked_at is not null then
    return jsonb_build_object('status', 'revoked');
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;

  select * into v_workspace
  from public.workspaces
  where id = v_invite.workspace_id;

  -- Already a member: no-op (never downgrade an existing role).
  if exists (
    select 1 from public.workspace_members
    where workspace_id = v_invite.workspace_id and user_id = v_uid
  ) then
    return jsonb_build_object(
      'status', 'already_member',
      'workspace_id', v_workspace.id,
      'workspace_name', v_workspace.name
    );
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_invite.workspace_id, v_uid, v_invite.role);

  return jsonb_build_object(
    'status', 'joined',
    'workspace_id', v_workspace.id,
    'workspace_name', v_workspace.name
  );
end;
$$;

-- Only signed-in users may redeem.
revoke execute on function public.redeem_invite(text) from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;
