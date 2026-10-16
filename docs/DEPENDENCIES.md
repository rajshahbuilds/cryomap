# Dependencies: licenses & security posture

This document records CryoMap's dependency license review and vulnerability
posture for the open-source release. It is retained as the audit artifact for
the Apache-2.0 launch.

## License compatibility

CryoMap is distributed under **Apache-2.0** (see `LICENSE`). Every dependency
license has been reviewed for compatibility. The full per-package inventory is
in [`THIRD_PARTY_LICENSES.md`](./THIRD_PARTY_LICENSES.md); regenerate it any
time with:

```bash
pnpm licenses list          # human-readable
pnpm licenses list --json   # machine-readable
```

Summary (production + development tree):

| License | Count | Apache-2.0 compatible? |
| --- | --- | --- |
| MIT | ~400 | ✅ permissive |
| Apache-2.0 | ~25 | ✅ same license |
| ISC | ~15 | ✅ permissive |
| BSD-2-Clause / BSD-3-Clause | ~12 | ✅ permissive |
| MPL-2.0 (and `MPL-2.0 OR Apache-2.0`) | ~4 | ✅ file-level copyleft, used unmodified |
| MIT-0 / 0BSD / CC0-1.0 / BlueOak-1.0.0 / Python-2.0 | ~7 | ✅ permissive |
| CC-BY-4.0 (`caniuse-lite`) | 1 | ✅ attribution only (see `NOTICE`) |
| LGPL-3.0-or-later (`sharp`→libvips) | 1 | ✅ dynamically-used native lib, unmodified |

**Conclusion:** no dependency license prevents redistribution of CryoMap under
Apache-2.0. Node dependencies are installed by the user via pnpm and are **not
vendored** into this repository, so the repository itself redistributes no
third-party source. Attribution and notice obligations that do apply are
collected in the top-level [`NOTICE`](../NOTICE) file.

Fonts (Geist, Geist Mono) are SIL OFL-1.1 (© Vercel) loaded via `next/font`.
Icons are inline SVG authored in-repo — no icon-library redistribution.

## Vulnerability posture

Audited with `pnpm audit`. Re-run before each release:

```bash
pnpm audit --prod   # production/runtime tree — must be clean for release
pnpm audit          # full tree, including dev/test/build tooling
```

### Production tree: clean ✅

`pnpm audit --prod` reports **no known vulnerabilities**. This is the release
gate. Getting here required:

- Upgrading **Next.js 16.2.9 → 16.4.2**, which closed a *critical*
  unauthenticated RCE, a *high* middleware/proxy-bypass, a *moderate* SSG/ISR
  cache-poisoning, and a *low* dev-server info disclosure, and pulled patched
  versions of several of Next's own transitive deps.
- pnpm `overrides` (in `pnpm-workspace.yaml`) forcing patched versions of
  transitive packages that lagged behind: `dompurify`, `browserslist`,
  `source-map-js`, `baseline-browser-mapping`, `braces`, `postcss`,
  `brace-expansion`, `js-yaml`. (Recently-published patched versions are also
  listed in `minimumReleaseAgeExclude` so the install-cooldown doesn't silently
  keep the vulnerable version.)

### Development/test tree: documented, accepted for beta

The full-tree audit still reports a small number of findings, **all confined to
build/test tooling that never ships to production** (the `pnpm audit --prod`
tree is clean). They are DoS-class issues that would require feeding malicious
input to our own lint/test/build toolchain, which does not occur for this
trusted repository. They are accepted for the v0.1.0 beta and will clear as the
upstream toolchains publish fixes:

| Package | Severity | Reached via | Why accepted |
| --- | --- | --- | --- |
| `braces` | high | `eslint-config-next` | Already at latest (3.0.3); no upstream fix published yet. Lint-time only. |
| `vitest`, `@vitest/mocker` | moderate | `vitest` | Test-runner path-traversal; test-time only, trusted inputs. |
| `undici` | moderate / low | `jsdom`, `vitest` | Test-environment HTTP client; not in the app runtime. |

Review these at each release and drop the corresponding `overrides` entries once
upstream ranges carry the fixes natively.
