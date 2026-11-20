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
  await expect(
    page.getByRole("heading", { name: "BETORA OF THE YEAR" }),
  ).toBeVisible();
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
  await expect(
    page.getByRole("heading", { name: "Certificate of Recognition" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "BETORA OF THE YEAR" }),
  ).toHaveCount(0);
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
  expect(doc.getTitle()).toBe("BETORA OF THE YEAR · Saboor");
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

test("certificate renders the portrait for a renamed player ID and uses a monogram when a name is reused", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "ludo-super-league:players",
      JSON.stringify([
        {
          id: "demo-mubeen",
          name: "Mubeen A.",
          points_total: 32,
          active: true,
          created_at: "2026-01-01",
        },
        {
          id: "new-player",
          name: "Mubeen",
          points_total: 12,
          active: true,
          created_at: "2026-02-01",
        },
      ]),
    );
  });
  await open(page);
  const portrait = page.locator(".certificate-preview-avatar img");
  await expect(portrait).toHaveAttribute("src", /mubeen-avatar\.webp$/);
  await page.getByRole("button", { name: "Open full-size preview" }).click();
  const artworkMatches = await page
    .getByRole("dialog")
    .getByRole("img")
    .evaluate(async (artwork) => {
      await artwork.decode();
      const canvas = document.createElement("canvas");
      canvas.width = artwork.naturalWidth;
      canvas.height = artwork.naturalHeight;
      canvas.getContext("2d").drawImage(artwork, 0, 0);
      const image = document.querySelector(".certificate-preview-avatar img");
      await image.decode();
      const reference = document.createElement("canvas");
      reference.width = reference.height = 280;
      const expected = reference.getContext("2d");
      expected.imageSmoothingQuality = "high";
      expected.drawImage(image, 0, 0, 280, 280);
      const actual = canvas.getContext("2d");
      return [
        [110, 90],
        [140, 140],
        [175, 197],
      ].every(([x, y]) => {
        const a = actual.getImageData(220 + x, 1020 + y, 1, 1).data;
        const b = expected.getImageData(x, y, 1, 1).data;
        return a.every((value, channel) => Math.abs(value - b[channel]) < 12);
      });
    });
  expect(artworkMatches).toBe(true);
  await page.keyboard.press("Escape");

  await page.locator(".certificate-player").nth(1).click();
  await expect(
    page.getByRole("button", { name: "Download PDF", exact: true }),
  ).toBeEnabled();
  await expect(portrait).toHaveCount(0);
  await expect(page.locator(".certificate-preview-avatar")).toHaveText("M");
});

test("missing portrait and Ludo artwork fall back to a downloadable certificate", async ({
  page,
}) => {
  await page.route("**/saboor-avatar.webp", (route) => route.abort());
  await page.route("**/certificate-midnight-trophy.webp", (route) =>
    route.abort(),
  );
  await open(page);
  await expect(page.locator(".certificate-preview-avatar")).toHaveText("S");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download PNG", exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("ludo-2026-01-saboor.png");
});
