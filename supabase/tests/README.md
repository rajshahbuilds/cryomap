# Database tests

Automated **tenant-isolation / RLS** tests. They prove that workspace-owned data
is reachable only by authorized members per the admin / editor / viewer role
matrix, verified at the database level — the only place RLS actually runs (the
in-memory Supabase fake in `test/` cannot evaluate policies).

## Run

```bash
pnpm test:rls
```

`run.sh` stands up a **disposable local Postgres** (no Docker, no Supabase CLI),
applies `_bootstrap.sql` (Supabase-compatible shims: the `auth` schema, the
`anon`/`authenticated`/`service_role` roles, `auth.uid()`), then every migration
in `../migrations` in order, then `_grants.sql`, then `tenant_isolation.sql`.
The cluster is deleted on exit. Requires a local Postgres on PATH
(`brew install postgresql@16`); it also runs in CI, where the runner's
PostgreSQL binaries are discovered automatically.

Any failed assertion aborts with a non-zero exit (`psql -v ON_ERROR_STOP=1`); the
closing `ALL TENANT-ISOLATION CHECKS PASSED` notice is the success marker.

## What's covered

`tenant_isolation.sql` exercises, as impersonated users (role `authenticated` +
a JWT claims blob, exactly as PostgREST sets them):

- **Non-member** can't read/create/modify/delete any Lab A table, and guessed
  workspace/fridge/sheet/version/annotation/component IDs reveal nothing.
- **Viewer** reads everything, writes nothing, can't see invites, can't promote
  self.
- **Editor** edits diagram tables but is blocked from all admin-only operations.
- **Admin** manages members, invites, workspace settings, and fridges.
- **Removed member** loses access immediately.
- **redeem_invite** rejects invalid / revoked / expired tokens and grants exactly
  the invited role.
- **create_workspace** makes the caller admin of an isolated new workspace.
- **Cross-workspace**: a Lab A admin cannot read, edit, or delete Lab B (or its
  fridges); workspace deletion cannot cross tenants.
- **Profiles** are readable only by self + co-members and writable only by self.
- **Last-admin guard** survives direct database access.

Exports (PNG/PDF) are generated client-side from already-read diagram data, so
they inherit the same read policy and need no separate server surface.
