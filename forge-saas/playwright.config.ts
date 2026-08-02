import { defineConfig } from "@playwright/test";

// Phase 0 verification tooling — see docs/kids-mode/06-adult-regression-checklist.md
// and docs/kids-mode/01-decisions.md E-009 for why this exists and what it does
// and doesn't cover. Runs against a real local Supabase stack (started by
// .github/workflows/db-tests.yml), never against production — there is no
// mechanism here for pointing this at a real project, deliberately.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
