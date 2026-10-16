import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests against a *deployed* URL (production or a PR preview) rather than
 * a local dev server. Point it at a deployment with `SMOKE_BASE_URL`; defaults
 * to production. There is no `webServer` — the target is already running.
 *
 *   SMOKE_BASE_URL=https://<preview>.vercel.app pnpm test:smoke
 */
const baseURL = process.env.SMOKE_BASE_URL ?? "https://cryomap.vercel.app";

/**
 * Preview deployments sit behind Vercel Deployment Protection, which answers an
 * unauthenticated request with a 401 interstitial — every smoke test would fail
 * on a redirect to Vercel's login. Vercel's "Protection Bypass for Automation"
 * issues a secret that waives it for a request carrying this header.
 *
 * Set `VERCEL_AUTOMATION_BYPASS_SECRET` (Vercel → Settings → Deployment
 * Protection) when targeting a protected preview. Unset — the production case —
 * no headers are sent and nothing changes.
 *
 * `x-vercel-set-bypass-cookie` makes Vercel return a cookie on the first
 * response, so client-side navigations within a test stay authorized without
 * re-sending the secret.
 */
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const extraHTTPHeaders = bypassSecret
  ? {
      "x-vercel-protection-bypass": bypassSecret,
      "x-vercel-set-bypass-cookie": "samesitenone",
    }
  : undefined;

export default defineConfig({
  testDir: "./e2e-smoke",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 2,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    extraHTTPHeaders,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
