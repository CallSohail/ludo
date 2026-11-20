import { test, expect } from "@playwright/test";
import { loginScorekeeper } from "./scorekeeper-helpers";

test("score input rejects ambiguous values, quick chips replace it, and only one entry is published and undone", async ({
  page,
}) => {
  await page.goto("/#scorekeeper");
  await expect(
    page.getByRole("heading", { name: "Scorekeeper access is restricted" }),
  ).toBeVisible();
  await expect(
    page.locator(".scorekeeper-desktop,.scorekeeper-fab"),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await loginScorekeeper(page);
  const dialog = page.getByRole("dialog", { name: "Manage the league" });
  const points = dialog.getByRole("textbox", { name: "Points", exact: true });
  const submit = dialog.getByRole("button", { name: /^Publish/ });
  await dialog
    .getByLabel("Reason for the penalty")
    .fill('A round with 🧩, and a "quote".');
  await dialog
    .getByRole("checkbox", { name: "Share this reason in public activity" })
    .check();
  await dialog
    .getByRole("checkbox", { name: "Witnessed", exact: true })
    .check();
  for (const value of ["", "0", "1.5", "-1", "text", "1e3", "1000"]) {
    await points.fill(value);
    await expect(submit).toBeDisabled();
    await expect(points).toHaveAttribute("aria-invalid", "true");
  }
  await dialog.getByRole("button", { name: "+1", exact: true }).click();
  await dialog.getByRole("button", { name: "+2", exact: true }).click();
  await expect(points).toHaveValue("2");
  await expect(
    dialog.getByRole("button", { name: "+2", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await points.fill(" 3 ");
  await expect(
    dialog.getByRole("button", { name: "+3", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByText("Saboor 8 → 11")).toBeVisible();
  await page.context().setOffline(true);
  await expect(submit).toBeDisabled();
  await expect(points).toHaveValue(" 3 ");
  await page.context().setOffline(false);
  await expect(submit).toBeEnabled();
  await submit.evaluate((button) => {
    button.form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    button.form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  await expect(dialog.getByRole("status")).toContainText("Penalty published");
  await dialog
    .getByRole("button", { name: "Undo penalty", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText("Penalty undone");
  await dialog.getByRole("button", { name: "Ledger", exact: true }).click();
  await expect(
    dialog.getByText("2 ledger entries", { exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Verify chain", exact: true })
    .click();
  await expect(dialog.getByText(/Chain verified/)).toBeVisible();

  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Activity", exact: true }).click();
  await expect(page.locator(".dash-event-table")).toContainText(
    "Undo of entry #1",
  );
  await page.getByRole("searchbox", { name: "Search entries" }).fill("quote");
  await expect(page.locator(".dash-event-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".dash-event-table")).toContainText("🧩");
});

test("Cancel on unsaved score stays in the sheet and Escape returns focus on confirm", async ({
  page,
}) => {
  await page.goto("/");
  await loginScorekeeper(page);
  const score = page.getByRole("dialog", { name: "Manage the league" });
  await score.getByLabel("Reason for the penalty").fill("Still editing");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.keyboard.press("Escape");
  await expect(score.getByLabel("Reason for the penalty")).toHaveValue(
    "Still editing",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.keyboard.press("Escape");
  await expect(score).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open scorekeeper", exact: true }),
  ).toBeFocused();
});
