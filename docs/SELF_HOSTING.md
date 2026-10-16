# Self-hosting CryoMap

CryoMap is a Next.js app backed by a Supabase project (Postgres + Google OAuth).
Anyone can run their own instance — locally for development, or deployed to their
own hosting. This guide sets up a backend you fully own.

> **Official service vs. your deployment.** The official, maintained CryoMap is
> the free public beta at **https://cryomap.vercel.app**, run by the project.
> Any instance you stand up from this repository is **your own deployment** — it
> shares no data or infrastructure with the official service, and you are
> responsible for its data, security, and availability. Please don't present a
> third-party deployment as the official CryoMap (see [`TRADEMARKS.md`](../TRADEMARKS.md)).

## 1. Prerequisites

- Node 22+ and pnpm 11+ (`corepack enable` picks up the version in `package.json`)
- A Supabase project — either:
  - **Local** via the [Supabase CLI](https://supabase.com/docs/guides/local-development) (`supabase start`), or
  - **Hosted**, a free project at https://supabase.com

## 2. Create the database schema

Apply the migrations in [`supabase/migrations/`](../supabase/migrations) **in
filename order** to your project. They are the complete, authoritative schema
(tables, row-level security, SECURITY DEFINER helpers, and RPCs) — a fresh
install needs all of them, nothing else.

- **Supabase CLI (local or linked):**
  ```bash
  supabase db reset        # replays every migration
  ```
- **Hosted project:** paste each migration, oldest first, into the SQL editor, or
  link the project (`supabase link`) and run `supabase db push`.

## 3. Configure Google OAuth

Authentication is Google OAuth via Supabase Auth.

1. In Google Cloud, create an OAuth 2.0 **Web application** client.
2. Add Supabase's callback as an authorized redirect URI:
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
   (for local: `http://127.0.0.1:54321/auth/v1/callback`).
3. In the Supabase dashboard → **Authentication → Providers → Google**, paste the
   client ID and secret and enable the provider.
4. Under **Authentication → URL Configuration**, set your site URL and redirect
   URLs (e.g. `http://localhost:3000` for dev, your domain for prod).

The downloaded Google client-secret JSON belongs only in the Supabase dashboard —
never commit it (it's already in `.gitignore`).

## 4. Point the app at your project

```bash
cp .env.example .env.local
```

Fill in your project's **Project URL** and **publishable (anon) key** (Supabase
dashboard → Project Settings → API). Both are public values, safe in the browser;
row-level security is the real boundary and the app uses no service-role key.

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

Sign in with Google; with no workspace yet you'll land on `/welcome`, where you
can create your first one.

## 5. Deploy (optional)

CryoMap deploys as a standard Next.js app. On your host (Vercel, etc.) set the
same two environment variables (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`) for the deployment, pointed at your project. The
production build prerenders auth-gated pages, so the variables must be present at
build time.

## 6. Verify

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm test:rls      # workspace tenant-isolation (needs a local Postgres)
```

See [`DEPENDENCIES.md`](./DEPENDENCIES.md) for the dependency/license/security
posture.
