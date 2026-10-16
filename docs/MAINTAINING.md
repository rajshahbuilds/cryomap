# Maintaining CryoMap

The recurring routine for keeping CryoMap healthy after the open-source launch.
Maintainer-facing companion to [`CONTRIBUTING.md`](../CONTRIBUTING.md) and
[`SECURITY.md`](../SECURITY.md).

## Issue triage

- **Cadence:** triage new issues on a best-effort weekly pass (no SLA — see
  [`SUPPORT.md`](../SUPPORT.md)).
- Label by type (`bug`, `enhancement`) and rough priority; close duplicates and
  out-of-scope requests with a brief explanation.
- Security reports never go through public issues — handle per
  [`SECURITY.md`](../SECURITY.md).

## Reviewing contributions

Before merging a PR, check:

- **Correctness & tests** — behavior changes have tests; schema/RLS changes are
  covered by `supabase/tests/`. CI (typecheck, lint, format, unit, RLS, build,
  e2e) is green.
- **Security** — no new secrets, no service-role key, no RLS weakening, no
  logging of diagram contents; dependency additions are scrutinized.
- **Licensing** — contribution is under Apache-2.0 and DCO-signed (`-s`); new
  dependencies are license-compatible (update `NOTICE` /
  `docs/THIRD_PARTY_LICENSES.md` if needed).
- **Scope & conventions** — fits the project's scope; matches architecture
  (pure logic in `lib/**`, DB access only in `lib/repositories/**`, light-theme
  tokens).

## Releases

- Use [Semantic Versioning](https://semver.org/). Pre-1.0, breaking changes may
  land in minor releases; call them out clearly.
- Publish each release as a GitHub Release with notes summarizing changes.
- **Database-affecting releases must include migration notes**: which migrations
  to apply, any backfill/rehearsal guidance, and ordering. Rehearse row-touching
  migrations on a restored backup first, never directly on production.
- Don't promise uptime or response times.

## Vulnerability remediation & disclosure

1. Receive reports privately (`SECURITY.md`).
2. Confirm and assess severity/scope without copying user data into tickets.
3. Fix on a private branch; add a regression test.
4. Release the fix and rotate any exposed credentials.
5. Disclose after a fix is available: publish a GitHub Security Advisory
   crediting the reporter (with consent) and note it in release notes.

## Dependencies & CI

- Keep dependencies and GitHub Actions current; let Dependabot open update PRs
  and review them like any other.
- Re-run `pnpm audit --prod` (must stay clean) and `pnpm audit` each release;
  drop `pnpm-workspace.yaml` overrides once upstream ranges carry the fixes
  (see `docs/DEPENDENCIES.md`).
- Pin exact versions for the framework (Next.js) and bump deliberately, testing
  the full gate.
