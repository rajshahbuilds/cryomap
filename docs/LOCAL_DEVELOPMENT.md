# Local development

This workflow runs CryoMap against a disposable Supabase instance on your own
machine. It is separate from production and requires no hosted Supabase account.
Tested with Node 22.23.3, pnpm 11.8.0, Supabase CLI 3.1.0, and Docker Desktop.
The local Supabase database uses PostgreSQL 17; the standalone RLS suite also
runs against locally installed PostgreSQL 16.

## First-time setup

1. Use Node 22 (the version in `.nvmrc`, matching CI) and pnpm 11.8.0 (pinned in
   `package.json`). With nvm, run `nvm install` and `nvm use`. On Homebrew, install
   `node@22` and add its `bin` directory to your shell's PATH.
2. Install the Supabase CLI and start Docker Desktop. On macOS:
   `brew install supabase/tap/supabase`.
3. From the repository root, run:

   ```bash
   pnpm install --frozen-lockfile
   supabase start
   pnpm dev:setup
   ```

`supabase start` reads the committed `supabase/config.toml` and applies all
existing migrations to the new local database. The first start downloads
container images and takes longer than later starts.

`pnpm dev:setup` reads the running local instance's URL and public key from the
CLI, writes an ignored `.env.local`, and creates a disposable local test account,
workspace, and sample diagram. It uses normal authentication and workspace
permissions; it does not need a service-role key. It refuses a hosted API URL
and refuses to overwrite an existing `.env.local` with different settings.
Move a conflicting configuration aside yourself before retrying.

The sample includes three cryogenic stages with automatically connected
components and a room-temperature sheet with an explicit port-to-port
connection. Running setup again preserves an existing sample and your edits.
It recreates the sample only after you delete it or reset the local database.

## Run and sign in

Start the application:

```bash
pnpm dev
```

In a separate terminal, start the local test-account sign-in helper:

```bash
pnpm dev:login
```

Open http://localhost:3001 and click **Open local sample diagram**. The helper
signs in to the local test account through Supabase Auth, writes the normal
session cookies, and redirects to the application at http://localhost:3000.
Use **Check out** in the editor before changing the diagram. Stop either
terminal process with Ctrl+C when finished.

This helper listens only on the loopback interface. Its fixed, public test
credentials are for disposable local data only. It is a standalone developer
tool, not an application route, and is not included in the deployed app.
Google OAuth remains the application's sign-in method; the local helper does
not exercise Google OAuth. For that flow, configure your own Google credentials
as described in [SELF_HOSTING.md](./SELF_HOSTING.md).

Local tools:

- Application: http://localhost:3000
- Test-account sign-in: http://localhost:3001
- Supabase Studio: http://127.0.0.1:54323
- Captured local email: http://127.0.0.1:54324

## Wire appearance prototype

While `pnpm dev` is running, open
http://localhost:3000/playground?preview=wires to compare the proposed wire
constructions. Choose straight runs, bends, or crossings; adjust zoom from
50% to 200%; and click a construction or wire to inspect its selection
highlight. The preview uses the shared diagram renderer and does not write to
the database. It is available only in development; production continues to
show the ordinary playground. Existing diagrams retain their plain wires until
construction properties are connected to the editor.

## Editing wire properties

Click a wire on either sheet to inspect it in the right-hand panel. Check out
before editing. Construction and label visibility update immediately; text and
measurements save when you leave their field. Optional values can be cleared.
Labels are hidden by default and appear only after enabling **Show label on
diagram**. Material is independent of construction; coaxial and triaxial wires
also expose their shield materials. Gauge accepts AWG (including `2/0`, `3/0`,
and `4/0`) or a diameter in mm or µm. Each wire also has an optional
**Datasheet URL**, with the same URL validation as component datasheets.

Each automatic segment keeps its properties for that pair of components on that
line. Inserting a component creates new, unspecified segments. Removing it
reveals the original pair and its saved properties. Undo restores cable details
when components, lines, stages, or sheets are deleted or reassigned. Undo/redo
keeps entity ids stable; duplication and version restoration still create fresh
ids and remap the wire references.

## Verify changes

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm test:rls
pnpm build
pnpm test:e2e
```

The unit suite uses a database fake. `test:rls` creates and removes a separate
throwaway PostgreSQL cluster and applies all migrations, without touching the
running Supabase database. It requires local PostgreSQL binaries; see
[the database test README](../supabase/tests/README.md).

The default browser suite covers public/auth routing and the playground. An
additional authenticated wire suite uses the running local Supabase instance:

```bash
pnpm test:wires
```

Run `pnpm dev:setup` first. The suite refuses a hosted database URL, signs in as
the normal local test user, creates its own disposable workspace, and removes
that workspace on completion. It verifies both wire kinds, hidden labels,
undo/redo, component deletion and restoration, reload, check-in, and
JSON/PNG/PDF exports. It runs separately from the default CI browser suite,
which does not start Supabase. Continue using the signed-in local sample for
manual history/restore and duplication review.

Do not run a production build and the development server simultaneously: both
write Next.js build artifacts in this checkout.

## Database changes

Add new, timestamped files to `supabase/migrations/`; do not modify shipped
migrations. With Supabase CLI 3, migrations target the local instance by default.
Apply pending migrations with:

```bash
supabase migration up
```

For a fresh-install rehearsal, `supabase db reset` **deletes all local
data** and reapplies every migration. Then run `pnpm dev:setup` to recreate the
test account and sample. Separately rehearse upgrades by creating data with the
old schema before applying the new migration. `pnpm test:rls` now automates
both a fresh install and an upgrade from the pre-wire schema in separate
throwaway databases, including existing connections and historical snapshots.

Use `supabase stop` to stop services while preserving their data. No hosted
project linking, production credentials, or production database changes are
needed for this workflow.

## Known baseline issue

The authenticated editor currently emits a React hydration warning on Node 22:
the server initially renders the offline indicator while the browser renders
online. `useOnline` reads `navigator.onLine` during initialization; Node provides
a `navigator` object without that browser property. React recovers on the
client. Local sign-in, editing, check-in, and persistence after reload were
verified despite this warning. This existing application issue is recorded
separately from the wire feature and local setup changes.
