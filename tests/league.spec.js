import { test, expect } from "@playwright/test";
async function open(page) {
  await page.goto("/");
  await expect(page.locator(".player-row").first()).toBeVisible();
}
async function login(page) {
  await page.getByRole("button", { name: "Scorekeeper", exact: true }).click();
  await page.getByLabel("Username or email").fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("ludo2026");
  await page.getByRole("button", { name: "Unlock the scorebook" }).click();
  await expect(page.getByRole("dialog")).toContainText("Make the board");
}
test("ties are stable; search has a recoverable empty state; sorting preserves ranks", async ({
  page,
}) => {
  await open(page);
  await expect(page.locator(".player-row").first()).toContainText("Saboor");
  await expect(page.locator(".player-row").nth(1)).toContainText("Mubeen");
  await page.getByRole("textbox", { name: "Search players" }).fill("nobody");
  await expect(page.getByText("No players match that search.")).toBeVisible();
  await page.getByRole("button", { name: "Reset search" }).click();
  await expect(page.locator(".player-row")).toHaveCount(11);
  await page.getByLabel("Sort players").selectOption("name");
  await expect(page.locator(".player-row").first()).toContainText("Abid");
  await expect(page.locator(".player-row").first()).toContainText("08");
});
test("scorekeeper requires consent and publishes a score change with activity", async ({
  page,
}) => {
  await open(page);
  await login(page);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Who earned it?").selectOption("demo-saboor");
  await dialog.getByLabel("Official-ish reason").fill("Lost the round");
  const submit = dialog.getByRole("button", { name: "Sign and publish point" });
  await expect(submit).toBeDisabled();
  await dialog.getByRole("checkbox").check();
  await submit.click();
  await expect(page.getByRole("status").last()).toContainText("point signed");
  await expect(submit).toBeDisabled();
  await page.getByRole("button", { name: "Close admin panel" }).click();
  await expect(
    page.locator(".player-row").first().locator(".row-points strong"),
  ).toHaveText("9");
  await expect(page.locator(".public-activity")).toContainText("Saboor");
  await expect(page.locator(".public-activity")).toContainText("+1");
});
test("login errors, password visibility, focus trap and Escape", async ({
  page,
}) => {
  await open(page);
  const trigger = page.getByRole("button", {
    name: "Scorekeeper",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Close admin panel" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "Unlock the scorebook" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Close admin panel" }),
  ).toBeFocused();
  await page.getByLabel("Username or email").fill("wrong");
  await page.getByLabel("Password", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "Show", exact: true }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Unlock the scorebook" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
test("profile closes with Escape and returns focus; missing history is explicit", async ({
  page,
}) => {
  await open(page);
  const row = page.locator(".player-row").first();
  await row.click();
  await expect(page.getByRole("dialog")).toContainText(
    "No score history is available",
  );
  await page.keyboard.press("Escape");
  await expect(row).toBeFocused();
});
test("empty league, no events and long names fit 320px screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.addInitScript(() =>
    localStorage.setItem("ludo-super-league:players", "[]"),
  );
  await page.goto("/");
  await expect(page.getByText("No players on the board yet")).toBeVisible();
  await expect(page.getByText("No recorded activity yet")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("responsive menu, light theme, long names, large totals and offline state", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "ludo-super-league:players",
      JSON.stringify([
        {
          id: "long",
          name: "A very long player name here",
          points_total: 123456,
          created_at: "2026-01-01",
          active: true,
        },
      ]),
    ),
  );
  await page.setViewportSize({ width: 320, height: 740 });
  await open(page);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow at ${width}`,
    ).toBe(true);
  }
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  // Browsers supply navigator.onLine; the offline context is tested below.
  await page.context().setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(
    page.getByRole("status").filter({ hasText: "You are offline" }),
  ).toBeVisible();
});
