-- Remove anon EXECUTE on the SECURITY DEFINER RLS helpers (follow-up)
--
-- The earlier harden migration revoked these from PUBLIC, but Supabase also
-- grants EXECUTE to `anon` directly, so they stayed reachable by anon. They're
-- caller-scoped (return false/null with no auth.uid()), but there's no reason to
-- expose them unauthenticated. `authenticated` keeps EXECUTE — it's required for
-- RLS policy evaluation.
revoke execute on function public.is_workspace_member(uuid) from anon;
revoke execute on function public.member_role(uuid) from anon;
revoke execute on function public.can_read_fridge(uuid) from anon;
revoke execute on function public.can_edit_fridge(uuid) from anon;
revoke execute on function public.shares_workspace(uuid) from anon;
