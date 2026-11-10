import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { readFile } from "node:fs/promises";
async function open(page) {
  await page.goto("/#certificates");
  await expect(
    page.getByRole("heading", { name: "Player certificates", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download PDF", exact: true }),
  ).toBeEnabled();
}
test("each active player has a personalised certificate and separate local message", async ({
  page,
}) => {
  await open(page);
  await expect(page.locator(".certificate-player")).toHaveCount(11);
  await expect(page.locator(".certificate-content")).toContainText("Saboor");
  await page
    .getByRole("textbox", { name: "Personal certificate message" })
    .fill("A memorable evening at the table.");
  await expect(
    page.getByRole("button", { name: "Download PDF", exact: true }),
  ).toBeEnabled();
  await page
    .locator(".certificate-player")
    .filter({ hasText: "Mubeen" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Personal certificate message" }),
  ).toHaveValue("");
  await expect(page.locator(".certificate-content")).toContainText(
    "Distinguished contender",
  );
  await page
    .locator(".certificate-player")
    .filter({ hasText: "Saboor" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Personal certificate message" }),
  ).toHaveValue("A memorable evening at the table.");
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Personal certificate message" }),
  ).toHaveValue("A memorable evening at the table.");
});
test("PDF and PNG downloads have the correct page and image dimensions", async ({
  page,
}, info) => {
  await open(page);
  const pdfPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  const pdf = await pdfPromise;
  expect(pdf.suggestedFilename()).toBe("ludo-2026-01-saboor.pdf");
  const pdfPath = info.outputPath("certificate.pdf");
  await pdf.saveAs(pdfPath);
  const doc = await PDFDocument.load(await readFile(pdfPath));
  expect(doc.getPageCount()).toBe(1);
  expect(doc.getPage(0).getWidth()).toBeCloseTo(841.89, 1);
  expect(doc.getPage(0).getHeight()).toBeCloseTo(595.276, 1);
  const pngPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG", exact: true }).click();
  const png = await pngPromise;
  const pngPath = info.outputPath("certificate.png");
  await png.saveAs(pngPath);
  const bytes = await readFile(pngPath);
  expect(bytes.subarray(1, 4).toString()).toBe("PNG");
  expect(bytes.readUInt32BE(16)).toBe(3500);
  expect(bytes.readUInt32BE(20)).toBe(2475);
});
test("long names, maximum messages, mobile layout and reduced motion", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "ludo-super-league:players",
      JSON.stringify([
        {
          id: "long",
          name: "Éléonore de la Table",
          points_total: 32,
          active: true,
          created_at: "2026-01-01",
        },
      ]),
    ),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await page
    .getByRole("textbox", { name: "Personal certificate message" })
    .fill(
      "For the stories, the rivalry, and every memorable round. "
        .repeat(12)
        .slice(0, 600),
    );
  await expect(
    page.getByRole("button", { name: "Download PDF", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".league-crown")
      .evaluate((el) => getComputedStyle(el, "::before").animationName),
  ).toBe("none");
});
test("no players, empty search, profile certificate links and crown spotlight", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "View profile", exact: true }).click();
  await page
    .getByRole("button", { name: "View player certificate", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Player certificates", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search certificate players" })
    .fill("no match");
  await expect(
    page.getByText("No player matches", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.locator(".certificate-player")).toHaveCount(11);
  await page.addInitScript(() =>
    localStorage.setItem("ludo-super-league:players", "[]"),
  );
  await page.reload();
  await expect(
    page.getByText("No certificates yet", { exact: true }),
  ).toBeVisible();
});
test("every listed player finishes rendering and stale links cannot export another player", async ({
  page,
}) => {
  await open(page);
  const count = await page.locator(".certificate-player").count();
  for (let i = 0; i < count; i++) {
    await page.locator(".certificate-player").nth(i).click();
    await expect(
      page.getByRole("button", { name: "Download PDF", exact: true }),
    ).toBeEnabled();
    await expect(page.locator(".certificate-paper")).toHaveClass(/is-ready/);
  }
  await page.goto("/#certificates=archived-player");
  await expect(
    page.getByText("Player certificate unavailable", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download PDF", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "View current collection" }).click();
  await expect(
    page.getByRole("button", { name: "Download PDF", exact: true }),
  ).toBeEnabled();
});
