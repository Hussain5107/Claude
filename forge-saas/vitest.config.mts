import { defineConfig } from "vitest/config";

// Node environment, not jsdom: everything under test today is pure domain
// logic with no DOM. Component tests (jsdom + React Testing Library) are
// deferred until something actually needs them — see docs/kids-mode/01-decisions.md.
//
// resolve.tsconfigPaths resolves the "@/*" alias natively — Vite added this
// directly, which is why there's no vite-tsconfig-paths plugin dependency here
// despite the Next.js testing guide listing one: this repo's Vite version
// (pulled in by vitest ^4) is new enough not to need it.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
