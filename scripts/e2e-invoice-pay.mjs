import { chromium } from "playwright";

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

  await page.goto(`${BASE}/dashboard/sales/invoices`);
  await page.waitForTimeout(500);

  const ahmedInvoiceRow = page.locator("table tbody tr", { hasText: "Ahmed Raza" });
  const outstandingBefore = await ahmedInvoiceRow.locator("td").nth(5).innerText();
  console.log("Ahmed's invoice outstanding before:", outstandingBefore.trim());

  await ahmedInvoiceRow.locator('button:has-text("Pay")').click();
  const dialog = page.locator('[role="dialog"]', { hasText: "Record Payment" });
  await dialog.waitFor({ state: "visible" });
  // Pay only half of the outstanding amount to verify partial-payment math too
  const amountInput = dialog.locator('input[data-slot="input"]').first();
  await amountInput.fill("175");
  await dialog.locator('button:has-text("Record Payment")').click();
  await page.waitForTimeout(1200);

  const afterRow = page.locator("table tbody tr", { hasText: "Ahmed Raza" });
  const outstandingAfter = await afterRow.locator("td").nth(5).innerText();
  const paidAfter = await afterRow.locator("td").nth(4).innerText();
  const statusAfter = await afterRow.locator("td").nth(6).innerText();
  console.log("Ahmed's invoice paid after partial payment:", paidAfter.trim());
  console.log("Ahmed's invoice outstanding after partial payment:", outstandingAfter.trim());
  console.log("Ahmed's invoice status after partial payment:", statusAfter.trim());

  await browser.close();
})().catch((err) => {
  console.error("Invoice payment E2E check failed:", err);
  process.exitCode = 1;
});
