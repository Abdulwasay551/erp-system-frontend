import { chromium } from "playwright";
import path from "node:path";

const SHOT_DIR = path.resolve("./.playwright-screenshots");
const BASE = "http://localhost:3000";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  page.on("pageerror", (err) => console.log("pageerror:", err.message));

  await page.goto(`${BASE}/login`);
  await page.fill("#email", "admin@techcorp.com");
  await page.fill("#password", "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/dashboard`);

  // ---------- Customer payment ----------
  await page.goto(`${BASE}/dashboard/contacts/customers`);
  await page.waitForTimeout(500);
  const ahmedRow = page.locator("table tbody tr", { hasText: "Ahmed Raza" });
  const before = await ahmedRow.locator("td").nth(3).innerText();
  console.log("Ahmed Raza outstanding before:", before);
  await ahmedRow.locator('button:has-text("Pay")').click();
  const payDialog = page.locator('[role="dialog"]', { hasText: "Record Payment" });
  await payDialog.waitFor({ state: "visible" });
  await page.screenshot({ path: path.join(SHOT_DIR, "p3-01-customer-pay-dialog.png") });
  await payDialog.locator('button:has-text("Record Payment")').click();
  await page.waitForTimeout(1200);
  const afterRow = page.locator("table tbody tr", { hasText: "Ahmed Raza" });
  const after = await afterRow.locator("td").nth(3).innerText();
  console.log("Ahmed Raza outstanding after full payment:", after);

  // ---------- Invoice payment ----------
  await page.goto(`${BASE}/dashboard/sales/invoices`);
  await page.waitForTimeout(500);
  const outstandingRows = await page.locator("table tbody tr").count();
  console.log("Invoice rows visible:", outstandingRows);
  await page.screenshot({ path: path.join(SHOT_DIR, "p3-02-invoices-list.png") });

  await browser.close();
})().catch((err) => {
  console.error("Payments E2E check failed:", err);
  process.exitCode = 1;
});
