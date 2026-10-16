<!--
Thanks for contributing to CryoMap! Please keep PRs focused on one change.
By submitting this PR you agree your contribution is licensed under Apache-2.0.
-->

## What & why

Describe the change and the motivation. Link any related issue (e.g. `Closes #123`).

## How it was tested

Which of these did you run, and what did you add?

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm format:check`
- [ ] `pnpm test`
- [ ] `pnpm test:rls` (if touching the schema or RLS)
- [ ] `pnpm build`
- [ ] Added/updated tests for this change

## Checklist

- [ ] Commits are signed off (DCO): `git commit -s` (see CONTRIBUTING.md)
- [ ] No secrets, `.env*` files, or data dumps are included
- [ ] Schema changes are new append-only migrations in `supabase/migrations/`
- [ ] Docs updated if behavior or setup changed
