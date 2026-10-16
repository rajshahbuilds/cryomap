-- Least-privilege on the workspace SECURITY DEFINER functions (follow-up)
--
-- Addresses the security-advisor lints after the RLS flip:
--  * the last-admin trigger function is not an RPC — revoke EXECUTE entirely
--    (triggers fire regardless of grants, like handle_new_user).
--  * the RLS helpers must stay callable by `authenticated` (policy evaluation)
--    but should not be reachable by `anon`. Drop the blanket grant, re-grant
--    authenticated.

revoke execute on function public.prevent_last_admin_removal()
  from public, anon, authenticated;

revoke execute on function public.is_workspace_member(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;

revoke execute on function public.member_role(uuid) from public;
grant execute on function public.member_role(uuid) to authenticated;

revoke execute on function public.can_read_fridge(uuid) from public;
grant execute on function public.can_read_fridge(uuid) to authenticated;

revoke execute on function public.can_edit_fridge(uuid) from public;
grant execute on function public.can_edit_fridge(uuid) to authenticated;
