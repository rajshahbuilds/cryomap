-- Workspaces & collaboration
--
-- Introduces multi-tenant collaboration: workspaces (labs) own fridges, with
-- membership roles (admin/editor/viewer) and shareable invite links.
--
-- This migration is intentionally additive and NON-BREAKING:
--   * `fridges.workspace_id` is nullable for now, so the live app keeps working
--     while the collaboration feature is built. It is tightened to NOT NULL in
--     the staged rollout, once create-workspace + workspace-scoped
--     fridge creation populate it everywhere.
--   * RLS is enabled on the new tables but no policies are added here — they
--     land with the access-model rewrite. The new tables are unused by
--     the app until then.
--   * The redeem-invite RPC lands in a follow-up migration.

-- Role of a member within a workspace.
create type public.workspace_role as enum ('admin', 'editor', 'viewer');

-- workspaces ---------------------------------------------------------------
-- A lab. Owns fridges; has members and invite links.
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

-- workspace_members --------------------------------------------------------
-- Who belongs to a workspace, and at what role. One row per (workspace, user).
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.workspace_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.workspace_members enable row level security;

-- The PK covers (workspace_id, user_id); index the reverse lookup "my workspaces".
create index workspace_members_user_id_idx on public.workspace_members (user_id);

-- workspace_invites --------------------------------------------------------
-- Shareable invite links. Multi-use until they expire or are revoked; the role
-- granted is baked into the link.
create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  token text not null unique,
  role public.workspace_role not null default 'viewer',
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.workspace_invites enable row level security;

-- (The `unique` on token already provides the lookup index for redemption.)

-- fridges.workspace_id -----------------------------------------------------
-- Nullable for now (see header). Tightened to NOT NULL in a later migration.
alter table public.fridges
  add column workspace_id uuid references public.workspaces (id) on delete cascade;

create index fridges_workspace_id_idx on public.fridges (workspace_id);
