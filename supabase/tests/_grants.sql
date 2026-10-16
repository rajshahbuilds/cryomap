-- Table/sequence/function privileges for anon + authenticated.
--
-- In production Supabase grants these broadly to anon/authenticated and relies
-- on RLS policies to do the real row-level gating. The migrations themselves
-- only manage RLS policies and a few function grants, not base table
-- privileges, so the harness supplies them here AFTER all migrations have run.
--
-- TEST INFRASTRUCTURE ONLY — never applied to a Supabase project.

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to authenticated;
