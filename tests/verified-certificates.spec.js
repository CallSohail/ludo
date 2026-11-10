import { test, expect } from "@playwright/test";
import { PDFDocument, PDFName, PDFArray, PDFDict, PDFString } from "pdf-lib";
import { unzipSync } from "fflate";
import { readFile } from "node:fs/promises";
async function login(page) {
  await page
    .locator(".dash-top-actions")
    .getByRole("button", { name: "Scorekeeper", exact: true })
    .click();
  await page.getByLabel("Username or email").fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("ludo2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Manage the league");
  await page.getByRole("button", { name: "Close admin panel" }).click();
}
test("approved comments survive issuance, reload, multipage exports and revocation", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("cert-test-seeded")) {
      localStorage.setItem("cert-test-seeded", "true");
      localStorage.setItem(
        "ludo-super-league:events",
        JSON.stringify(
          Array.from({ length: 9 }, (_, i) => ({
            id: `demo-event-${i}`,
            event_number: i + 1,
            player_id: "demo-saboor",
            points: 1,
            reason:
              `Table memory ${i + 1}: ` +
              "A remarkable round with friends. ".repeat(5),
            created_at: "2026-11-01T12:00:00Z",
          })),
        ),
      );
    }
  });
  await page.goto("/#certificates");
  await login(page);
  const picker = page.locator(".certificate-comment-picker");
  await expect(picker.getByRole("checkbox")).toHaveCount(9);
  for (let i = 0; i < 9; i++) await picker.getByRole("checkbox").nth(i).check();
  await page
    .getByLabel("Personal certificate message")
    .fill("For every memorable roll.");
  const issue = page.getByRole("button", {
    name: "Issue certificate",
    exact: true,
  });
  await expect(issue).toBeDisabled();
  await page.getByRole("checkbox", { name: /I approve publishing/ }).check();
  await expect(issue).toBeEnabled();
  await issue.click();
  const verify = page.getByRole("link", { name: "Verify this certificate" });
  await expect(verify).toBeVisible();
  const href = await verify.getAttribute("href");
  await expect(
    page.getByRole("textbox", { name: "Personal certificate message" }),
  ).toBeDisabled();
  const pdfPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  const pdf = await pdfPromise;
  const path = info.outputPath("issued.pdf");
  await pdf.saveAs(path);
  const doc = await PDFDocument.load(await readFile(path));
  expect(doc.getPageCount()).toBeGreaterThan(2);
  for (const p of doc.getPages()) {
    const annots = p.node.lookup(PDFName.of("Annots"), PDFArray);
    const action = annots.lookup(0, PDFDict).lookup(PDFName.of("A"), PDFDict);
    expect(action.lookup(PDFName.of("URI"), PDFString).decodeText()).toBe(href);
  }
  const pngPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download PNGs (ZIP)", exact: true })
    .click();
  const png = await pngPromise;
  const zipPath = info.outputPath("issued.zip");
  await png.saveAs(zipPath);
  const files = unzipSync(await readFile(zipPath));
  expect(Object.keys(files)).toHaveLength(doc.getPageCount());
  for (const data of Object.values(files)) {
    const b = Buffer.from(data);
    expect(b.readUInt32BE(16)).toBe(3500);
    expect(b.readUInt32BE(20)).toBe(2475);
  }
  await page.evaluate(() => {
    const players = JSON.parse(
      localStorage.getItem("ludo-super-league:players"),
    );
    players[0].points_total += 100;
    localStorage.setItem("ludo-super-league:players", JSON.stringify(players));
  });
  await page.goto(href);
  await expect(
    page.getByRole("heading", { name: "Demo certificate · this browser only" }),
  ).toBeVisible();
  await expect(
    page.locator(".certificate-verify-result blockquote"),
  ).toHaveCount(9);
  await page.reload();
  await expect(page.locator(".certificate-verify-result")).toContainText(
    "For every memorable roll.",
  );
  await page
    .getByRole("link", { name: "View and download issued certificate" })
    .click();
  await expect(
    page.getByRole("button", { name: "Download PDF", exact: true }),
  ).toBeEnabled();
  await page.goto(href);
  await login(page);
  await page
    .getByLabel("Public revocation reason")
    .fill("Superseded by a reviewed certificate");
  await page
    .getByRole("button", { name: "Revoke certificate", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Certificate revoked" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Certificate revoked" }),
  ).toBeVisible();
});
test("unknown and malformed IDs never display an issued award", async ({
  page,
}) => {
  await page.goto("/#verify=not-a-certificate");
  await expect(
    page.getByRole("heading", { name: "Certificate not found" }),
  ).toBeVisible();
  await page
    .getByLabel("Certificate ID or verification link")
    .fill("00000000-0000-0000-0000-000000000000");
  await page.getByRole("button", { name: "Check certificate" }).click();
  await expect(
    page.getByRole("heading", { name: "Certificate not found" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View and download issued certificate" }),
  ).toHaveCount(0);
});

test("certificate sign-in returns to the selected recipient and full preview closes with Escape", async ({
  page,
}) => {
  await page.goto("/#certificates=demo-mubeen");
  await page
    .getByRole("button", {
      name: "Sign in as scorekeeper to issue",
      exact: true,
    })
    .click();
  await page.getByLabel("Username or email").fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("ludo2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".certificate-content")).toContainText("Mubeen");
  await page
    .getByLabel("Personal certificate message")
    .fill("A memorable round.\n".repeat(30).slice(0, 600));
  await expect(
    page.getByRole("button", { name: "Download PNGs (ZIP)", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Open full-size preview" }).click();
  await expect(
    page.getByRole("dialog", { name: "Full-size certificate preview" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Full-size certificate preview" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.locator(".certificate-page-controls")).toContainText(
    "Page 2 of",
  );
  await page
    .getByLabel("Personal certificate message")
    .fill("A shorter commendation.");
  await expect(
    page.getByRole("button", { name: "Download PNG", exact: true }),
  ).toBeEnabled();
});
