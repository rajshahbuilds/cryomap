import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// An opt-in authenticated suite; never accept a hosted database or production credentials.
const local = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((line) => /^NEXT_PUBLIC_SUPABASE_(URL|ANON_KEY)=/.test(line))
    .map((line) => {
      const at = line.indexOf("=");
      const value = line.slice(at + 1).trim();
      return [
        line.slice(0, at),
        value.startsWith('"') ? JSON.parse(value) : value,
      ];
    }),
);
if (local.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:54321")
  throw new Error(
    "Wire browser tests require the local Supabase instance. Run pnpm dev:setup first.",
  );
process.env.CRYOMAP_TEST_SUPABASE_URL = local.NEXT_PUBLIC_SUPABASE_URL;
process.env.CRYOMAP_TEST_SUPABASE_ANON_KEY =
  local.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export default defineConfig({
  testDir: "./e2e-local",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
  ],
  webServer: {
    command: "pnpm dev --hostname localhost",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    env: local,
  },
});
