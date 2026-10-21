# CryoMap

CryoMap is a collaborative web app for documenting and version-controlling the
wiring diagrams of dilution refrigerators. It replaces the whiteboard photos and ad-hoc diagrams labs
use to track which attenuators, filters, amplifiers, and cabling sit on each
temperature stage of a fridge, and lets a lab keep that record accurate as the
hardware changes.

-  **Official free public beta:** **https://cryomap.vercel.app** — the hosted
  service maintained by the project. (Anything you deploy yourself from this
  repository is your own instance; see [Self-hosting](#self-hosting).)
-  **License:** [Apache-2.0](./LICENSE)

> **Status: public beta (v0.1.0).** CryoMap is usable and in active development.
> Expect rough edges and occasional breaking changes before 1.0. See
> [Limitations & support](#limitations--support).

## What it does

 - **Fridge wiring sheets**: lay out temperature stages (300 K → mixing chamber)
  and the signal lines running through them, with the components placed on each
  line at each stage.
 - **Room-temperature sheets**: draw the bench instrumentation (sources, mixers,
  amplifiers, switches) that drives each fridge line.
-  **Signal tracing**: link a room-temperature chain to a named fridge line and
  follow a signal from the bench all the way down into the cryostat.
-  **A component vocabulary** for the real parts: attenuators, filters, isolators,
  circulators, HEMT/room-temp amplifiers, DC blocks, thermometers, mixers,
  switches, and your own reusable custom definitions.
 - **Versioning**: snapshot a diagram with a commit message and browse history.
 - **Collaboration**: labs work together in shared workspaces with roles.
 - **Export**: PNG/PDF of a diagram for notebooks and papers.

All examples and seed data in this repository are synthetic.

## Tech stack

Next.js 16 (App Router, TypeScript) · React 19 · Supabase (Postgres + Google
OAuth via `@supabase/ssr`, PKCE) · Tailwind v4 (light theme) · SVG canvas ·
pnpm 11. Deployable to any Next.js host; the official instance runs on Vercel.

## Quick start (local development)

```bash
pnpm install
cp .env.example .env.local      # then fill in YOUR OWN Supabase project
pnpm dev                        # http://localhost:3000
```

CryoMap needs a Supabase backend you control (local or a free hosted project).
The one-time setup (create the project, apply the migrations, configure Google
OAuth, and set the two environment variables) is in
**[docs/SELF_HOSTING.md](./docs/SELF_HOSTING.md)**. There is no shared
development backend; you bring your own.

### Scripts

| Command           | What it does                                    |
| ----------------- | ----------------------------------------------- |
| `pnpm dev`        | Dev server (http://localhost:3000)              |
| `pnpm build`      | Production build                                |
| `pnpm test`       | Unit/component tests (Vitest)                   |
| `pnpm test:rls`   | Tenant-isolation (RLS) tests — needs Postgres   |
| `pnpm test:e2e`   | End-to-end tests (Playwright, localhost)        |
| `pnpm test:smoke` | Smoke tests against a deployed URL              |
| `pnpm lint`       | ESLint                                          |
| `pnpm typecheck`  | `tsc --noEmit`                                  |
| `pnpm format`     | Prettier write (`format:check` to verify)       |

CI (`.github/workflows/ci.yml`) runs typecheck → lint → format → unit → RLS →
build → e2e on every PR and push to `main`.

## Collaboration & access model

CryoMap is multi-tenant. Every fridge belongs to a **workspace** (a lab); a user
can belong to several and switch between them. Members have one of three roles:

- **Admin**: manage members, generate/revoke invite links, rename or delete the
  workspace (plus everything an editor can do).
- **Editor**: create and edit fridges and diagrams (can take the per-fridge
  editing lock).
- **Viewer**: read-only; never takes the lock.

Joining is by **shareable invite link** with the role baked in: an admin creates
one under Workspace settings, and opening `/join/<token>` (signing in if needed)
joins the workspace. A signed-in user with no workspace is routed to `/welcome`.

**Data isolation is enforced in the database, not just the UI.** Every
tenant-owned table has workspace-scoped row-level security: a fridge and all its
diagram data are readable only by members of its workspace and writable only by
editors/admins. The app holds no service-role key — the anon key plus RLS is the
whole security model. The policies are exercised by an automated role-matrix test
suite (`pnpm test:rls`, see [`supabase/tests/`](./supabase/tests)).

## Architecture

- `app/`: App Router pages (server components do auth + existence checks; the
  diagram is client-rendered by `components/diagram/DiagramEditor.tsx`).
- `components/`: UI by area (`diagram`, `fridge`, `workspace`, `auth`, …).
- `lib/diagram/`: framework-free, unit-tested domain logic (camera math, undo
  stack, placement, assembly, status derivations).
- `lib/repositories/`: the only seam to Supabase; nothing else calls the DB.
- `lib/locks/`, `lib/workspaces/`: lock and collaboration domain logic.
- `supabase/migrations/`: append-only schema (tables, RLS, SECURITY DEFINER
  helpers, RPCs); `supabase/tests/`: tenant-isolation tests.

## Self-hosting

Anyone can run their own instance. See
**[docs/SELF_HOSTING.md](./docs/SELF_HOSTING.md)** for creating a Supabase
project, applying migrations, configuring Google OAuth, environment variables,
and deploying.

Instances you deploy are **your own** and share nothing with the official hosted
beta. Please don't present a third-party deployment as the official CryoMap — see
[`TRADEMARKS.md`](./TRADEMARKS.md).

## Limitations & support

- **Beta software.** Features and schema may change; back up anything important.
- Support is **best-effort** with no guaranteed response time — see
  [`SUPPORT.md`](./SUPPORT.md). Report bugs and ideas via GitHub issues; report
  security problems privately per [`SECURITY.md`](./SECURITY.md).

## Contributing

Contributions are welcome under Apache-2.0. Please read
[`CONTRIBUTING.md`](./CONTRIBUTING.md) and the
[`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

## License & notices

Apache-2.0 © 2026 Raj Shah. See [`LICENSE`](./LICENSE),
[`NOTICE`](./NOTICE), and third-party dependency licenses in
[`docs/THIRD_PARTY_LICENSES.md`](./docs/THIRD_PARTY_LICENSES.md). "CryoMap" naming
and branding: [`TRADEMARKS.md`](./TRADEMARKS.md).
