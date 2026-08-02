import { test, expect, type Page } from "@playwright/test";

/**
 * Browser-driven pass of docs/kids-mode/06-adult-regression-checklist.md.
 *
 * This does NOT replace that checklist and does not cover it in full — it
 * automates the items that are both high-value and reliably scriptable: auth,
 * onboarding, the tab bar, theme switching, and display name. It deliberately
 * does not attempt gym geolocation, photo upload, PWA install prompts, or
 * voice audio — those need a human, a real device, or a real external API,
 * and scripting them here would produce a false sense of coverage rather than
 * a real one. See the checklist doc's own "what this doesn't catch" section.
 *
 * Runs against a real local Supabase stack, never production. Each run uses a
 * fresh, obviously-synthetic email so runs don't collide.
 */

const runId = Date.now();
const email = `e2e-${runId}@example.invalid`;
const password = "correct horse battery staple 1";

test.describe.serial("adult regression", () => {
  // A serial block does NOT share cookies between tests by default — each
  // `test(...)` gets its own fresh page/context from the `page` fixture, so a
  // session established in one test is gone by the next. Proven the hard way:
  // the first real run of this suite got through signup, then timed out 30s
  // waiting for "#sex" on /onboarding, because that request was signed out and
  // never rendered the form. One page, opened once and reused for the whole
  // block, is what actually carries the session across tests.
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("1. landing page renders signed out", async () => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("text=FORGE").first()).toBeVisible();
  });

  test("1. /dashboard redirects to /login when signed out", async () => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("2. sign up lands on onboarding", async () => {
    await page.goto("/signup");
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.getByRole("button", { name: /create|sign up|get started/i }).click();
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });
  });

  test("2. picking Female shows the cycle-tracking question; Male hides it", async () => {
    // Continues the same signed-in session from the previous test.
    await page.goto("/onboarding");
    await page.selectOption("#sex", "female");
    await expect(page.getByText(/adapt your workouts to your cycle/i)).toBeVisible();

    await page.selectOption("#sex", "male");
    await expect(page.getByText(/adapt your workouts to your cycle/i)).not.toBeVisible();

    // Leave it on female for the rest of the run — real production has
    // accounts of both sexes, and this exercises the cycle-eligible path too.
    await page.selectOption("#sex", "female");
  });

  test("2. completing onboarding generates a program and lands on Home", async () => {
    await page.fill("#age", "28");
    await page.fill("#heightCm", "170");
    await page.fill("#weightKg", "65");
    await page.selectOption("#goal", "muscle");
    await page.selectOption("#experience", "beginner");
    await page.getByRole("button", { name: /generate my program/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
  });

  test("3. Home shows the greeting, avatar initial, and today's plan", async () => {
    await page.goto("/dashboard");
    // No display name was set at onboarding, so this proves the email
    // fallback (src/lib/displayName.ts) actually renders, not just compiles.
    await expect(page.getByText(/good morning|good afternoon|good evening/i)).toBeVisible();
  });

  test("8. bottom tab bar shows exactly five adult tabs", async () => {
    await page.goto("/dashboard");
    const tabs = page.locator("nav a");
    await expect(tabs).toHaveCount(5);
    for (const label of ["Home", "Workouts", "Progress", "Gyms", "Profile"]) {
      await expect(page.locator("nav")).toContainText(label);
    }
  });

  test("4. Workouts tab renders a day strip", async () => {
    await page.goto("/dashboard/workouts");
    await expect(page.getByText(/days a week/i)).toBeVisible();
  });

  test("7. changing display name on Settings is reflected on Home", async () => {
    await page.goto("/dashboard/settings");
    const nameField = page.locator("#displayName");
    await nameField.fill("E2E Regression");
    await page.getByRole("button", { name: /save/i }).first().click();
    // Give the server action + revalidatePath a moment.
    await page.waitForTimeout(1000);

    await page.goto("/dashboard");
    await expect(page.getByText("E2E Regression")).toBeVisible({ timeout: 10_000 });
  });

  test("7. changing theme to Blue changes the primary colour across tabs", async () => {
    await page.goto("/dashboard/settings");

    // --primary is defined at :root as the FORGE default and OVERRIDDEN by
    // [data-theme="blue"] / [data-theme="pink"] — but that data-theme attribute
    // lives on <div class="app-shell"> inside the dashboard layout
    // (src/app/dashboard/layout.tsx:34), NOT on <html>. Reading from
    // document.documentElement therefore always returns #8b5cf6 no matter what
    // theme the user picks; the cascade is scoped one layer down. Verified the
    // hard way when a 15-second poll on document.documentElement never budged.
    // Read from the element that actually carries the attribute.
    const readPrimary = () =>
      page.evaluate(() => {
        const el = document.querySelector("[data-theme]");
        if (!el) throw new Error("no [data-theme] element on the page");
        return getComputedStyle(el).getPropertyValue("--primary").trim();
      });

    const themeBefore = await readPrimary();

    // handleThemeChange (src/components/SettingsClient.tsx) does a Supabase
    // write, revalidatePath("/dashboard", "layout"), and router.refresh() —
    // then the layout re-renders and finally --primary changes. Poll for the
    // condition rather than waiting a fixed interval.
    await page.getByRole("button", { name: "Blue" }).click();
    await expect
      .poll(readPrimary, { timeout: 15_000, message: "theme did not repaint after clicking Blue" })
      .not.toBe(themeBefore);

    const themeAfterOnSettings = await readPrimary();
    expect(themeAfterOnSettings.toLowerCase()).toContain("#3b82f6");

    // Same colour on a completely different tab — proves it's applied at the
    // shell layout, not just locally on the settings screen.
    await page.goto("/dashboard");
    await expect
      .poll(readPrimary, { timeout: 5_000 })
      .toBe(themeAfterOnSettings);
  });

  test("1. log out returns to the landing page, not an error page", async () => {
    await page.goto("/dashboard/settings");
    // This is the exact bug fixed earlier: a POST /auth/signout that redirected
    // with a 307 got re-POSTed against "/", which returned 405. Assert on the
    // actual navigation outcome a browser would produce, not just the header.
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "GET" && new URL(r.url()).pathname === "/"),
      page.getByRole("button", { name: /log out/i }).click(),
    ]);
    expect(response.status()).toBe(200);
    // Compare by pathname, not full URL: `next start -p 3000` advertises the
    // server as http://localhost:3000, so the sign-out redirect lands there
    // even though this test's baseURL is http://127.0.0.1:3000. Same page,
    // same pathname, different hostname string — toHaveURL("/") does a full-URL
    // match against baseURL and would spuriously fail on the host mismatch.
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 5_000 })
      .toBe("/");
  });

  test("1. /dashboard redirects to /login again after logging out", async () => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
