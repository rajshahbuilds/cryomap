# Contributing to CryoMap

Thanks for your interest in improving CryoMap! Contributions — bug reports,
fixes, features, and docs — are welcome. CryoMap is a public beta maintained on a
best-effort basis, so please set expectations accordingly (see
[`SUPPORT.md`](./SUPPORT.md)).

By participating you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Licensing of contributions

CryoMap is licensed under [Apache-2.0](./LICENSE). **By submitting a
contribution, you agree it is provided under the Apache License 2.0** (inbound =
outbound, per section 5 of the license), and that you have the right to submit it.

### Developer Certificate of Origin (sign-off required)

Contributions must be signed off under the
[Developer Certificate of Origin](https://developercertificate.org/) (DCO). This
is a lightweight, CLA-free affirmation that you wrote the change or otherwise
have the right to contribute it under Apache-2.0. Add a sign-off to each commit:

```bash
git commit -s -m "Your message"
```

which appends a `Signed-off-by: Your Name <you@example.com>` trailer matching
your git identity. Unsigned commits will be asked to amend before merge.

## Development setup

See the [README](./README.md#quick-start-local-development) and
[docs/SELF_HOSTING.md](./docs/SELF_HOSTING.md) to run CryoMap locally against your
own Supabase project. In short:

```bash
pnpm install
cp .env.example .env.local      # fill in your own Supabase project
pnpm dev
```

## Before you open a pull request

Run the full local gate — CI runs the same checks:

```bash
pnpm typecheck
pnpm lint
pnpm format        # or format:check to verify
pnpm test
pnpm test:rls      # tenant-isolation tests (needs a local Postgres)
pnpm build
```

Guidelines:

- **Keep PRs focused** — one logical change per PR; describe the why.
- **Match the codebase conventions.** Pure domain logic lives in `lib/**` and is
  unit-tested; only `lib/repositories/**` talks to Supabase; the app is
  light-theme only using the semantic Tailwind tokens in `app/globals.css`.
- **Add tests** for behavior changes. Database/RLS changes must be covered by the
  tenant-isolation suite in `supabase/tests/`.
- **Schema changes** are append-only migrations in `supabase/migrations/`
  (`<timestamp>_<name>.sql`); never edit a shipped migration.
- **Don't commit** secrets, `.env*` files, or data dumps.

## Reporting bugs & requesting features

Use the issue templates. For security issues, follow [`SECURITY.md`](./SECURITY.md)
instead of filing a public issue.

## Releases

Releases follow [Semantic Versioning](https://semver.org/) and are published as
GitHub Releases with notes describing notable changes; database-affecting
releases include migration notes. There is no fixed cadence during beta.
