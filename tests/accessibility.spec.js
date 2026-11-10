import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("dashboard and player workspace meet automated WCAG AA checks in both themes", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("heading", { name: "League overview", exact: true })
    .waitFor();
  for (const theme of ["dark", "light"]) {
    if (theme === "light")
      await page.getByRole("button", { name: "Switch to light theme" }).click();
    const overview = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(overview.violations).toEqual([]);
  }
  await page.locator(".dash-standing").first().click();
  const profile = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(profile.violations).toEqual([]);
  await page
    .locator(".dash-top-actions")
    .getByRole("button", { name: "Scorekeeper" })
    .click();
  const login = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(login.violations).toEqual([]);
});
