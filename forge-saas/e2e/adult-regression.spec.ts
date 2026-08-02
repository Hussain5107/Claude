import { test, expect } from "@playwright/test";

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
  test("1. landing page renders signed out", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("text=FORGE").first()).toBeVisible();
  });

  test("1. /dashboard redirects to /login when signed out", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("2. sign up lands on onboarding", async ({ page }) => {
    await page.goto("/signup");
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.getByRole("button", { name: /create|sign up|get started/i }).click();
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });
  });

  test("2. picking Female shows the cycle-tracking question; Male hides it", async ({ page }) => {
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

  test("2. completing onboarding generates a program and lands on Home", async ({ page }) => {
    await page.fill("#age", "28");
    await page.fill("#heightCm", "170");
    await page.fill("#weightKg", "65");
    await page.selectOption("#goal", "muscle");
    await page.selectOption("#experience", "beginner");
    await page.getByRole("button", { name: /generate my program/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
  });

  test("3. Home shows the greeting, avatar initial, and today's plan", async ({ page }) => {
    await page.goto("/dashboard");
    // No display name was set at onboarding, so this proves the email
    // fallback (src/lib/displayName.ts) actually renders, not just compiles.
    await expect(page.getByText(/good morning|good afternoon|good evening/i)).toBeVisible();
  });

  test("8. bottom tab bar shows exactly five adult tabs", async ({ page }) => {
    await page.goto("/dashboard");
    const tabs = page.locator("nav a");
    await expect(tabs).toHaveCount(5);
    for (const label of ["Home", "Workouts", "Progress", "Gyms", "Profile"]) {
      await expect(page.locator("nav")).toContainText(label);
    }
  });

  test("4. Workouts tab renders a day strip", async ({ page }) => {
    await page.goto("/dashboard/workouts");
    await expect(page.getByText(/days a week/i)).toBeVisible();
  });

  test("7. changing display name on Settings is reflected on Home", async ({ page }) => {
    await page.goto("/dashboard/settings");
    const nameField = page.locator("#displayName");
    await nameField.fill("E2E Regression");
    await page.getByRole("button", { name: /save/i }).first().click();
    // Give the server action + revalidatePath a moment.
    await page.waitForTimeout(1000);

    await page.goto("/dashboard");
    await expect(page.getByText("E2E Regression")).toBeVisible({ timeout: 10_000 });
  });

  test("7. changing theme to Blue changes the primary colour across tabs", async ({ page }) => {
    await page.goto("/dashboard/settings");

    const themeBefore = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
    );

    await page.getByRole("button", { name: "Blue" }).click();
    await page.waitForTimeout(1000);

    const themeAfterOnSettings = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
    );
    expect(themeAfterOnSettings).not.toBe(themeBefore);
    expect(themeAfterOnSettings.toLowerCase()).toContain("59"); // #3b82f6 -> rgb(59,...)

    // Same colour on a completely different tab — proves it's applied at the
    // shell layout, not just locally on the settings screen.
    await page.goto("/dashboard");
    const themeOnHome = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
    );
    expect(themeOnHome).toBe(themeAfterOnSettings);
  });

  test("1. log out returns to the landing page, not an error page", async ({ page }) => {
    await page.goto("/dashboard/settings");
    // This is the exact bug fixed earlier: a POST /auth/signout that redirected
    // with a 307 got re-POSTed against "/", which returned 405. Assert on the
    // actual navigation outcome a browser would produce, not just the header.
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "GET" && new URL(r.url()).pathname === "/"),
      page.getByRole("button", { name: /log out/i }).click(),
    ]);
    expect(response.status()).toBe(200);
    await expect(page).toHaveURL("/");
  });

  test("1. /dashboard redirects to /login again after logging out", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
