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
test("certificate selection, editable message and canvas preview have accessible alternatives", async ({
  page,
}) => {
  await page.goto("/#certificates");
  await page
    .getByRole("button", { name: "Download PDF", exact: true })
    .waitFor();
  await page.waitForFunction(() =>
    document
      .querySelector(".certificate-paper")
      ?.classList.contains("is-ready"),
  );
  for (const theme of ["dark", "light"]) {
    if (theme === "light")
      await page.getByRole("button", { name: "Switch to light theme" }).click();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  }
});
test("certificate verification has accessible empty and missing states in both themes", async ({
  page,
}) => {
  await page.goto("/#verify");
  for (const theme of ["dark", "light"]) {
    if (theme === "light")
      await page.getByRole("button", { name: "Switch to light theme" }).click();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
  await page.getByLabel("Certificate ID or verification link").fill("unknown");
  await page.getByRole("button", { name: "Check certificate" }).click();
  await expect(
    page.getByRole("heading", { name: "Certificate not found" }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
