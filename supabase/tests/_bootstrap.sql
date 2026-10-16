-- Supabase-compatible shims so CryoMap's migrations run on a plain Postgres.
--
-- In production these are provided by the Supabase platform (the `auth` schema,
-- the `anon`/`authenticated`/`service_role` roles, and `auth.uid()`). The
-- tenant-isolation test harness (run.sh) recreates just enough of that surface
-- to apply the real migrations unchanged and exercise their RLS policies.
--
-- This file is TEST INFRASTRUCTURE ONLY. It is never applied to a Supabase
-- project — those already have everything below.

create extension if not exists pgcrypto;

-- Roles Supabase provides out of the box.
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticator') then
    create role authenticator nologin noinherit;
  end if;
end $$;

grant anon, authenticated, service_role to authenticator;
grant usage on schema public to anon, authenticated, service_role;

-- auth schema: minimal users table + the JWT helpers the policies call.
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Returns the request's JWT claims. The harness sets request.jwt.claims per
-- impersonated user with set_config(...).
create or replace function auth.jwt()
returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;

grant execute on function auth.jwt() to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
