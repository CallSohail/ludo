import { expect } from "@playwright/test";

export async function openScorekeeperLogin(page) {
  await page.getByRole("link", { name: "Rules", exact: true }).first().click();
  await page.getByText("Scorekeeper access", { exact: true }).click();
  const trigger = page.getByRole("button", {
    name: "Scorekeeper sign in",
    exact: true,
  });
  await trigger.click();
  return trigger;
}

export async function loginScorekeeper(page) {
  await openScorekeeperLogin(page);
  await page.getByLabel("Username or email").fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("ludo2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Manage the league");
}
