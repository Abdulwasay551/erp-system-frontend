// Manual one-off check of the Vendor Receiving page.
import { chromium } from "playwright";
import path from "node:path";

const SHOT_DIR = path.resolve("./.playwright-screenshots");
const BASE = "http://localhost:3000";

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: true });
  console.log(`[shot] ${name}`);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.on("pageerror", (err) => console.log("pageerror:", err.message));

  await page.goto(`${BASE}/login`);
  await page.fill("#email", "admin@techcorp.com");
  await page.fill("#password", "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/dashboard`);

  await page.click('a[href="/dashboard/receiving"]');
  await page.waitForURL(`${BASE}/dashboard/receiving`);
  await page.waitForSelector("text=New Vendor Invoice");
  await shot(page, "10-receiving-initial");

  console.log("Selecting supplier...");
  await page.click('button:has-text("Select supplier")');
  const option = page.getByRole("option").filter({ hasText: "Electronics Supply Co." });
  await option.waitFor({ state: "visible", timeout: 5000 });
  await option.click();
  const triggerText = await page.locator('button:near(:text("Supplier"))').first().textContent();
  console.log("Supplier trigger now reads:", JSON.stringify(triggerText));
  await shot(page, "11-supplier-selected");

  console.log("Searching product (Samsung, tracked)...");
  await page.fill('input[placeholder*="Search by name"]', "Samsung");
  await page.click('button:has-text("Search")');
  await page.waitForSelector("text=Add", { timeout: 10000 });
  await shot(page, "12-product-search");
  await page.click('button:has-text("Add")');
  await shot(page, "13-line-added");

  await page.fill('input[placeholder="Unit price"]', "700");
  await page.fill('input[placeholder="Expected qty"]', "2");
  await shot(page, "14-line-filled");

  await page.click('button:has-text("Record Vendor Invoice")');
  await page.waitForSelector("text=Pending Receipts");
  await page.waitForTimeout(1500);
  await shot(page, "15-after-create-pending-list");

  await browser.close();
})().catch((err) => {
  console.error("Receiving E2E check failed:", err);
  process.exitCode = 1;
});
