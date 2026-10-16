-- Harden the helper/trigger functions flagged by the Supabase security advisor.
--
-- Note on the remaining advisor warnings (intentional for Phase 1):
--   * `rls_policy_always_true` on every table — the MVP policy deliberately
--     lets any authenticated user read/write everything. Role-based access is
--     out of scope for Phase 1 (see fridge-diagram-spec.md).

-- Pin search_path so the function cannot be hijacked via a mutable path.
alter function public.set_updated_at() set search_path = '';

-- handle_new_user is only meant to run from the on_auth_user_created trigger,
-- never via PostgREST RPC. Triggers fire regardless of EXECUTE grants, so it is
-- safe to revoke RPC execution from API roles.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
