import { test, expect } from "@playwright/test";
async function open(page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "League overview", exact: true }),
  ).toBeVisible();
}
async function login(page) {
  await page
    .locator(".dash-top-actions")
    .getByRole("button", { name: "Scorekeeper", exact: true })
    .click();
  await page.getByLabel("Username or email").fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("ludo2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Manage the league");
}
const events = () =>
  Array.from({ length: 18 }, (_, i) => ({
    player_id: i % 3 === 0 ? "demo-mubeen" : "demo-saboor",
    event_number: i + 1,
    points: i === 4 ? -1 : i % 4 === 0 ? 3 : 1,
    created_at: new Date(Date.now() - (17.5 - i) * 86400000).toISOString(),
  }));
async function seed(page) {
  await page.addInitScript(
    (e) => localStorage.setItem("ludo-super-league:events", JSON.stringify(e)),
    events(),
  );
}
test("stable ties, search recovery, and sorting retain original ranks", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("link", { name: "Players", exact: false }).click();
  await expect(
    page.getByRole("heading", { name: "The players", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".dash-player-row").first()).toContainText(
    "Saboor",
  );
  await expect(page.locator(".dash-player-row").nth(1)).toContainText("Mubeen");
  await page.getByRole("textbox", { name: "Search players" }).fill("nobody");
  await expect(page.getByText("No players match that search")).toBeVisible();
  await page.getByRole("button", { name: "Reset search" }).click();
  await expect(page.locator(".dash-player-row")).toHaveCount(11);
  await page.getByLabel("Sort players").selectOption("name");
  await expect(page.locator(".dash-player-row").first()).toContainText("Abid");
  await expect(page.locator(".dash-player-row").first()).toContainText("08");
});
test("awards require new consent; current score and public activity update", async ({
  page,
}) => {
  await open(page);
  await login(page);
  const d = page.getByRole("dialog");
  await d.getByLabel("Player", { exact: true }).selectOption("demo-saboor");
  await d.getByLabel("Reason for the penalty").fill("Lost the round");
  const submit = d.getByRole("button", { name: "Sign and publish point" });
  await expect(submit).toBeDisabled();
  await d.getByRole("checkbox").check();
  await submit.click();
  await expect(page.getByRole("status").last()).toContainText("point signed");
  await expect(submit).toBeDisabled();
  await page.getByRole("button", { name: "Close admin panel" }).click();
  await expect(page.locator(".dash-standing").first()).toContainText("9");
  await page.getByRole("link", { name: "Activity", exact: true }).click();
  await expect(page.locator(".dash-event-table")).toContainText("Saboor");
  await expect(page.locator(".dash-event-table")).toContainText("+1");
});
test("login failure, password visibility, focus trap, and focus restoration", async ({
  page,
}) => {
  await open(page);
  const trigger = page
    .locator(".dash-top-actions")
    .getByRole("button", { name: "Scorekeeper", exact: true });
  await trigger.click();
  const d = page.getByRole("dialog");
  await expect(
    d.getByRole("button", { name: "Close admin panel" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    d.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    d.getByRole("button", { name: "Close admin panel" }),
  ).toBeFocused();
  await page.getByLabel("Username or email").fill("wrong");
  await page.getByLabel("Password", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "Show", exact: true }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(d).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
test("player workspace has date-filtered graphs, comparison, data tables and pagination", async ({
  page,
}) => {
  await seed(page);
  await open(page);
  await page.locator(".dash-standing").first().click();
  await expect(page).toHaveURL(/#player=/);
  await expect(
    page.getByRole("heading", { name: "Saboor", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Score timeline", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Compare with player" })
    .selectOption("demo-sohail");
  await expect(page.locator(".dash-legend").first()).toContainText("Sohail");
  await page.getByText("View chart data", { exact: true }).first().click();
  await expect(page.locator(".dash-chart-data[open] table")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next page" })).toBeEnabled();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator(".dash-pagination")).toContainText("2 /");
  await page.getByRole("button", { name: "7 days", exact: true }).click();
  await expect(page.locator(".dash-event-table tbody tr")).toHaveCount(5);
  await page.getByRole("button", { name: "All players", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "The players", exact: true }),
  ).toBeVisible();
});
test("export creates a CSV of available history", async ({ page }) => {
  await seed(page);
  await open(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("ludo-score-history.csv");
});
test("empty and missing player states are useful; invalid hashes do not crash", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("ludo-super-league:players", "[]"),
  );
  await open(page);
  await expect(page.getByText("No players yet")).toBeVisible();
  await page.goto("/#player=missing");
  await expect(
    page.getByRole("heading", { name: "Player unavailable" }),
  ).toBeVisible();
  await page.goto("/#%invalid");
  await expect(
    page.getByRole("heading", { name: "League overview", exact: true }),
  ).toBeVisible();
});
test("phone and tablet layouts, large scores, long names, light theme and offline", async ({
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
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Players", exact: false }).click();
  await page.locator(".dash-player-row").first().click();
  await expect(
    page.getByRole("heading", { name: "A very long player name here" }),
  ).toBeVisible();
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
  await page.context().setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(
    page.getByRole("status").filter({ hasText: "You are offline" }),
  ).toBeVisible();
});
test("disabled and malformed browser storage do not prevent demo loading", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("ludo-super-league:players", '{"bad":true}');
    localStorage.setItem("ludo-super-league:events", '{"bad":true}');
  });
  await open(page);
  await expect(page.locator(".dash-standing")).toHaveCount(6);
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "League overview", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".dash-standing")).toHaveCount(6);
});
test("corrections require consent and cannot create a negative score", async ({
  page,
}) => {
  await open(page);
  await login(page);
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: "Players Add and edit" }).click();
  await d.getByLabel("Player to correct").selectOption("demo-saboor");
  await d.getByLabel("Correction points").fill("-999");
  await d.getByLabel("Reason for correction").fill("Correct duplicate award");
  const submit = d.getByRole("button", {
    name: "Sign correction",
    exact: true,
  });
  await expect(submit).toBeDisabled();
  await d
    .getByRole("checkbox", {
      name: "I confirm this score correction and its reason",
    })
    .check();
  await submit.click();
  await expect(page.getByRole("status").last()).toContainText("negative");
  await d.getByLabel("Correction points").fill("-1");
  await submit.click();
  await expect(page.getByRole("status").last()).toContainText(
    "Score correction signed",
  );
  await expect(submit).toBeDisabled();
  await page.getByRole("button", { name: "Close admin panel" }).click();
  await page.getByRole("link", { name: "Activity", exact: true }).click();
  await expect(page.locator(".dash-event-table")).toContainText("-1");
  await expect(page.locator(".dash-event-table")).toContainText("Correction");
});

test("navigation preserves search typed before a delayed hashchange event", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.addEventListener(
      "hashchange",
      (event) => {
        if (window.navigationTestDelayed) return;
        event.stopImmediatePropagation();
        window.navigationTestDelayed = true;
        setTimeout(() => {
          window.dispatchEvent(new HashChangeEvent("hashchange"));
          window.navigationTestSettled = true;
        }, 600);
      },
      true,
    );
  });
  await open(page);
  await page.getByRole("link", { name: "Players", exact: false }).click();
  await page.getByRole("textbox", { name: "Search players" }).fill("nobody");
  await page.waitForFunction(() => window.navigationTestSettled === true);
  await expect(
    page.getByRole("heading", { name: "The players", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Search players" }),
  ).toHaveValue("nobody");
  await expect(page.getByText("No players match that search")).toBeVisible();
});
