// Manual verification for Phase C (nav), Phase D (camera scanner), Phase E (debit/credit UI).
import { chromium } from "playwright";
import path from "node:path";

const SHOT_DIR = path.resolve("./.playwright-screenshots");
const BASE = "http://localhost:3000";
const errors = [];

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: true });
  console.log(`[shot] ${name}`);
}

(async () => {
  const browser = await chromium.launch({
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ["camera"],
  });
  const page = await context.newPage();
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });

  console.log("1. Login");
  await page.goto(`${BASE}/login`);
  await page.fill("#email", "e2e@test.com");
  await page.fill("#password", "TestPass123!");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 10000 });
  await shot(page, "c1-dashboard");

  console.log("2. Phase C: sidebar nav to All Vendor Bills");
  await page.click('a[href="/dashboard/inventory"]');
  await page.waitForURL(`${BASE}/dashboard/inventory`);
  await page.click('a[href="/dashboard/inventory/receiving/all"]');
  await page.waitForURL(`${BASE}/dashboard/inventory/receiving/all`);
  await page.waitForSelector("text=Vendor Bills");
  await shot(page, "c2-all-vendor-bills");
  console.log("   OK - reached All Vendor Bills via sidebar only");

  console.log("3. Phase C: inventory overview card also links there");
  await page.goto(`${BASE}/dashboard/inventory`);
  await page.waitForSelector("text=All Vendor Bills");
  await shot(page, "c3-inventory-overview-card");

  console.log("4. Phase D: POS camera scanner dialog");
  await page.click('a[href="/dashboard/sales/pos"]');
  await page.waitForURL(`${BASE}/dashboard/sales/pos`);
  await page.click('button[title="Scan with camera"]');
  await page.waitForTimeout(1500);
  await shot(page, "d1-pos-scanner-open");
  const posVideo = await page.locator("video").count();
  console.log(`   video elements present: ${posVideo}`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await shot(page, "d2-pos-scanner-closed");

  console.log("5. Phase E: customer debit/credit dialog");
  await page.click('a[href="/dashboard/contacts/customers"]');
  await page.waitForURL(`${BASE}/dashboard/contacts/customers`);
  await page.waitForSelector("text=Test Customer");
  await page.click('button:has-text("Debit/Credit")');
  const dialog = page.locator('[data-slot="dialog-content"]', { hasText: "Ledger Adjustment" });
  await dialog.waitFor({ state: "visible" });
  await shot(page, "e1-customer-adjust-dialog");

  await dialog.getByText("Customer owes less").click();
  await dialog.locator('input[data-slot="input"]').first().fill("500");
  await dialog.locator('input[placeholder="Why is this being adjusted?"]').fill("E2E test credit");
  await shot(page, "e2-customer-adjust-filled");
  await dialog.getByRole("button", { name: "Record Credit" }).click();
  await page.waitForTimeout(1500);
  await shot(page, "e3-customer-adjust-submitted");

  console.log("6. Phase E: verify ledger reflects the credit");
  await page.click('button:has-text("Ledger")');
  await page.waitForSelector("text=adjustment", { timeout: 5000 }).catch(() => {});
  await shot(page, "e4-customer-ledger-after-credit");

  console.log("7. Phase E: supplier debit/credit dialog");
  await page.goto(`${BASE}/dashboard/contacts/suppliers`);
  await page.waitForSelector("text=Test Supplier");
  await page.click('button:has-text("Debit/Credit")');
  const supplierDialog = page.locator('[data-slot="dialog-content"]', { hasText: "Ledger Adjustment" });
  await supplierDialog.waitFor({ state: "visible" });
  await shot(page, "e5-supplier-adjust-dialog");

  await supplierDialog.getByText("You owe less").click();
  await supplierDialog.locator('input[data-slot="input"]').first().fill("300");
  await supplierDialog.locator('input[placeholder="Why is this being adjusted?"]').fill("E2E test supplier credit");
  await supplierDialog.getByRole("button", { name: "Record Credit" }).click();
  await page.waitForTimeout(1500);
  await shot(page, "e6-supplier-adjust-submitted");

  console.log(`\nDone. Console/page errors: ${errors.length}`);
  errors.forEach((e) => console.log("  -", e));

  await browser.close();
})().catch((err) => {
  console.error("Phase C/D/E E2E check failed:", err);
  process.exitCode = 1;
});
